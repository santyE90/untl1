begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

select has_table('public', 'profiles', 'profiles table exists');
select col_is_pk('public', 'profiles', 'id', 'profile ID is the primary key');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'RLS is enabled on profiles'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('11111111-1111-4111-8111-111111111111', 'user-a@example.test', '{"display_name":"User A"}'::jsonb),
  ('22222222-2222-4222-8222-222222222222', 'user-b@example.test', '{"display_name":"User B"}'::jsonb);

select is(
  (select count(*) from public.profiles),
  2::bigint,
  'the auth trigger creates one profile per user'
);

select is(
  (select currency from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  'CAD',
  'new profiles use the CAD default'
);

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

select results_eq(
  $$ select id from public.profiles order by id $$,
  $$ values ('11111111-1111-4111-8111-111111111111'::uuid) $$,
  'a user can select only their own profile'
);

select lives_ok(
  $$ update public.profiles set display_name = 'Updated A' where id = '11111111-1111-4111-8111-111111111111' $$,
  'a user can update their allowed profile fields'
);

select is(
  (select display_name from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  'Updated A',
  'the own-profile update is visible'
);

select lives_ok(
  $$ update public.profiles set display_name = 'Compromised' where id = '22222222-2222-4222-8222-222222222222' $$,
  'a cross-user update is safely filtered rather than applied'
);

select throws_ok(
  $$ update public.profiles set created_at = now() where id = '11111111-1111-4111-8111-111111111111' $$,
  '42501',
  'permission denied for table profiles',
  'authenticated users cannot modify protected audit columns'
);

select throws_ok(
  $$ insert into public.profiles (id) values ('33333333-3333-4333-8333-333333333333') $$,
  '42501',
  'permission denied for table profiles',
  'authenticated users cannot create arbitrary profile rows'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

select is(
  (select display_name from public.profiles where id = '22222222-2222-4222-8222-222222222222'),
  'User B',
  'the attempted cross-user update changed nothing'
);

select throws_ok(
  $$ delete from public.profiles where id = '22222222-2222-4222-8222-222222222222' $$,
  '42501',
  'permission denied for table profiles',
  'authenticated users cannot delete their profile row'
);

reset role;
set local role anon;
set local request.jwt.claim.sub = '';

select throws_ok(
  $$ select * from public.profiles $$,
  '42501',
  'permission denied for table profiles',
  'anonymous users cannot read profiles'
);

select * from finish();
rollback;
