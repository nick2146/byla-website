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
