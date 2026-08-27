begin;

create extension if not exists pgtap with schema extensions;
select plan(24);

select has_table('public', 'course_resources', 'course resources table exists');
select has_column('public', 'assessments', 'estimated_effort_minutes', 'assessments support optional effort');
select ok((select relrowsecurity from pg_class where oid = 'public.course_resources'::regclass), 'course resources use RLS');

insert into auth.users (id, email) values
  ('4c000000-0000-4000-8000-000000000001', 'school-planning-a@example.test'),
  ('4d000000-0000-4000-8000-000000000002', 'school-planning-b@example.test');
insert into public.academic_terms (id, user_id, name, start_date, end_date, archived_at) values
  ('4c100000-0000-4000-8000-000000000001', '4c000000-0000-4000-8000-000000000001', 'A archived term', '2026-09-01', '2026-12-20', now()),
  ('4d100000-0000-4000-8000-000000000002', '4d000000-0000-4000-8000-000000000002', 'B archived term', '2026-09-01', '2026-12-20', now());
insert into public.courses (id, user_id, term_id, code, name, archived_at) values
  ('4c200000-0000-4000-8000-000000000001', '4c000000-0000-4000-8000-000000000001', '4c100000-0000-4000-8000-000000000001', 'A201', 'A archived course', now()),
  ('4d200000-0000-4000-8000-000000000002', '4d000000-0000-4000-8000-000000000002', '4d100000-0000-4000-8000-000000000002', 'B201', 'B archived course', now());
insert into public.assessments (id, user_id, course_id, name, assessment_type, timing_type, due_at, weight_percent, archived_at) values
  ('4c300000-0000-4000-8000-000000000001', '4c000000-0000-4000-8000-000000000001', '4c200000-0000-4000-8000-000000000001', 'A archived assessment', 'assignment', 'deadline', '2026-10-01 21:00+00', 20, now()),
  ('4d300000-0000-4000-8000-000000000002', '4d000000-0000-4000-8000-000000000002', '4d200000-0000-4000-8000-000000000002', 'B archived assessment', 'assignment', 'deadline', '2026-10-01 21:00+00', 20, now());
insert into public.course_resources (id, user_id, course_id, label, url) values
  ('4c400000-0000-4000-8000-000000000001', '4c000000-0000-4000-8000-000000000001', '4c200000-0000-4000-8000-000000000001', 'A resource', 'https://a.example.test'),
  ('4d400000-0000-4000-8000-000000000002', '4d000000-0000-4000-8000-000000000002', '4d200000-0000-4000-8000-000000000002', 'B resource', 'https://b.example.test');

set local role authenticated;
set local request.jwt.claim.sub = '4c000000-0000-4000-8000-000000000001';

select is((select count(*) from public.course_resources), 1::bigint, 'user A sees only their resources');
select lives_ok($$ insert into public.course_resources (user_id, course_id, label, url, resource_type) values ('4c000000-0000-4000-8000-000000000001', '4c200000-0000-4000-8000-000000000001', 'Syllabus', 'https://a.example.test/syllabus', 'syllabus') $$, 'user A creates an owned resource');
select throws_ok($$ insert into public.course_resources (user_id, course_id, label, url) values ('4c000000-0000-4000-8000-000000000001', '4d200000-0000-4000-8000-000000000002', 'Injected', 'https://evil.example.test') $$, '23503', null, 'resource cannot reference another user course');
select throws_ok($$ insert into public.course_resources (user_id, course_id, label, url) values ('4d000000-0000-4000-8000-000000000002', '4d200000-0000-4000-8000-000000000002', 'Forged', 'https://evil.example.test') $$, '42501', 'new row violates row-level security policy for table "course_resources"', 'user A cannot create as user B');
select lives_ok($$ update public.course_resources set label = 'Stolen' where id = '4d400000-0000-4000-8000-000000000002' $$, 'cross-user resource update affects no row');
select throws_ok($$ update public.course_resources set user_id = '4d000000-0000-4000-8000-000000000002' where id = '4c400000-0000-4000-8000-000000000001' $$, '42501', 'permission denied for table course_resources', 'resource ownership cannot be reassigned');
select throws_ok($$ update public.courses set archived_at = null where id = '4c200000-0000-4000-8000-000000000001' $$, '23514', null, 'course cannot be restored under an archived term');
select throws_ok($$ update public.assessments set archived_at = null where id = '4c300000-0000-4000-8000-000000000001' $$, '23514', null, 'assessment cannot be restored under archived parents');
select lives_ok($$ update public.academic_terms set archived_at = null where id = '4c100000-0000-4000-8000-000000000001' $$, 'owned term can be restored');
select lives_ok($$ update public.courses set archived_at = null where id = '4c200000-0000-4000-8000-000000000001' $$, 'course can be restored after its term');
select lives_ok($$ update public.assessments set archived_at = null where id = '4c300000-0000-4000-8000-000000000001' $$, 'assessment can be restored after its parents');
select lives_ok($$ update public.assessments set estimated_effort_minutes = 180 where id = '4c300000-0000-4000-8000-000000000001' $$, 'user A updates owned estimated effort');
select is((select estimated_effort_minutes from public.assessments where id = '4c300000-0000-4000-8000-000000000001'), 180, 'owned effort update is visible');
select lives_ok($$ update public.assessments set estimated_effort_minutes = 999 where id = '4d300000-0000-4000-8000-000000000002' $$, 'cross-user effort update affects no row');
select lives_ok($$ update public.academic_terms set archived_at = null where id = '4d100000-0000-4000-8000-000000000002' $$, 'cross-user restore affects no row');
select throws_ok($$ delete from public.course_resources where id = '4c400000-0000-4000-8000-000000000001' $$, '42501', 'permission denied for table course_resources', 'hard deletion of resources is not granted');

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '4d000000-0000-4000-8000-000000000002';
select is((select label from public.course_resources where id = '4d400000-0000-4000-8000-000000000002'), 'B resource', 'user B resource was unchanged');
select ok((select archived_at is not null from public.academic_terms where id = '4d100000-0000-4000-8000-000000000002'), 'user B term remains archived');
select is((select estimated_effort_minutes from public.assessments where id = '4d300000-0000-4000-8000-000000000002'), null, 'user B effort was unchanged');
select is((select count(*) from public.course_resources), 1::bigint, 'user B sees only their resource');

reset role;
set local role anon;
set local request.jwt.claim.sub = '';
select throws_ok($$ select * from public.course_resources $$, '42501', 'permission denied for table course_resources', 'anonymous users cannot read resources');

select * from finish();
rollback;
