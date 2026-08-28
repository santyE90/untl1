begin;

create extension if not exists pgtap with schema extensions;
select plan(53);

select has_table('public', 'goals', 'goals table exists');
select has_table('public', 'goal_milestones', 'goal milestones table exists');
select has_column('public', 'tasks', 'goal_id', 'tasks can optionally link to a goal');
select ok((select relrowsecurity from pg_class where oid = 'public.goals'::regclass), 'goals use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.goal_milestones'::regclass), 'goal milestones use RLS');
select is((select data_type from information_schema.columns where table_schema = 'public' and table_name = 'goals' and column_name = 'deadline'), 'date', 'goal deadlines use date');
select is((select data_type from information_schema.columns where table_schema = 'public' and table_name = 'goals' and column_name = 'current_value'), 'numeric', 'current progress uses numeric');
select is((select data_type from information_schema.columns where table_schema = 'public' and table_name = 'goals' and column_name = 'target_value'), 'numeric', 'target progress uses numeric');

insert into auth.users (id, email) values
  ('6a000000-0000-4000-8000-000000000001', 'goals-a@example.test'),
  ('6b000000-0000-4000-8000-000000000002', 'goals-b@example.test');
insert into public.academic_terms (id, user_id, name, start_date, end_date) values
  ('6a100000-0000-4000-8000-000000000001', '6a000000-0000-4000-8000-000000000001', 'A term', '2026-09-01', '2026-12-20');
insert into public.courses (id, user_id, term_id, code, name) values
  ('6a200000-0000-4000-8000-000000000001', '6a000000-0000-4000-8000-000000000001', '6a100000-0000-4000-8000-000000000001', 'A101', 'A course');
insert into public.assessments (id, user_id, course_id, name, assessment_type, timing_type, due_at, weight_percent) values
  ('6a300000-0000-4000-8000-000000000001', '6a000000-0000-4000-8000-000000000001', '6a200000-0000-4000-8000-000000000001', 'A assignment', 'assignment', 'deadline', '2026-10-01 21:00+00', 20);
insert into public.goals (id, user_id, title, category, deadline, progress_mode, current_value, target_value, unit_label) values
  ('6a400000-0000-4000-8000-000000000001', '6a000000-0000-4000-8000-000000000001', 'A goal', 'career', '2026-12-31', 'numeric', 18.2500, 30.0000, 'applications'),
  ('6b400000-0000-4000-8000-000000000002', '6b000000-0000-4000-8000-000000000002', 'B goal', 'personal', '2027-01-31', 'none', null, null, null);
insert into public.goal_milestones (id, user_id, goal_id, title, sort_order) values
  ('6a500000-0000-4000-8000-000000000001', '6a000000-0000-4000-8000-000000000001', '6a400000-0000-4000-8000-000000000001', 'A milestone', 0),
  ('6b500000-0000-4000-8000-000000000002', '6b000000-0000-4000-8000-000000000002', '6b400000-0000-4000-8000-000000000002', 'B milestone', 0);
insert into public.tasks (id, user_id, title, assessment_id, goal_id) values
  ('6a600000-0000-4000-8000-000000000001', '6a000000-0000-4000-8000-000000000001', 'A linked task', '6a300000-0000-4000-8000-000000000001', '6a400000-0000-4000-8000-000000000001'),
  ('6b600000-0000-4000-8000-000000000002', '6b000000-0000-4000-8000-000000000002', 'B linked task', null, '6b400000-0000-4000-8000-000000000002');

set local role authenticated;
set local request.jwt.claim.sub = '6a000000-0000-4000-8000-000000000001';

