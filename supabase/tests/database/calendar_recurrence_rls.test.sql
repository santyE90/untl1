begin;

create extension if not exists pgtap with schema extensions;
select plan(20);

select is((select column_default from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'calendar_default_view'), '''month''::text', 'Calendar default view defaults to month');
select is((select data_type from information_schema.columns where table_schema = 'public' and table_name = 'calendar_events' and column_name = 'recurrence_until'), 'date', 'recurrence end is an inclusive date');

insert into auth.users (id, email) values
  ('eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'recurrence-a@example.test'),
  ('ebbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'recurrence-b@example.test');

insert into public.calendar_events (id, user_id, title, all_day, start_date, end_date, recurrence_frequency) values
  ('ea100000-0000-4000-8000-000000000001', 'eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A birthday', true, '2024-02-29', '2024-02-29', 'yearly'),
  ('eb100000-0000-4000-8000-000000000001', 'ebbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'B event', true, '2026-09-14', '2026-09-14', 'weekly');

set local role authenticated;
set local request.jwt.claim.sub = 'eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select is((select count(*) from public.calendar_events where recurrence_frequency is not null), 1::bigint, 'user A sees only their recurring source');
select throws_ok($$ insert into public.calendar_events (user_id, title, all_day, starts_at, ends_at, recurrence_frequency) values ('eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Missing zone', false, '2026-09-14 18:00+00', '2026-09-14 19:00+00', 'weekly') $$, '23514', null, 'timed recurrence requires a timezone');
select lives_ok($$ select public.save_calendar_event_reminders('ea100000-0000-4000-8000-000000000001', array[30, 1440]) $$, 'user A saves source-level reminders');
select is((select count(*) from public.calendar_event_reminders), 2::bigint, 'both owned reminders are visible');
select lives_ok($$ select public.save_calendar_event_reminders('ea100000-0000-4000-8000-000000000001', array[30, 30]) $$, 'duplicate offsets are normalized atomically');
select is((select count(*) from public.calendar_event_reminders), 1::bigint, 'one normalized reminder remains');
select throws_ok($$ select public.save_calendar_event_reminders('eb100000-0000-4000-8000-000000000001', array[15]) $$, '42501', 'Event is unavailable', 'user A cannot configure user B event');
select throws_ok($$ insert into public.calendar_event_reminders (user_id, event_id, offset_minutes) values ('eaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ea100000-0000-4000-8000-000000000001', 5) $$, '42501', 'permission denied for table calendar_event_reminders', 'direct reminder writes are denied');
select throws_ok($$ update public.calendar_event_reminders set user_id = 'ebbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$, '42501', 'permission denied for table calendar_event_reminders', 'reminder ownership cannot be reassigned');
select lives_ok($$ update public.calendar_events set archived_at = now() where id = 'ea100000-0000-4000-8000-000000000001' $$, 'user A archives the whole series');
select throws_ok($$ select public.save_calendar_event_reminders('ea100000-0000-4000-8000-000000000001', array[15]) $$, '42501', 'Event is unavailable', 'archived series cannot receive active reminder configuration');
select lives_ok($$ update public.calendar_events set archived_at = null where id = 'ea100000-0000-4000-8000-000000000001' $$, 'user A restores their series');
select lives_ok($$ update public.calendar_events set archived_at = null where id = 'eb100000-0000-4000-8000-000000000001' $$, 'attempting to restore user B event affects no RLS-visible row');
select is((select count(*) from public.calendar_events where id = 'eb100000-0000-4000-8000-000000000001'), 0::bigint, 'user B event remains invisible during restoration');

reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'ebbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select is((select count(*) from public.calendar_event_reminders), 0::bigint, 'user B cannot read user A reminders');
select is((select count(*) from public.calendar_events), 1::bigint, 'user B sees only their recurring source');

reset role;
set local role anon;
set local request.jwt.claim.sub = '';
select throws_ok($$ select * from public.calendar_event_reminders $$, '42501', 'permission denied for table calendar_event_reminders', 'anonymous users cannot read reminder configuration');
select throws_ok($$ select public.save_calendar_event_reminders('ea100000-0000-4000-8000-000000000001', array[5]) $$, '42501', 'permission denied for function save_calendar_event_reminders', 'anonymous users cannot call reminder configuration');

select * from finish();
rollback;
