begin;

create extension if not exists pgtap with schema extensions;
select plan(23);

select has_table('public', 'tasks', 'tasks table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.tasks'::regclass), 'tasks use RLS');
select is((select data_type from information_schema.columns where table_schema = 'public' and table_name = 'tasks' and column_name = 'due_date'), 'date', 'date-only due values use date');
select is((select data_type from information_schema.columns where table_schema = 'public' and table_name = 'tasks' and column_name = 'due_at'), 'timestamp with time zone', 'timed due values use timestamptz');

insert into auth.users (id, email) values
  ('5a000000-0000-4000-8000-000000000001', 'tasks-a@example.test'),
  ('5b000000-0000-4000-8000-000000000002', 'tasks-b@example.test');
insert into public.academic_terms (id, user_id, name, start_date, end_date) values
  ('5a100000-0000-4000-8000-000000000001', '5a000000-0000-4000-8000-000000000001', 'A term', '2026-09-01', '2026-12-20'),
  ('5b100000-0000-4000-8000-000000000002', '5b000000-0000-4000-8000-000000000002', 'B term', '2026-09-01', '2026-12-20');
insert into public.courses (id, user_id, term_id, code, name) values
  ('5a200000-0000-4000-8000-000000000001', '5a000000-0000-4000-8000-000000000001', '5a100000-0000-4000-8000-000000000001', 'A101', 'A course'),
  ('5b200000-0000-4000-8000-000000000002', '5b000000-0000-4000-8000-000000000002', '5b100000-0000-4000-8000-000000000002', 'B101', 'B course');
insert into public.assessments (id, user_id, course_id, name, assessment_type, timing_type, due_at, weight_percent) values
  ('5a300000-0000-4000-8000-000000000001', '5a000000-0000-4000-8000-000000000001', '5a200000-0000-4000-8000-000000000001', 'A assignment', 'assignment', 'deadline', '2026-10-01 21:00+00', 20),
  ('5b300000-0000-4000-8000-000000000002', '5b000000-0000-4000-8000-000000000002', '5b200000-0000-4000-8000-000000000002', 'B assignment', 'assignment', 'deadline', '2026-10-01 21:00+00', 20);
insert into public.tasks (id, user_id, title, priority, due_date, assessment_id) values
  ('5a400000-0000-4000-8000-000000000001', '5a000000-0000-4000-8000-000000000001', 'A task', 'high', '2026-09-14', '5a300000-0000-4000-8000-000000000001'),
  ('5b400000-0000-4000-8000-000000000002', '5b000000-0000-4000-8000-000000000002', 'B task', 'low', '2026-09-15', '5b300000-0000-4000-8000-000000000002');

set local role authenticated;
set local request.jwt.claim.sub = '5a000000-0000-4000-8000-000000000001';

select is((select count(*) from public.tasks), 1::bigint, 'user A sees only their task');
select lives_ok($$ insert into public.tasks (user_id, title, status, priority, due_at, estimated_effort_minutes) values ('5a000000-0000-4000-8000-000000000001', 'A timed task', 'todo', 'urgent', '2026-09-15 03:59+00', 30) $$, 'user A creates a valid task');
select lives_ok($$ insert into public.tasks (user_id, title, status) values ('5a000000-0000-4000-8000-000000000001', 'Already done', 'completed') $$, 'completed task creation is normalized');
select ok((select completed_at is not null from public.tasks where title = 'Already done'), 'completed task receives a timestamp');
select lives_ok($$ update public.tasks set status = 'completed' where id = '5a400000-0000-4000-8000-000000000001' $$, 'user A completes their task');
select ok((select completed_at is not null from public.tasks where id = '5a400000-0000-4000-8000-000000000001'), 'completion timestamp is stored');
select lives_ok($$ update public.tasks set status = 'todo' where id = '5a400000-0000-4000-8000-000000000001' $$, 'user A reopens their task');
select ok((select completed_at is null from public.tasks where id = '5a400000-0000-4000-8000-000000000001'), 'reopening clears completion timestamp');
select lives_ok($$ update public.tasks set title = 'A edited', priority = 'urgent' where id = '5a400000-0000-4000-8000-000000000001' $$, 'user A edits their task');
select lives_ok($$ update public.tasks set title = 'Stolen' where id = '5b400000-0000-4000-8000-000000000002' $$, 'cross-user update affects no row');
select throws_ok($$ insert into public.tasks (user_id, title, assessment_id) values ('5a000000-0000-4000-8000-000000000001', 'Cross-linked', '5b300000-0000-4000-8000-000000000002') $$, '23503', null, 'task cannot link to another user assessment');
select throws_ok($$ insert into public.tasks (user_id, title) values ('5b000000-0000-4000-8000-000000000002', 'Forged') $$, '42501', 'new row violates row-level security policy for table "tasks"', 'user A cannot create a task as user B');
select throws_ok($$ update public.tasks set user_id = '5b000000-0000-4000-8000-000000000002' where id = '5a400000-0000-4000-8000-000000000001' $$, '42501', 'permission denied for table tasks', 'task ownership cannot be reassigned');
select throws_ok($$ insert into public.tasks (user_id, title, due_date, due_at) values ('5a000000-0000-4000-8000-000000000001', 'Invalid due shape', '2026-09-14', '2026-09-14 14:00+00') $$, '23514', null, 'task cannot have both due shapes');
select lives_ok($$ update public.tasks set archived_at = now() where id = '5a400000-0000-4000-8000-000000000001' $$, 'user A archives their task');
select ok((select archived_at is not null from public.tasks where id = '5a400000-0000-4000-8000-000000000001'), 'archive timestamp is stored');
select throws_ok($$ delete from public.tasks where id = '5a400000-0000-4000-8000-000000000001' $$, '42501', 'permission denied for table tasks', 'hard deletion is not granted');

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '5b000000-0000-4000-8000-000000000002';
select is((select title from public.tasks where id = '5b400000-0000-4000-8000-000000000002'), 'B task', 'user B task was unchanged');

reset role;
set local role anon;
set local request.jwt.claim.sub = '';
select throws_ok($$ select * from public.tasks $$, '42501', 'permission denied for table tasks', 'anonymous users cannot read tasks');

select * from finish();
rollback;