select is((select count(*) from public.goals), 1::bigint, 'user A sees only their goal');
select is((select count(*) from public.goal_milestones), 1::bigint, 'user A sees only their milestone');
select is((select count(*) from public.tasks where goal_id is not null), 1::bigint, 'user A sees only their linked task');
select lives_ok($$ insert into public.goals (user_id, title, category, progress_mode, current_value, target_value, unit_label) values ('6a000000-0000-4000-8000-000000000001', 'Exact goal', 'finance', 'numeric', 3250.1250, 5000.0000, 'CAD') $$, 'user A creates exact numeric progress');
select is((select current_value_decimal from public.goals where title = 'Exact goal'), '3250.1250', 'exact current progress has a text projection');
select is((select target_value_decimal from public.goals where title = 'Exact goal'), '5000.0000', 'exact target progress has a text projection');
select lives_ok($$ insert into public.goals (user_id, title, status) values ('6a000000-0000-4000-8000-000000000001', 'Already complete', 'completed') $$, 'completed goal creation is normalized');
select ok((select completed_at is not null from public.goals where title = 'Already complete'), 'completed goal receives a timestamp');
select lives_ok($$ update public.goals set title = 'A goal edited', current_value = 20.0000 where id = '6a400000-0000-4000-8000-000000000001' $$, 'user A edits their goal');
select lives_ok($$ update public.goals set status = 'completed' where id = '6a400000-0000-4000-8000-000000000001' $$, 'user A completes their goal');
select ok((select completed_at is not null from public.goals where id = '6a400000-0000-4000-8000-000000000001'), 'goal completion timestamp is stored');
select lives_ok($$ update public.goals set status = 'active' where id = '6a400000-0000-4000-8000-000000000001' $$, 'user A reopens their goal');
select ok((select completed_at is null from public.goals where id = '6a400000-0000-4000-8000-000000000001'), 'reopening clears goal completion timestamp');
select lives_ok($$ update public.goals set archived_at = now() where title = 'Exact goal' $$, 'user A archives their goal');
select ok((select archived_at is not null from public.goals where title = 'Exact goal'), 'goal archive timestamp is stored');
select throws_ok($$ delete from public.goals where id = '6a400000-0000-4000-8000-000000000001' $$, '42501', 'permission denied for table goals', 'hard goal deletion is not granted');
select lives_ok($$ update public.goals set title = 'Stolen' where id = '6b400000-0000-4000-8000-000000000002' $$, 'cross-user goal update affects no row');
select lives_ok($$ update public.goals set status = 'completed' where id = '6b400000-0000-4000-8000-000000000002' $$, 'user A cannot complete user B goal');
select throws_ok($$ insert into public.goals (user_id, title) values ('6b000000-0000-4000-8000-000000000002', 'Forged goal') $$, '42501', 'new row violates row-level security policy for table "goals"', 'user A cannot create a goal as user B');
select throws_ok($$ update public.goals set user_id = '6b000000-0000-4000-8000-000000000002' where id = '6a400000-0000-4000-8000-000000000001' $$, '42501', 'permission denied for table goals', 'goal ownership cannot be reassigned');
select throws_ok($$ insert into public.goals (user_id, title, progress_mode, current_value, target_value) values ('6a000000-0000-4000-8000-000000000001', 'Zero target', 'numeric', 0, 0) $$, '23514', null, 'numeric target must be greater than zero');
select throws_ok($$ insert into public.goals (user_id, title, progress_mode, current_value) values ('6a000000-0000-4000-8000-000000000001', 'Invalid none', 'none', 1) $$, '23514', null, 'unconfigured progress cannot carry values');
select lives_ok($$ insert into public.goal_milestones (user_id, goal_id, title, sort_order) values ('6a000000-0000-4000-8000-000000000001', '6a400000-0000-4000-8000-000000000001', 'Second milestone', 1) $$, 'user A adds a milestone to their goal');
select lives_ok($$ insert into public.goal_milestones (user_id, goal_id, title, is_completed) values ('6a000000-0000-4000-8000-000000000001', '6a400000-0000-4000-8000-000000000001', 'Completed milestone', true) $$, 'completed milestone creation is normalized');
select ok((select completed_at is not null from public.goal_milestones where title = 'Completed milestone'), 'completed milestone receives a timestamp');
select lives_ok($$ update public.goal_milestones set is_completed = false where title = 'Completed milestone' $$, 'user A reopens a milestone');
select ok((select completed_at is null from public.goal_milestones where title = 'Completed milestone'), 'reopening clears milestone completion timestamp');
select lives_ok($$ update public.goal_milestones set title = 'A milestone edited', sort_order = 2 where id = '6a500000-0000-4000-8000-000000000001' $$, 'user A edits and reorders a milestone');
select lives_ok($$ update public.goal_milestones set archived_at = now() where id = '6a500000-0000-4000-8000-000000000001' $$, 'user A archives a milestone');
select throws_ok($$ delete from public.goal_milestones where id = '6a500000-0000-4000-8000-000000000001' $$, '42501', 'permission denied for table goal_milestones', 'hard milestone deletion is not granted');
select throws_ok($$ insert into public.goal_milestones (user_id, goal_id, title) values ('6a000000-0000-4000-8000-000000000001', '6b400000-0000-4000-8000-000000000002', 'Cross-linked milestone') $$, '23503', null, 'milestone cannot link to another user goal');
select throws_ok($$ update public.goal_milestones set user_id = '6b000000-0000-4000-8000-000000000002' where id = '6a500000-0000-4000-8000-000000000001' $$, '42501', 'permission denied for table goal_milestones', 'milestone ownership cannot be reassigned');
select lives_ok($$ update public.tasks set goal_id = null where id = '6a600000-0000-4000-8000-000000000001' $$, 'user A unlinks their task from a goal');
select ok((select goal_id is null from public.tasks where id = '6a600000-0000-4000-8000-000000000001'), 'task goal link is nullable');
select lives_ok($$ update public.tasks set goal_id = '6a400000-0000-4000-8000-000000000001' where id = '6a600000-0000-4000-8000-000000000001' $$, 'user A links their task to their goal');
select is((select goal_id from public.tasks where id = '6a600000-0000-4000-8000-000000000001'), '6a400000-0000-4000-8000-000000000001'::uuid, 'owned task-to-goal link is stored');
select throws_ok($$ update public.tasks set goal_id = '6b400000-0000-4000-8000-000000000002' where id = '6a600000-0000-4000-8000-000000000001' $$, '23503', null, 'task cannot link to another user goal');
select is((select assessment_id from public.tasks where id = '6a600000-0000-4000-8000-000000000001'), '6a300000-0000-4000-8000-000000000001'::uuid, 'existing assessment linkage remains intact');
select lives_ok($$ update public.goals set status = 'completed' where id = '6a400000-0000-4000-8000-000000000001' $$, 'goal can complete independently of related tasks');
select is((select status from public.tasks where id = '6a600000-0000-4000-8000-000000000001'), 'todo', 'goal completion does not complete its task');

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '6b000000-0000-4000-8000-000000000002';
select is((select title from public.goals where id = '6b400000-0000-4000-8000-000000000002'), 'B goal', 'user B goal was unchanged');
select is((select status from public.goals where id = '6b400000-0000-4000-8000-000000000002'), 'active', 'user B goal lifecycle was unchanged');
select is((select title from public.goal_milestones where id = '6b500000-0000-4000-8000-000000000002'), 'B milestone', 'user B milestone was unchanged');

reset role;
set local role anon;
set local request.jwt.claim.sub = '';
select throws_ok($$ select * from public.goals $$, '42501', 'permission denied for table goals', 'anonymous users cannot read goals');
select throws_ok($$ select * from public.goal_milestones $$, '42501', 'permission denied for table goal_milestones', 'anonymous users cannot read milestones');

select * from finish();
rollback;
