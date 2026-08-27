begin;

create extension if not exists pgtap with schema extensions;
select plan(22);

select has_table('public', 'academic_terms', 'academic terms table exists');
select has_table('public', 'courses', 'courses table exists');
select has_table('public', 'course_meetings', 'course meetings table exists');
select has_table('public', 'assessments', 'assessments table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.academic_terms'::regclass), 'terms use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.courses'::regclass), 'courses use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.course_meetings'::regclass), 'meetings use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.assessments'::regclass), 'assessments use RLS');

insert into auth.users (id, email) values
  ('4a000000-0000-4000-8000-000000000001', 'school-a@example.test'),
  ('4b000000-0000-4000-8000-000000000002', 'school-b@example.test');
insert into public.academic_terms (id, user_id, name, start_date, end_date) values
  ('4a100000-0000-4000-8000-000000000001', '4a000000-0000-4000-8000-000000000001', 'A Fall', '2026-09-01', '2026-12-20'),
  ('4b100000-0000-4000-8000-000000000002', '4b000000-0000-4000-8000-000000000002', 'B Fall', '2026-09-01', '2026-12-20');
insert into public.courses (id, user_id, term_id, code, name) values
  ('4a200000-0000-4000-8000-000000000001', '4a000000-0000-4000-8000-000000000001', '4a100000-0000-4000-8000-000000000001', 'A101', 'A course'),
  ('4b200000-0000-4000-8000-000000000002', '4b000000-0000-4000-8000-000000000002', '4b100000-0000-4000-8000-000000000002', 'B101', 'B course');
insert into public.course_meetings (id, user_id, course_id, weekday, start_time, end_time, timezone, effective_start_date, effective_end_date) values
  ('4a300000-0000-4000-8000-000000000001', '4a000000-0000-4000-8000-000000000001', '4a200000-0000-4000-8000-000000000001', 1, '09:00', '10:00', 'America/Toronto', '2026-09-01', '2026-12-20'),
  ('4b300000-0000-4000-8000-000000000002', '4b000000-0000-4000-8000-000000000002', '4b200000-0000-4000-8000-000000000002', 2, '09:00', '10:00', 'America/Toronto', '2026-09-01', '2026-12-20');
insert into public.assessments (id, user_id, course_id, name, assessment_type, timing_type, due_at, weight_percent) values
  ('4a400000-0000-4000-8000-000000000001', '4a000000-0000-4000-8000-000000000001', '4a200000-0000-4000-8000-000000000001', 'A essay', 'assignment', 'deadline', '2026-10-01 21:00+00', 20),
  ('4b400000-0000-4000-8000-000000000002', '4b000000-0000-4000-8000-000000000002', '4b200000-0000-4000-8000-000000000002', 'B essay', 'assignment', 'deadline', '2026-10-01 21:00+00', 20);

set local role authenticated;
set local request.jwt.claim.sub = '4a000000-0000-4000-8000-000000000001';

select is((select count(*) from public.academic_terms), 1::bigint, 'user A sees only their terms');
select is((select count(*) from public.courses), 1::bigint, 'user A sees only their courses');
select is((select count(*) from public.course_meetings), 1::bigint, 'user A sees only their meetings');
select is((select count(*) from public.assessments), 1::bigint, 'user A sees only their assessments and grades');
select throws_ok($$ insert into public.courses (user_id, term_id, code, name) values ('4a000000-0000-4000-8000-000000000001', '4b100000-0000-4000-8000-000000000002', 'BAD', 'Cross-owner course') $$, '23503', null, 'a course cannot reference another user term');
select throws_ok($$ insert into public.assessments (user_id, course_id, name, assessment_type, timing_type, due_at, weight_percent) values ('4a000000-0000-4000-8000-000000000001', '4b200000-0000-4000-8000-000000000002', 'Injected', 'quiz', 'deadline', '2026-10-02 21:00+00', 10) $$, '23503', null, 'an assessment cannot reference another user course');
select lives_ok($$ update public.assessments set score_earned = 10, score_max = 10, status = 'graded' where id = '4b400000-0000-4000-8000-000000000002' $$, 'cross-user grade update affects no row');
select is((select count(*) from public.assessments where id = '4b400000-0000-4000-8000-000000000002'), 0::bigint, 'user A cannot read user B grade data');
select throws_ok($$ update public.courses set user_id = '4b000000-0000-4000-8000-000000000002' where id = '4a200000-0000-4000-8000-000000000001' $$, '42501', 'permission denied for table courses', 'course ownership cannot be reassigned');
select throws_ok($$ delete from public.assessments where id = '4a400000-0000-4000-8000-000000000001' $$, '42501', 'permission denied for table assessments', 'hard deletion is not granted');
select throws_ok($$ insert into public.course_meetings (user_id, course_id, weekday, start_time, end_time, timezone, effective_start_date, effective_end_date) values ('4a000000-0000-4000-8000-000000000001', '4a200000-0000-4000-8000-000000000001', 3, '09:00', '10:00', 'America/Toronto', '2026-08-01', '2026-12-20') $$, '23514', null, 'meeting dates must remain within the term');
select throws_ok($$ update public.academic_terms set start_date = '2026-10-01' where id = '4a100000-0000-4000-8000-000000000001' $$, '23514', null, 'term edits cannot invalidate existing meeting schedules');
select throws_ok($$ update public.assessments set score_earned = 11, score_max = 10, status = 'graded' where id = '4a400000-0000-4000-8000-000000000001' $$, '23514', null, 'earned score cannot exceed maximum score');

reset role;
set local role anon;
set local request.jwt.claim.sub = '';
select throws_ok($$ select * from public.courses $$, '42501', 'permission denied for table courses', 'anonymous users cannot read School data');

select * from finish();
rollback;
