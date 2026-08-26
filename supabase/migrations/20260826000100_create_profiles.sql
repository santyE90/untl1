create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  currency text not null default 'CAD',
  timezone text not null default 'America/Toronto',
  week_starts_on smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_display_name_length
    check (display_name is null or char_length(display_name) between 2 and 80),
  constraint profiles_currency_iso_shape
    check (currency ~ '^[A-Z]{3}$'),
  constraint profiles_timezone_not_blank
    check (char_length(btrim(timezone)) > 0),
  constraint profiles_week_starts_on_range
    check (week_starts_on between 0 and 6)
);

comment on table public.profiles is
  'Private per-user preferences. The primary key is the owning Supabase Auth user ID.';
comment on column public.profiles.week_starts_on is
  'ISO-like weekday index used by the UI: 0 is Sunday and 6 is Saturday.';

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name, currency, timezone, week_starts_on)
  on table public.profiles to authenticated;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_display_name text;
begin
  requested_display_name := nullif(
    left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 80),
    ''
  );

  if requested_display_name is not null and char_length(requested_display_name) < 2 then
    requested_display_name := null;
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, requested_display_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

-- Backfill accounts that existed before this migration. Auth metadata is
-- treated as untrusted input and constrained in the same way as new signups.
insert into public.profiles (id, display_name)
select
  users.id,
  case
    when char_length(left(btrim(coalesce(users.raw_user_meta_data ->> 'display_name', '')), 80)) >= 2
      then left(btrim(users.raw_user_meta_data ->> 'display_name'), 80)
    else null
  end
from auth.users as users
on conflict (id) do nothing;
