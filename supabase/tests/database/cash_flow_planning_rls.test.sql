begin;

create extension if not exists pgtap with schema extensions;
select plan(18);

select is(
  (select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'recurring_bills' and column_name = 'account_id'),
  'YES',
  'bill account is optional'
);
select is(
  (select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'recurring_income' and column_name = 'destination_account_id'),
  'YES',
  'income destination account is optional'
);

insert into auth.users (id, email)
values
  ('daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'planning-a@example.test'),
  ('dbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'planning-b@example.test');

insert into public.finance_accounts (id, user_id, name, account_type, opening_balance_date)
values
  ('da000000-0000-4000-8000-000000000001', 'daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A Chequing', 'chequing', '2026-01-01'),
  ('db000000-0000-4000-8000-000000000001', 'dbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'B Chequing', 'chequing', '2026-01-01');

set local role authenticated;
set local request.jwt.claim.sub = 'daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select lives_ok(
  $$ insert into public.recurring_bills
       (id, user_id, name, expected_amount, currency, account_id, category_id, frequency, anchor_date, next_due_date)
     values ('da100000-0000-4000-8000-000000000001', 'daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       'Unassigned bill', 50, 'CAD', null,
       (select id from public.finance_categories where default_key = 'internet'),
       'monthly', '2026-09-21', '2026-09-21') $$,
  'user A can create a bill without an account'
);

select lives_ok(
  $$ insert into public.recurring_income
       (id, user_id, name, expected_amount, currency, destination_account_id, frequency, anchor_date, next_payday)
     values ('da200000-0000-4000-8000-000000000001', 'daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       'Unassigned payday', 900, 'CAD', null, 'biweekly', '2026-09-05', '2026-09-05') $$,
  'user A can create recurring income without an account'
);

select is((select count(*) from public.recurring_bills), 1::bigint, 'unassigned bill remains visible');

select lives_ok(
  $$ update public.recurring_bills set account_id = 'da000000-0000-4000-8000-000000000001'
     where id = 'da100000-0000-4000-8000-000000000001' $$,
  'user A can assign their account later'
);
select is(
  (select account_id from public.recurring_bills where id = 'da100000-0000-4000-8000-000000000001'),
  'da000000-0000-4000-8000-000000000001'::uuid,
  'the owned assignment is stored'
);

select throws_ok(
  $$ update public.recurring_bills set account_id = 'db000000-0000-4000-8000-000000000001'
     where id = 'da100000-0000-4000-8000-000000000001' $$,
  'bill assignment cannot reference user B account'
);
select throws_ok(
  $$ update public.recurring_income set destination_account_id = 'db000000-0000-4000-8000-000000000001'
     where id = 'da200000-0000-4000-8000-000000000001' $$,
  'income assignment cannot reference user B account'
);

select throws_ok(
  $$ update public.recurring_bills set user_id = 'dbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
     where id = 'da100000-0000-4000-8000-000000000001' $$,
  '42501',
  'permission denied for table recurring_bills',
  'schedule ownership cannot be reassigned'
);

select throws_ok(
  $$ insert into public.finance_transactions
       (user_id, account_id, category_id, amount, kind, transaction_date, recurring_bill_id)
     values ('daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', null,
       (select id from public.finance_categories where default_key = 'internet'), -50, 'expense', '2026-09-21',
       'da100000-0000-4000-8000-000000000001') $$,
  'an actual transaction still requires an account'
);

select lives_ok(
  $$ insert into public.finance_transactions
       (user_id, account_id, category_id, amount, kind, transaction_date, recurring_bill_id)
     values ('daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'da000000-0000-4000-8000-000000000001',
       (select id from public.finance_categories where default_key = 'internet'), -50, 'expense', '2026-09-21',
       'da100000-0000-4000-8000-000000000001') $$,
  'one linked actual occurrence can be recorded'
);
select throws_ok(
  $$ insert into public.finance_transactions
       (user_id, account_id, category_id, amount, kind, transaction_date, recurring_bill_id)
     values ('daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'da000000-0000-4000-8000-000000000001',
       (select id from public.finance_categories where default_key = 'internet'), -50, 'expense', '2026-09-21',
       'da100000-0000-4000-8000-000000000001') $$,
  'a recurring occurrence cannot be recorded twice'
);

select lives_ok(
  $$ update public.recurring_bills set account_id = null where id = 'da100000-0000-4000-8000-000000000001' $$,
  'an assigned schedule can be made unassigned again'
);
select is((select account_id from public.recurring_bills), null::uuid, 'unassignment is stored without a placeholder account');

reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'dbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select is((select count(*) from public.recurring_bills), 0::bigint, 'user B cannot read user A bills');
select is((select count(*) from public.recurring_income), 0::bigint, 'user B cannot read user A income schedules');

reset role;
set local role anon;
set local request.jwt.claim.sub = '';

select throws_ok(
  $$ select * from public.recurring_bills $$,
  '42501',
  'permission denied for table recurring_bills',
  'anonymous users cannot read schedules'
);

select * from finish();
rollback;
