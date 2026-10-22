-- BYLA Markets schema. Apply in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 3 and 24),
  created_at timestamptz not null default now()
);

create table if not exists public.portfolios (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cash numeric(18,2) not null default 100000.00 check (cash >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.positions (
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z.]{1,10}$'),
  quantity numeric(18,6) not null default 0 check (quantity >= 0),
  average_cost numeric(18,4) not null default 0 check (average_cost >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, symbol)
);

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z.]{1,10}$'),
  side text not null check (side in ('buy','sell')),
  quantity numeric(18,6) not null check (quantity > 0),
  price numeric(18,4) not null check (price > 0),
  total numeric(18,2) not null check (total > 0),
  quote_as_of timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists trades_user_created_idx on public.trades(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.portfolios enable row level security;
alter table public.positions enable row level security;
alter table public.trades enable row level security;

create policy "profiles are readable by signed-in users" on public.profiles
  for select to authenticated using (true);
create policy "users can create their own profile" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "users can update their own profile" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "users read own portfolio" on public.portfolios
  for select to authenticated using (auth.uid() = user_id);
create policy "users read own positions" on public.positions
  for select to authenticated using (auth.uid() = user_id);
create policy "users read own trades" on public.trades
  for select to authenticated using (auth.uid() = user_id);

-- Deliberately no client insert/update/delete policies on portfolios, positions or trades.
-- Trade writes must go through a server route that authenticates the session, obtains a
-- fresh quote server-side, validates the order, and uses a server-only database credential.
-- Never expose SUPABASE_SERVICE_ROLE_KEY in browser code.

create or replace function public.bootstrap_paper_portfolio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.portfolios(user_id, cash) values (new.id, 100000.00)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_paper_portfolio on auth.users;
create trigger on_auth_user_created_paper_portfolio
  after insert on auth.users
  for each row execute procedure public.bootstrap_paper_portfolio();

-- Production trade execution should be implemented as a single atomic server-only
-- database function, with EXECUTE revoked from anon/authenticated and granted only to
-- service_role. The server must verify the user's Supabase session and retrieve the quote
-- from the provider itself before invoking it. Never accept a client-supplied price.


-- Atomic paper-trade execution. Only the trusted server can execute this function.
create or replace function public.execute_paper_trade(
  p_user_id uuid,
  p_symbol text,
  p_side text,
  p_quantity numeric,
  p_price numeric,
  p_quote_as_of timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cash numeric(18,2);
  v_old_qty numeric(18,6);
  v_old_avg numeric(18,4);
  v_new_qty numeric(18,6);
  v_total numeric(18,2);
  v_trade_id uuid;
begin
  if p_user_id is null
     or p_symbol !~ '^[A-Z.]{1,10}$'
     or p_side not in ('buy','sell')
     or p_quantity is null or p_quantity <= 0 or p_quantity > 1000000
     or p_price is null or p_price <= 0
     or p_quote_as_of is null
     or p_quote_as_of < now() - interval '15 minutes'
     or p_quote_as_of > now() + interval '1 minute' then
    raise exception 'INVALID_ORDER';
  end if;

  v_total := round(p_quantity * p_price, 2);
  if v_total <= 0 then raise exception 'INVALID_ORDER'; end if;

  select cash into v_cash
    from public.portfolios
    where user_id = p_user_id
    for update;
  if not found then raise exception 'PORTFOLIO_NOT_FOUND'; end if;

  select quantity, average_cost into v_old_qty, v_old_avg
    from public.positions
    where user_id = p_user_id and symbol = p_symbol
    for update;
  if not found then
    v_old_qty := 0;
    v_old_avg := 0;
  end if;

  if p_side = 'buy' then
    if v_cash < v_total then raise exception 'INSUFFICIENT_CASH'; end if;
    v_new_qty := v_old_qty + p_quantity;
    update public.portfolios set cash = cash - v_total, updated_at = now()
      where user_id = p_user_id;
    insert into public.positions(user_id, symbol, quantity, average_cost, updated_at)
      values (p_user_id, p_symbol, v_new_qty,
        round(((v_old_qty * v_old_avg) + (p_quantity * p_price)) / v_new_qty, 4), now())
      on conflict (user_id, symbol) do update
        set quantity = excluded.quantity,
            average_cost = excluded.average_cost,
            updated_at = now();
  else
    if v_old_qty < p_quantity then raise exception 'INSUFFICIENT_SHARES'; end if;
    v_new_qty := v_old_qty - p_quantity;
    update public.portfolios set cash = cash + v_total, updated_at = now()
      where user_id = p_user_id;
    if v_new_qty = 0 then
      delete from public.positions where user_id = p_user_id and symbol = p_symbol;
    else
      update public.positions set quantity = v_new_qty, updated_at = now()
        where user_id = p_user_id and symbol = p_symbol;
    end if;
  end if;

  insert into public.trades(user_id, symbol, side, quantity, price, total, quote_as_of)
    values (p_user_id, p_symbol, p_side, p_quantity, p_price, v_total, p_quote_as_of)
    returning id into v_trade_id;

  return jsonb_build_object(
    'id', v_trade_id,
    'symbol', p_symbol,
    'side', p_side,
    'quantity', p_quantity,
    'price', p_price,
    'total', v_total,
    'remainingCash', (select cash from public.portfolios where user_id = p_user_id),
    'remainingShares', v_new_qty,
    'quoteAsOf', p_quote_as_of
  );
end;
$$;

revoke all on function public.execute_paper_trade(uuid, text, text, numeric, numeric, timestamptz) from public;
revoke all on function public.execute_paper_trade(uuid, text, text, numeric, numeric, timestamptz) from anon;
revoke all on function public.execute_paper_trade(uuid, text, text, numeric, numeric, timestamptz) from authenticated;
grant execute on function public.execute_paper_trade(uuid, text, text, numeric, numeric, timestamptz) to service_role;
