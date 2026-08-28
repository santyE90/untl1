begin;

create extension if not exists pgtap with schema extensions;
select plan(18);

select has_column('public', 'profiles', 'theme_preference', 'profile appearance preference exists');
select has_function('public', 'replace_course_meetings', array['uuid', 'jsonb'], 'atomic meeting replacement exists');
select has_function('public', 'delete_empty_school_term', array['uuid'], 'safe term deletion exists');
select has_function('public', 'delete_empty_school_course', array['uuid'], 'safe course deletion exists');
select has_function('public', 'delete_unused_finance_account', array['uuid'], 'safe account deletion exists');
select has_function('public', 'delete_recurring_bill', array['uuid'], 'recurring bill deletion exists');
select has_function('public', 'delete_recurring_income', array['uuid'], 'recurring income deletion exists');
select has_function('public', 'delete_finance_budget', array['uuid'], 'owned monthly budget deletion exists');

insert into auth.users (id, email) values
  ('8a000000-0000-4000-8000-000000000001', 'ux-a@example.test'),
  ('8b000000-0000-4000-8000-000000000002', 'ux-b@example.test');
insert into public.academic_terms (id, user_id, name, start_date, end_date) values
  ('8a100000-0000-4000-8000-000000000001', '8a000000-0000-4000-8000-000000000001', 'A term', '2026-09-01', '2026-12-20'),
  ('8b100000-0000-4000-8000-000000000002', '8b000000-0000-4000-8000-000000000002', 'B term', '2026-09-01', '2026-12-20');
insert into public.courses (id, user_id, term_id, code, name) values
  ('8a200000-0000-4000-8000-000000000001', '8a000000-0000-4000-8000-000000000001', '8a100000-0000-4000-8000-000000000001', 'A100', 'A course'),
  ('8b200000-0000-4000-8000-000000000002', '8b000000-0000-4000-8000-000000000002', '8b100000-0000-4000-8000-000000000002', 'B100', 'B course');
insert into public.finance_accounts (id, user_id, name, account_type, opening_balance_date) values
  ('8a300000-0000-4000-8000-000000000001', '8a000000-0000-4000-8000-000000000001', 'Unused', 'cash', '2026-01-01'),
  ('8a300000-0000-4000-8000-000000000002', '8a000000-0000-4000-8000-000000000001', 'Used', 'chequing', '2026-01-01');
insert into public.finance_transactions (user_id, account_id, category_id, amount, kind, transaction_date)
select '8a000000-0000-4000-8000-000000000001', '8a300000-0000-4000-8000-000000000002', id, -10, 'expense', '2026-08-01'
from public.finance_categories where user_id = '8a000000-0000-4000-8000-000000000001' and default_key = 'other';
insert into public.recurring_bills (id, user_id, name, expected_amount, currency, account_id, category_id, frequency, anchor_date, next_due_date)
select '8a400000-0000-4000-8000-000000000001', '8a000000-0000-4000-8000-000000000001', 'Rent', 100, 'CAD', '8a300000-0000-4000-8000-000000000002', id, 'monthly', '2026-08-01', '2026-09-01'
from public.finance_categories where user_id = '8a000000-0000-4000-8000-000000000001' and default_key = 'rent';
insert into public.finance_transactions (id, user_id, account_id, category_id, recurring_bill_id, amount, kind, status, transaction_date, merchant)
select '8a500000-0000-4000-8000-000000000001', '8a000000-0000-4000-8000-000000000001', '8a300000-0000-4000-8000-000000000002', id, '8a400000-0000-4000-8000-000000000001', -100, 'expense', 'posted', '2026-08-01', 'Landlord'
from public.finance_categories where user_id = '8a000000-0000-4000-8000-000000000001' and default_key = 'rent';

set local role authenticated;
set local request.jwt.claim.sub = '8a000000-0000-4000-8000-000000000001';

select throws_ok($$ select public.replace_course_meetings('8b200000-0000-4000-8000-000000000002', '[]'::jsonb) $$, '42501', 'Course not found', 'meeting replacement cannot target another user course');
select is(public.replace_course_meetings('8a200000-0000-4000-8000-000000000001', '[{"meeting_type":"lecture","weekday":1,"start_time":"09:00","end_time":"10:00","timezone":"America/Toronto","location":"A","effective_start_date":"2026-09-01","effective_end_date":"2026-12-20","is_active":true},{"meeting_type":"lab","weekday":3,"start_time":"13:00","end_time":"15:00","timezone":"America/Toronto","location":"B","effective_start_date":"2026-09-01","effective_end_date":"2026-12-20","is_active":true}]'::jsonb), 2, 'different meeting rows save atomically');
select throws_ok($$ select public.replace_course_meetings('8a200000-0000-4000-8000-000000000001', '[{"meeting_type":"lecture","weekday":1,"start_time":"11:00","end_time":"10:00","timezone":"America/Toronto","effective_start_date":"2026-09-01","effective_end_date":"2026-12-20","is_active":true}]'::jsonb) $$, '23514', null, 'invalid meeting replacement fails');
select is((select count(*) from public.course_meetings where course_id = '8a200000-0000-4000-8000-000000000001'), 2::bigint, 'failed meeting replacement rolls back completely');
select throws_ok($$ select public.delete_empty_school_term('8a100000-0000-4000-8000-000000000001') $$, '23503', 'Archive this term instead because it still contains courses', 'non-empty term deletion is blocked');
select lives_ok($$ select public.delete_unused_finance_account('8a300000-0000-4000-8000-000000000001') $$, 'unused owned account can be deleted');
select throws_ok($$ select public.delete_unused_finance_account('8a300000-0000-4000-8000-000000000002') $$, '23503', 'Archive this account instead because it has financial history or schedules', 'account history blocks permanent deletion');
select lives_ok($$ select public.delete_recurring_bill('8a400000-0000-4000-8000-000000000001') $$, 'owned recurring bill can be deleted');
select is((select count(*) from public.recurring_bills where id = '8a400000-0000-4000-8000-000000000001'), 0::bigint, 'recurring source is removed');
select results_eq($$ select amount, status, merchant, recurring_bill_id from public.finance_transactions where id = '8a500000-0000-4000-8000-000000000001' $$, $$ values (-100.0000::numeric, 'posted'::text, 'Landlord'::text, null::uuid) $$, 'posted actual remains intact when its recurring source is deleted');

select * from finish();
rollback;
