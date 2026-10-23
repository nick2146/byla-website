-- Reject hateful or abusive usernames before an auth user is created.
-- Normalize punctuation/case so separators cannot trivially bypass the filter.
create or replace function public.validate_signup_username()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text;
  v_normalized text;
  v_blocked text[] := array[
    'nigger','nigga','faggot','fag','kike','chink','spic','wetback',
    'tranny','retard','coon','raghead','nazi','hitler','heilhitler',
    'whitepower','killjews','gasjews'
  ];
  v_term text;
begin
  v_username := coalesce(new.raw_user_meta_data ->> 'username', '');
  if v_username !~ '^[A-Za-z0-9_]{3,24}$' then
    raise exception 'USERNAME_NOT_ALLOWED';
  end if;
  v_normalized := regexp_replace(lower(v_username), '[^a-z0-9]', '', 'g');
  foreach v_term in array v_blocked loop
    if position(v_term in v_normalized) > 0 then
      raise exception 'USERNAME_NOT_ALLOWED';
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists validate_signup_username_before_insert on auth.users;
create trigger validate_signup_username_before_insert
  before insert on auth.users
  for each row execute procedure public.validate_signup_username();

revoke all on function public.validate_signup_username() from public;
revoke all on function public.validate_signup_username() from anon;
revoke all on function public.validate_signup_username() from authenticated;
