-- Calendar Phase 3A: owned, non-recurring native events. Finance schedules
-- remain authoritative and are projected by the application without copied rows.

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  event_type text,
  all_day boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  start_date date,
  end_date date,
  description text,
  location text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_events_owner_key unique (id, user_id),
  constraint calendar_events_title_length check (char_length(btrim(title)) between 1 and 160),
  constraint calendar_events_type_length check (
    event_type is null or char_length(btrim(event_type)) between 1 and 40
  ),
  constraint calendar_events_description_length check (
    description is null or char_length(description) <= 4000
  ),
  constraint calendar_events_location_length check (
    location is null or char_length(btrim(location)) between 1 and 240
  ),
  constraint calendar_events_time_shape check (
    (all_day and start_date is not null and end_date is not null
      and starts_at is null and ends_at is null and end_date >= start_date)
    or
    (not all_day and starts_at is not null and ends_at is not null
      and start_date is null and end_date is null and ends_at > starts_at)
  )
);

comment on table public.calendar_events is
  'Calendar-owned native events. Finance and future module dates are projected and are not copied here.';
comment on column public.calendar_events.starts_at is
  'UTC-normalized instant for a timed event; displayed in the profile IANA timezone.';
comment on column public.calendar_events.start_date is
  'Timezone-free calendar date for an all-day event. end_date is inclusive.';

create index calendar_events_user_timed_idx
  on public.calendar_events (user_id, starts_at, ends_at)
  where archived_at is null and not all_day;
create index calendar_events_user_all_day_idx
  on public.calendar_events (user_id, start_date, end_date)
  where archived_at is null and all_day;
create index calendar_events_user_archived_idx
  on public.calendar_events (user_id, archived_at);

create trigger calendar_events_set_updated_at
before update on public.calendar_events
for each row execute function private.set_updated_at();

alter table public.calendar_events enable row level security;

create policy calendar_events_select_own on public.calendar_events
for select to authenticated using ((select auth.uid()) = user_id);
create policy calendar_events_insert_own on public.calendar_events
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy calendar_events_update_own on public.calendar_events
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on table public.calendar_events from public, anon, authenticated;
grant select on table public.calendar_events to authenticated;
grant insert (user_id, title, event_type, all_day, starts_at, ends_at,
  start_date, end_date, description, location)
  on public.calendar_events to authenticated;
grant update (title, event_type, all_day, starts_at, ends_at,
  start_date, end_date, description, location, archived_at)
  on public.calendar_events to authenticated;
