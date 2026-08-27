begin;

create extension if not exists pgtap with schema extensions;
select plan(14);

select is((select data_type from information_schema.columns where table_schema = 'public' and table_name = 'calendar_events' and column_name = 'starts_at'), 'timestamp with time zone', 'timed events use timestamptz');
select is((select data_type from information_schema.columns where table_schema = 'public' and table_name = 'calendar_events' and column_name = 'start_date'), 'date', 'all-day events use date');

insert into auth.users (id, email) values
  ('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'calendar-a@example.test'),
  ('cbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'calendar-b@example.test');

insert into public.calendar_events (id, user_id, title, all_day, start_date, end_date) values
  ('ca100000-0000-4000-8000-000000000001', 'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A all day', true, '2026-09-14', '2026-09-14');
insert into public.calendar_events (id, user_id, title, all_day, starts_at, ends_at) values
  ('cb100000-0000-4000-8000-000000000001', 'cbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'B timed', false, '2026-09-14 18:30:00+00', '2026-09-14 19:15:00+00');

set local role authenticated;
set local request.jwt.claim.sub = 'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select is((select count(*) from public.calendar_events), 1::bigint, 'user A sees only their event');
select lives_ok($$ insert into public.calendar_events (user_id, title, all_day, starts_at, ends_at) values ('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A timed', false, '2026-09-15 13:00+00', '2026-09-15 14:00+00') $$, 'user A creates a valid timed event');
select throws_ok($$ insert into public.calendar_events (user_id, title, all_day, start_date, end_date) values ('cbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Injected', true, '2026-09-15', '2026-09-15') $$, '42501', 'new row violates row-level security policy for table "calendar_events"', 'user A cannot create for user B');
select lives_ok($$ update public.calendar_events set title = 'A updated' where id = 'ca100000-0000-4000-8000-000000000001' $$, 'user A updates their event');
select is((select title from public.calendar_events where id = 'ca100000-0000-4000-8000-000000000001'), 'A updated', 'own update is stored');
select lives_ok($$ update public.calendar_events set title = 'Stolen' where id = 'cb100000-0000-4000-8000-000000000001' $$, 'cross-user update affects no visible row');
select throws_ok($$ update public.calendar_events set user_id = 'cbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' where id = 'ca100000-0000-4000-8000-000000000001' $$, '42501', 'permission denied for table calendar_events', 'ownership cannot be reassigned');
select throws_ok($$ insert into public.calendar_events (user_id, title, all_day, start_date, end_date) values ('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Reversed', true, '2026-09-16', '2026-09-14') $$, '23514', null, 'all-day end cannot precede start');
select throws_ok($$ insert into public.calendar_events (user_id, title, all_day, starts_at, ends_at) values ('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Reversed', false, '2026-09-16 15:00+00', '2026-09-16 14:00+00') $$, '23514', null, 'timed end must follow start');
select lives_ok($$ update public.calendar_events set archived_at = now() where id = 'ca100000-0000-4000-8000-000000000001' $$, 'user A can archive their event');
select throws_ok($$ delete from public.calendar_events where id = 'ca100000-0000-4000-8000-000000000001' $$, '42501', 'permission denied for table calendar_events', 'authenticated users cannot hard-delete events');

reset role;
set local role anon;
set local request.jwt.claim.sub = '';
select throws_ok($$ select * from public.calendar_events $$, '42501', 'permission denied for table calendar_events', 'anonymous users cannot read private events');

select * from finish();
rollback;
