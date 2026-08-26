begin;

create extension if not exists pgtap with schema extensions;
select plan(31);

select has_table('public', 'finance_accounts', 'finance accounts table exists');
select has_table('public', 'finance_transactions', 'finance transactions table exists');
select has_table('public', 'finance_transfers', 'finance transfers table exists');
select has_view('public', 'finance_account_balances', 'derived balance view exists');
select ok((select relrowsecurity from pg_class where oid = 'public.finance_accounts'::regclass), 'accounts use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.finance_transactions'::regclass), 'transactions use RLS');

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'finance-a@example.test'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'finance-b@example.test');

select is((select count(*) from public.finance_categories where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 16::bigint, 'defaults are seeded for user A');
select is((select count(*) from public.finance_categories where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 16::bigint, 'defaults are seeded for user B');

insert into public.finance_accounts
  (id, user_id, name, account_type, opening_balance, opening_balance_date)
values
  ('a0000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A Chequing', 'chequing', 1000, '2026-01-01'),
  ('a0000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A Savings', 'savings', 200, '2026-01-01'),
  ('b0000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'B Chequing', 'chequing', 9000, '2026-01-01');

insert into public.finance_transactions
  (id, user_id, account_id, category_id, amount, kind, transaction_date, merchant)
values
  ('b1000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'b0000000-0000-4000-8000-000000000001',
   (select id from public.finance_categories where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and default_key = 'groceries'),
   -25, 'expense', '2026-08-01', 'Private B merchant');

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select is((select count(*) from public.finance_accounts), 2::bigint, 'user A reads only their accounts');
select is((select count(*) from public.finance_categories), 16::bigint, 'user A reads only their categories');

select lives_ok(
  $$ insert into public.finance_categories (user_id, name, category_type)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Pets', 'expense') $$,
  'user A can create an owned custom category'
);
select throws_ok(
  $$ insert into public.finance_categories (user_id, name, category_type)
     values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Injected', 'expense') $$,
  '42501',
  'new row violates row-level security policy for table "finance_categories"',
  'user A cannot create a category for user B'
);

select lives_ok(
  $$ update public.finance_accounts set name = 'Not changed' where id = 'b0000000-0000-4000-8000-000000000001' $$,
  'cross-user account update is safely filtered'
);

select throws_ok(
  $$ update public.finance_accounts set user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' where id = 'a0000000-0000-4000-8000-000000000001' $$,
  '42501',
  'permission denied for table finance_accounts',
  'ownership cannot be reassigned'
);

select lives_ok(
  $$ update public.finance_transactions set amount = -999 where id = 'b1000000-0000-4000-8000-000000000001' $$,
  'a cross-user transaction update is safely filtered'
);

select throws_ok(
  $$ insert into public.finance_transactions (user_id, account_id, category_id, amount, kind, transaction_date)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'b0000000-0000-4000-8000-000000000001',
       (select id from public.finance_categories where default_key = 'groceries'), -20, 'expense', '2026-08-01') $$,
  'a transaction cannot reference another user account'
);

select throws_ok(
  $$ insert into public.finance_transfers (user_id, source_account_id, destination_account_id, amount, currency, transfer_date)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a0000000-0000-4000-8000-000000000001',
       'a0000000-0000-4000-8000-000000000002', 10, 'CAD', '2026-08-01') $$,
  '42501',
  'permission denied for table finance_transfers',
  'clients cannot bypass the atomic transfer function'
);

select throws_ok(
  $$ select public.create_finance_transfer('a0000000-0000-4000-8000-000000000001',
       'b0000000-0000-4000-8000-000000000001', 50, '2026-08-01') $$,
  '42501',
  'Both transfer accounts must be active accounts you own',
  'a transfer cannot involve another user account'
);

select lives_ok(
  $$ select public.create_finance_transfer('a0000000-0000-4000-8000-000000000001',
       'a0000000-0000-4000-8000-000000000002', 500, '2026-08-01') $$,
  'an owned transfer succeeds atomically'
);

select is((select count(*) from public.finance_transfers), 1::bigint, 'one transfer header is visible');
select is((select count(*) from public.finance_transactions where kind = 'transfer'), 2::bigint, 'a transfer has exactly two ledger effects');
select is((select sum(amount) from public.finance_transactions where kind = 'transfer'), 0.0000::numeric, 'transfer effects net to zero');
select results_eq(
  $$ select id, current_balance from public.finance_account_balances order by id $$,
  $$ values
      ('a0000000-0000-4000-8000-000000000001'::uuid, 500.0000::numeric),
      ('a0000000-0000-4000-8000-000000000002'::uuid, 700.0000::numeric) $$,
  'derived balances apply both transfer effects'
);

select lives_ok(
  $$ update public.finance_transactions set amount = 1 where kind = 'transfer' $$,
  'an attempted transfer-ledger update is safely filtered'
);
select is((select sum(amount) from public.finance_transactions where kind = 'transfer'), 0.0000::numeric, 'transfer ledger entries were not modified');

select throws_ok(
  $$ insert into public.recurring_bills
       (user_id, name, expected_amount, account_id, category_id, frequency, anchor_date, next_due_date)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Attack', 10,
       'b0000000-0000-4000-8000-000000000001',
       (select id from public.finance_categories where default_key = 'rent'), 'monthly', '2026-08-01', '2026-09-01') $$,
  'recurring bills cannot reference another user account'
);

select throws_ok(
  $$ insert into public.recurring_income
       (user_id, name, expected_amount, destination_account_id, frequency, anchor_date, next_payday)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Attack income', 100,
       'b0000000-0000-4000-8000-000000000001', 'biweekly', '2026-08-01', '2026-08-15') $$,
  'recurring income cannot reference another user account'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select is((select name from public.finance_accounts), 'B Chequing', 'user B sees no user A account data');
select is((select amount from public.finance_transactions), -25.0000::numeric, 'user A did not modify user B transaction data');
select is((select count(*) from public.finance_categories), 16::bigint, 'user B does not see user A custom categories');

reset role;
set local role anon;
set local request.jwt.claim.sub = '';

select throws_ok(
  $$ select * from public.finance_accounts $$,
  '42501',
  'permission denied for table finance_accounts',
  'anonymous users cannot read finance accounts'
);

select * from finish();
rollback;
