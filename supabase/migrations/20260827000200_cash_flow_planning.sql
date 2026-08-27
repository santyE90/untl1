-- Finance Phase 2C: account-optional recurring schedules and occurrence
-- reconciliation constraints. Forecast projections remain application-layer
-- DTOs and do not create permanent future transaction rows.

alter table public.recurring_bills
  alter column account_id drop not null;

alter table public.recurring_income
  alter column destination_account_id drop not null;

comment on column public.recurring_bills.account_id is
  'Optional planned payment account. A real expense transaction still requires an account.';
comment on column public.recurring_income.destination_account_id is
  'Optional planned destination account. A real income transaction still requires an account.';

create or replace function private.validate_recurring_bill()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_currency text;
  account_archived timestamptz;
  selected_category_type text;
begin
  if new.account_id is not null then
    select currency, archived_at into account_currency, account_archived
    from public.finance_accounts
    where id = new.account_id and user_id = new.user_id;

    if account_currency is null or account_currency <> new.currency then
      raise exception 'Bill currency must match its account' using errcode = '23514';
    end if;
    if account_archived is not null
       and (tg_op = 'INSERT' or new.account_id is distinct from old.account_id) then
      raise exception 'Bill assignment requires an active account' using errcode = '23514';
    end if;
  end if;

  select category_type into selected_category_type
  from public.finance_categories
  where id = new.category_id and user_id = new.user_id;

  if selected_category_type not in ('expense', 'both') then
    raise exception 'Bill requires an expense-compatible category' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.validate_recurring_income()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_currency text;
  account_archived timestamptz;
  selected_category_type text;
begin
  if new.destination_account_id is not null then
    select currency, archived_at into account_currency, account_archived
    from public.finance_accounts
    where id = new.destination_account_id and user_id = new.user_id;

    if account_currency is null or account_currency <> new.currency then
      raise exception 'Income currency must match its account' using errcode = '23514';
    end if;
    if account_archived is not null
       and (tg_op = 'INSERT' or new.destination_account_id is distinct from old.destination_account_id) then
      raise exception 'Income assignment requires an active account' using errcode = '23514';
    end if;
  end if;

  if new.category_id is not null then
    select category_type into selected_category_type
    from public.finance_categories
    where id = new.category_id and user_id = new.user_id;
    if selected_category_type not in ('income', 'both') then
      raise exception 'Recurring income requires an income-compatible category' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.validate_recurring_bill() from public, anon, authenticated;
revoke all on function private.validate_recurring_income() from public, anon, authenticated;

alter table public.finance_transactions
  add constraint finance_transactions_recurring_kind_match check (
    (recurring_bill_id is null or kind = 'expense')
    and (recurring_income_id is null or kind = 'income')
  );

create unique index finance_transactions_bill_occurrence_unique
  on public.finance_transactions (user_id, recurring_bill_id, transaction_date)
  where recurring_bill_id is not null and status <> 'void';

create unique index finance_transactions_income_occurrence_unique
  on public.finance_transactions (user_id, recurring_income_id, transaction_date)
  where recurring_income_id is not null and status <> 'void';

comment on index public.finance_transactions_bill_occurrence_unique is
  'Prevents one bill occurrence from being recorded more than once while allowing a voided row to be replaced.';
comment on index public.finance_transactions_income_occurrence_unique is
  'Prevents one income occurrence from being recorded more than once while allowing a voided row to be replaced.';
