begin;

create extension if not exists pgtap with schema extensions;
select plan(17);

select has_table('public', 'finance_budgets', 'budgets table exists');
select has_table('public', 'finance_budget_categories', 'budget categories table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.finance_budgets'::regclass), 'budgets use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.finance_budget_categories'::regclass), 'budget categories use RLS');

insert into auth.users (id, email)
values
  ('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'budget-a@example.test'),
  ('cbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'budget-b@example.test');

insert into public.finance_budgets (id, user_id, budget_month, currency, overall_limit)
values
  ('c1000000-0000-4000-8000-000000000001', 'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026-07-01', 'CAD', 1000),
  ('c2000000-0000-4000-8000-000000000001', 'cbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '2026-07-01', 'CAD', 9000);

insert into public.finance_categories (id, user_id, name, category_type)
values ('cb000000-0000-4000-8000-000000000001', 'cbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'B Private Category', 'expense');

set local role authenticated;
set local request.jwt.claim.sub = 'caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select is((select count(*) from public.finance_budgets), 1::bigint, 'user A reads only their budget');

select throws_ok(
  $$ insert into public.finance_budgets (user_id, budget_month, currency, overall_limit)
     values ('caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026-08-01', 'CAD', 500) $$,
  '42501',
  'permission denied for table finance_budgets',
  'clients cannot bypass the atomic budget function'
);

select throws_ok(
  $$ update public.finance_budgets set overall_limit = 1 where id = 'c2000000-0000-4000-8000-000000000001' $$,
  '42501',
  'permission denied for table finance_budgets',
  'user A cannot modify user B budget'
);

select throws_ok(
  $$ update public.finance_budgets set user_id = 'cbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' where id = 'c1000000-0000-4000-8000-000000000001' $$,
  '42501',
  'permission denied for table finance_budgets',
  'budget ownership cannot be reassigned'
);

select throws_ok(
  $$ select public.save_monthly_finance_budget(
       '2026-08-01', 'CAD', 1200, null,
       jsonb_build_object('cb000000-0000-4000-8000-000000000001', '350.00')) $$,
  '42501',
  'Budget categories must be active expense categories you own',
  'user A cannot budget against user B category'
);

select lives_ok(
  $$ select public.save_monthly_finance_budget(
       '2026-08-01', 'CAD', 1200, 'August plan',
       jsonb_build_object(
         (select id::text from public.finance_categories where default_key = 'groceries'),
         '350.00'
       )) $$,
  'user A can atomically save an owned monthly budget'
);

select is((select overall_limit from public.finance_budgets where budget_month = '2026-08-01'), 1200.0000::numeric, 'overall limit is exact numeric');
select is((select amount from public.finance_budget_categories), 350.0000::numeric, 'category limit is exact numeric');
select is((select count(*) from public.finance_budget_categories), 1::bigint, 'one category limit was created');

select lives_ok(
  $$ select public.save_monthly_finance_budget('2026-08-01', 'CAD', 1100, null, '{}'::jsonb) $$,
  'saving an empty category set removes category limits atomically'
);
select is((select count(*) from public.finance_budget_categories), 0::bigint, 'removed category limits leave no stale rows');

reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'cbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select is((select count(*) from public.finance_budgets), 1::bigint, 'user B sees only their own budget');

reset role;
set local role anon;
set local request.jwt.claim.sub = '';

select throws_ok(
  $$ select * from public.finance_budgets $$,
  '42501',
  'permission denied for table finance_budgets',
  'anonymous users cannot read budgets'
);

select * from finish();
rollback;
