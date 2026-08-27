-- Calendar Phase 3B: source-level native recurrence, reminder configuration,
-- and a stored preferred view. Occurrences/reminder deliveries are projected;
-- no future occurrence rows are generated.

alter table public.calendar_events
  add column recurrence_frequency text,
  add column recurrence_until date,
  add column recurrence_timezone text,
  add constraint calendar_events_recurrence_frequency check (
    recurrence_frequency is null or recurrence_frequency in ('daily', 'weekly', 'monthly', 'yearly')
  ),
  add constraint calendar_events_recurrence_shape check (
    (recurrence_frequency is null and recurrence_until is null and recurrence_timezone is null)
    or
    (recurrence_frequency is not null
      and ((all_day and recurrence_timezone is null)
        or (not all_day and char_length(btrim(recurrence_timezone)) between 1 and 100))
      and (recurrence_until is null or recurrence_until >= coalesce(
        start_date,
        (starts_at at time zone recurrence_timezone)::date
      )))
  );

comment on column public.calendar_events.recurrence_frequency is
  'Source-level native recurrence. Occurrences are expanded in bounded application queries.';
comment on column public.calendar_events.recurrence_until is
  'Optional inclusive final occurrence anchor date.';
comment on column public.calendar_events.recurrence_timezone is
  'IANA timezone preserving a timed series wall clock across DST. Null for all-day series.';

drop index if exists public.calendar_events_user_timed_idx;
drop index if exists public.calendar_events_user_all_day_idx;
create index calendar_events_user_timed_idx
  on public.calendar_events (user_id, recurrence_frequency, starts_at, recurrence_until)
  where archived_at is null and not all_day;
create index calendar_events_user_all_day_idx
  on public.calendar_events (user_id, recurrence_frequency, start_date, recurrence_until)
  where archived_at is null and all_day;

grant insert (recurrence_frequency, recurrence_until, recurrence_timezone)
  on public.calendar_events to authenticated;
grant update (recurrence_frequency, recurrence_until, recurrence_timezone)
  on public.calendar_events to authenticated;

alter table public.profiles
  add column calendar_default_view text not null default 'month',
  add constraint profiles_calendar_default_view check (
    calendar_default_view in ('month', 'week', 'day', 'agenda')
  );
grant update (calendar_default_view) on public.profiles to authenticated;

create table public.calendar_event_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null,
  offset_minutes integer not null,
  created_at timestamptz not null default now(),
  constraint calendar_event_reminders_owner_fk foreign key (event_id, user_id)
    references public.calendar_events (id, user_id) on delete cascade,
  constraint calendar_event_reminders_unique unique (event_id, offset_minutes),
  constraint calendar_event_reminders_offset check (offset_minutes between 0 and 10080)
);

comment on table public.calendar_event_reminders is
  'Configuration only. Each offset applies to every projected occurrence of its native source; no delivery is performed.';

create index calendar_event_reminders_user_event_idx
  on public.calendar_event_reminders (user_id, event_id);

alter table public.calendar_event_reminders enable row level security;
create policy calendar_event_reminders_select_own
  on public.calendar_event_reminders for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.calendar_event_reminders from public, anon, authenticated;
grant select on table public.calendar_event_reminders to authenticated;

create or replace function public.save_calendar_event_reminders(
  target_event_id uuid,
  reminder_offsets integer[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  normalized integer[];
begin
  if owner_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.calendar_events
    where id = target_event_id and user_id = owner_id and archived_at is null
  ) then
    raise exception 'Event is unavailable' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct selected order by selected), '{}')
  into normalized
  from unnest(coalesce(reminder_offsets, '{}')) as offsets(selected);

  if cardinality(normalized) > 8
     or exists (select 1 from unnest(normalized) as offsets(offset_value) where offset_value < 0 or offset_value > 10080) then
    raise exception 'Choose at most eight reminder offsets from 0 to 10080 minutes'
      using errcode = '22023';
  end if;

  delete from public.calendar_event_reminders
  where event_id = target_event_id and user_id = owner_id;

  insert into public.calendar_event_reminders (user_id, event_id, offset_minutes)
  select owner_id, target_event_id, offset_value
  from unnest(normalized) as offsets(offset_value);
end;
$$;

revoke all on function public.save_calendar_event_reminders(uuid, integer[])
  from public, anon, authenticated;
grant execute on function public.save_calendar_event_reminders(uuid, integer[])
  to authenticated;
