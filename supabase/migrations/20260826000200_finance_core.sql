-- Finance Core Phase 2A
-- Money is stored as numeric(19,4). Transaction amounts are signed effects on
-- an account: positive increases its ledger balance; negative decreases it.

create table public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  account_type text not null,
  custom_type_name text,
  institution text,
  currency text not null default 'CAD',
  opening_balance numeric(19,4) not null default 0,
  opening_balance_date date not null default current_date,
  credit_limit numeric(19,4),
  include_in_net_worth boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint finance_accounts_owner_key unique (id, user_id),
  constraint finance_accounts_name_length check (char_length(btrim(name)) between 1 and 80),
  constraint finance_accounts_type check (
    account_type in ('chequing', 'savings', 'credit_card', 'cash', 'investment', 'other')
  ),
  constraint finance_accounts_custom_type check (
    (account_type = 'other' and custom_type_name is not null and char_length(btrim(custom_type_name)) between 1 and 40)
    or (account_type <> 'other' and custom_type_name is null)
  ),
  constraint finance_accounts_institution_length check (
    institution is null or char_length(btrim(institution)) between 1 and 100
  ),
  constraint finance_accounts_currency_iso_shape check (currency ~ '^[A-Z]{3}$'),
  constraint finance_accounts_credit_limit check (
    (account_type = 'credit_card' and (credit_limit is null or credit_limit > 0))
    or (account_type <> 'credit_card' and credit_limit is null)
  )
);

comment on table public.finance_accounts is
  'User-owned financial accounts. A credit-card balance is negative when money is owed.';

create table public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  default_key text,
  name text not null,
  category_type text not null,
  icon text,
  display_color text,
  is_default boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint finance_categories_owner_key unique (id, user_id),
  constraint finance_categories_name_length check (char_length(btrim(name)) between 1 and 60),
  constraint finance_categories_type check (category_type in ('expense', 'income', 'both')),
  constraint finance_categories_default_shape check (
    (is_default and default_key is not null and default_key ~ '^[a-z0-9_]+$')
    or (not is_default and default_key is null)
  ),
  constraint finance_categories_icon_length check (icon is null or char_length(icon) between 1 and 40),
  constraint finance_categories_color_shape check (
    display_color is null or display_color ~ '^#[0-9A-Fa-f]{6}$'
  )
);

create unique index finance_categories_default_key_unique
  on public.finance_categories (user_id, default_key)
  where default_key is not null;
create unique index finance_categories_active_name_unique
  on public.finance_categories (user_id, lower(name))
  where archived_at is null;

create table public.finance_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source_account_id uuid not null,
  destination_account_id uuid not null,
  amount numeric(19,4) not null,
  currency text not null,
  transfer_date date not null,
  description text,
  notes text,
  created_at timestamptz not null default now(),

  constraint finance_transfers_owner_key unique (id, user_id),
  constraint finance_transfers_source_owner_fk foreign key (source_account_id, user_id)
    references public.finance_accounts (id, user_id) on delete restrict,
  constraint finance_transfers_destination_owner_fk foreign key (destination_account_id, user_id)
    references public.finance_accounts (id, user_id) on delete restrict,
  constraint finance_transfers_distinct_accounts check (source_account_id <> destination_account_id),
  constraint finance_transfers_positive_amount check (amount > 0),
  constraint finance_transfers_currency_iso_shape check (currency ~ '^[A-Z]{3}$'),
  constraint finance_transfers_description_length check (
    description is null or char_length(btrim(description)) between 1 and 160
  )
);

create table public.recurring_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  expected_amount numeric(19,4) not null,
  currency text not null default 'CAD',
  account_id uuid not null,
  category_id uuid not null,
  frequency text not null,
  anchor_date date not null,
  next_due_date date not null,
  reminder_days smallint not null default 3,
  autopay boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint recurring_bills_owner_key unique (id, user_id),
  constraint recurring_bills_account_owner_fk foreign key (account_id, user_id)
    references public.finance_accounts (id, user_id) on delete restrict,
  constraint recurring_bills_category_owner_fk foreign key (category_id, user_id)
    references public.finance_categories (id, user_id) on delete restrict,
  constraint recurring_bills_name_length check (char_length(btrim(name)) between 1 and 100),
  constraint recurring_bills_positive_amount check (expected_amount > 0),
  constraint recurring_bills_currency_iso_shape check (currency ~ '^[A-Z]{3}$'),
  constraint recurring_bills_frequency check (frequency in ('weekly', 'biweekly', 'monthly', 'yearly')),
  constraint recurring_bills_reminder_days check (reminder_days between 0 and 365)
);

create table public.recurring_income (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  expected_amount numeric(19,4) not null,
  currency text not null default 'CAD',
  destination_account_id uuid not null,
  category_id uuid,
  frequency text not null,
  anchor_date date not null,
  next_payday date not null,
  reminder_days smallint not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint recurring_income_owner_key unique (id, user_id),
  constraint recurring_income_account_owner_fk foreign key (destination_account_id, user_id)
    references public.finance_accounts (id, user_id) on delete restrict,
  constraint recurring_income_category_owner_fk foreign key (category_id, user_id)
    references public.finance_categories (id, user_id) on delete restrict,
  constraint recurring_income_name_length check (char_length(btrim(name)) between 1 and 100),
  constraint recurring_income_positive_amount check (expected_amount > 0),
  constraint recurring_income_currency_iso_shape check (currency ~ '^[A-Z]{3}$'),
  constraint recurring_income_frequency check (frequency in ('weekly', 'biweekly', 'monthly', 'yearly')),
  constraint recurring_income_reminder_days check (reminder_days between 0 and 365)
);

create table public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  account_id uuid not null,
  category_id uuid,
  transfer_id uuid,
  recurring_bill_id uuid,
  recurring_income_id uuid,
  amount numeric(19,4) not null,
  kind text not null,
  status text not null default 'posted',
  transaction_date date not null,
  merchant text,
  description text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint finance_transactions_owner_key unique (id, user_id),
  constraint finance_transactions_account_owner_fk foreign key (account_id, user_id)
    references public.finance_accounts (id, user_id) on delete restrict,
  constraint finance_transactions_category_owner_fk foreign key (category_id, user_id)
    references public.finance_categories (id, user_id) on delete restrict,
  constraint finance_transactions_transfer_owner_fk foreign key (transfer_id, user_id)
    references public.finance_transfers (id, user_id) on delete restrict,
  constraint finance_transactions_bill_owner_fk foreign key (recurring_bill_id, user_id)
    references public.recurring_bills (id, user_id) on delete restrict,
  constraint finance_transactions_income_owner_fk foreign key (recurring_income_id, user_id)
    references public.recurring_income (id, user_id) on delete restrict,
  constraint finance_transactions_nonzero_amount check (amount <> 0),
  constraint finance_transactions_kind check (kind in ('expense', 'income', 'transfer', 'adjustment')),
  constraint finance_transactions_status check (status in ('pending', 'posted', 'void')),
  constraint finance_transactions_direction check (
    (kind = 'expense' and amount < 0)
    or (kind = 'income' and amount > 0)
    or kind in ('transfer', 'adjustment')
  ),
  constraint finance_transactions_transfer_shape check (
    (kind = 'transfer' and transfer_id is not null and category_id is null)
    or (kind <> 'transfer' and transfer_id is null)
  ),
  constraint finance_transactions_category_required check (
    kind not in ('expense', 'income') or category_id is not null
  ),
  constraint finance_transactions_recurring_source check (
    not (recurring_bill_id is not null and recurring_income_id is not null)
  ),
  constraint finance_transactions_merchant_length check (
    merchant is null or char_length(btrim(merchant)) between 1 and 120
  ),
  constraint finance_transactions_description_length check (
    description is null or char_length(btrim(description)) between 1 and 160
  )
);

create index finance_accounts_user_active_idx on public.finance_accounts (user_id, archived_at);
create index finance_transactions_account_date_idx
  on public.finance_transactions (account_id, transaction_date desc, created_at desc);
create index finance_transactions_user_date_idx
  on public.finance_transactions (user_id, transaction_date desc, created_at desc);
create index finance_transactions_category_date_idx
  on public.finance_transactions (category_id, transaction_date desc)
  where category_id is not null;
create index finance_transactions_transfer_idx on public.finance_transactions (transfer_id)
  where transfer_id is not null;
create index finance_transfers_user_date_idx on public.finance_transfers (user_id, transfer_date desc);
create index recurring_bills_user_due_idx on public.recurring_bills (user_id, is_active, next_due_date);
create index recurring_income_user_payday_idx on public.recurring_income (user_id, is_active, next_payday);

comment on table public.finance_transactions is
  'Auditable signed account effects. Only posted rows contribute to balances; deletion is replaced by void status.';
comment on table public.finance_transfers is
  'Immutable transfer header. public.create_finance_transfer atomically creates this row and its two ledger effects.';
comment on table public.recurring_bills is
  'Authoritative bill schedule; Calendar will project these dates rather than duplicate rows.';
comment on table public.recurring_income is
  'Authoritative income schedule; Calendar will project these dates rather than duplicate rows.';

create or replace function private.seed_finance_categories(target_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.finance_categories
    (user_id, default_key, name, category_type, icon, display_color, is_default)
  values
    (target_user_id, 'rent', 'Rent', 'expense', 'house', '#9865A9', true),
    (target_user_id, 'groceries', 'Groceries', 'expense', 'shopping-basket', '#2F7F84', true),
    (target_user_id, 'restaurants', 'Restaurants', 'expense', 'utensils', '#D08A2F', true),
    (target_user_id, 'utilities', 'Utilities', 'expense', 'bolt', '#5879B8', true),
    (target_user_id, 'internet', 'Internet', 'expense', 'wifi', '#5879B8', true),
    (target_user_id, 'phone', 'Phone', 'expense', 'smartphone', '#5879B8', true),
    (target_user_id, 'transportation', 'Transportation', 'expense', 'bus', '#2F7F84', true),
    (target_user_id, 'gas', 'Gas', 'expense', 'fuel', '#D08A2F', true),
    (target_user_id, 'entertainment', 'Entertainment', 'expense', 'ticket', '#B976CE', true),
    (target_user_id, 'shopping', 'Shopping', 'expense', 'shopping-bag', '#B976CE', true),
    (target_user_id, 'school', 'School', 'expense', 'graduation-cap', '#5879B8', true),
    (target_user_id, 'subscriptions', 'Subscriptions', 'expense', 'repeat', '#9865A9', true),
    (target_user_id, 'health', 'Health', 'expense', 'heart-pulse', '#16794B', true),
    (target_user_id, 'travel', 'Travel', 'expense', 'plane', '#2F7F84', true),
    (target_user_id, 'salary_income', 'Salary / Income', 'income', 'wallet-cards', '#16794B', true),
    (target_user_id, 'other', 'Other', 'both', 'circle-ellipsis', '#655F68', true)
  on conflict (user_id, default_key) where default_key is not null do nothing;
$$;

revoke all on function private.seed_finance_categories(uuid) from public, anon, authenticated;

create or replace function private.handle_new_finance_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.seed_finance_categories(new.id);
  return new;
end;
$$;

revoke all on function private.handle_new_finance_profile() from public, anon, authenticated;

create trigger profiles_seed_finance_categories
after insert on public.profiles
for each row execute function private.handle_new_finance_profile();

select private.seed_finance_categories(id) from public.profiles;

create or replace function private.validate_finance_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_opened date;
  account_archived timestamptz;
  selected_category_type text;
  category_archived timestamptz;
begin
  select opening_balance_date, archived_at into account_opened, account_archived
  from public.finance_accounts
  where id = new.account_id and user_id = new.user_id;

  if account_opened is null then
    raise exception 'Account is unavailable' using errcode = '23503';
  end if;
  if new.transaction_date < account_opened then
    raise exception 'Transaction date cannot precede the account opening balance date'
      using errcode = '23514';
  end if;
  if account_archived is not null
     and (tg_op = 'INSERT' or new.account_id is distinct from old.account_id) then
    raise exception 'New activity requires an active account' using errcode = '23514';
  end if;

  if new.category_id is not null then
    select category_type, archived_at into selected_category_type, category_archived
    from public.finance_categories
    where id = new.category_id and user_id = new.user_id;

    if category_archived is not null
       and (tg_op = 'INSERT' or new.category_id is distinct from old.category_id) then
      raise exception 'New activity requires an active category' using errcode = '23514';
    end if;

    if new.kind = 'expense' and selected_category_type not in ('expense', 'both') then
      raise exception 'Expense requires an expense-compatible category' using errcode = '23514';
    elsif new.kind = 'income' and selected_category_type not in ('income', 'both') then
      raise exception 'Income requires an income-compatible category' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.validate_finance_transaction() from public, anon, authenticated;

create trigger finance_transactions_validate
before insert or update on public.finance_transactions
for each row execute function private.validate_finance_transaction();

create or replace function private.validate_recurring_bill()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_currency text;
  selected_category_type text;
begin
  select currency into account_currency from public.finance_accounts
  where id = new.account_id and user_id = new.user_id;
  select category_type into selected_category_type from public.finance_categories
  where id = new.category_id and user_id = new.user_id;

  if account_currency is null or account_currency <> new.currency then
    raise exception 'Bill currency must match its account' using errcode = '23514';
  end if;
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
  selected_category_type text;
begin
  select currency into account_currency from public.finance_accounts
  where id = new.destination_account_id and user_id = new.user_id;

  if account_currency is null or account_currency <> new.currency then
    raise exception 'Income currency must match its account' using errcode = '23514';
  end if;
  if new.category_id is not null then
    select category_type into selected_category_type from public.finance_categories
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

create trigger recurring_bills_validate before insert or update on public.recurring_bills
for each row execute function private.validate_recurring_bill();
create trigger recurring_income_validate before insert or update on public.recurring_income
for each row execute function private.validate_recurring_income();

create trigger finance_accounts_set_updated_at before update on public.finance_accounts
for each row execute function private.set_updated_at();
create trigger finance_categories_set_updated_at before update on public.finance_categories
for each row execute function private.set_updated_at();
create trigger finance_transactions_set_updated_at before update on public.finance_transactions
for each row execute function private.set_updated_at();
create trigger recurring_bills_set_updated_at before update on public.recurring_bills
for each row execute function private.set_updated_at();
create trigger recurring_income_set_updated_at before update on public.recurring_income
for each row execute function private.set_updated_at();

alter table public.finance_accounts enable row level security;
alter table public.finance_categories enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.finance_transfers enable row level security;
alter table public.recurring_bills enable row level security;
alter table public.recurring_income enable row level security;

create policy finance_accounts_select_own on public.finance_accounts for select to authenticated
  using ((select auth.uid()) = user_id);
create policy finance_accounts_insert_own on public.finance_accounts for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy finance_accounts_update_own on public.finance_accounts for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy finance_categories_select_own on public.finance_categories for select to authenticated
  using ((select auth.uid()) = user_id);
create policy finance_categories_insert_custom on public.finance_categories for insert to authenticated
  with check ((select auth.uid()) = user_id and not is_default and default_key is null);
create policy finance_categories_update_own on public.finance_categories for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy finance_transactions_select_own on public.finance_transactions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy finance_transactions_insert_own_non_transfer on public.finance_transactions for insert to authenticated
  with check ((select auth.uid()) = user_id and kind <> 'transfer' and transfer_id is null);
create policy finance_transactions_update_own_non_transfer on public.finance_transactions for update to authenticated
  using ((select auth.uid()) = user_id and kind <> 'transfer')
  with check ((select auth.uid()) = user_id and kind <> 'transfer' and transfer_id is null);

create policy finance_transfers_select_own on public.finance_transfers for select to authenticated
  using ((select auth.uid()) = user_id);

create policy recurring_bills_select_own on public.recurring_bills for select to authenticated
  using ((select auth.uid()) = user_id);
create policy recurring_bills_insert_own on public.recurring_bills for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy recurring_bills_update_own on public.recurring_bills for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy recurring_income_select_own on public.recurring_income for select to authenticated
  using ((select auth.uid()) = user_id);
create policy recurring_income_insert_own on public.recurring_income for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy recurring_income_update_own on public.recurring_income for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on table public.finance_accounts, public.finance_categories,
  public.finance_transactions, public.finance_transfers, public.recurring_bills,
  public.recurring_income from anon, authenticated;

grant select on table public.finance_accounts, public.finance_categories,
  public.finance_transactions, public.finance_transfers, public.recurring_bills,
  public.recurring_income to authenticated;

grant insert (user_id, name, account_type, custom_type_name, institution, currency,
  opening_balance, opening_balance_date, credit_limit, include_in_net_worth)
  on public.finance_accounts to authenticated;
grant update (name, account_type, custom_type_name, institution, credit_limit,
  include_in_net_worth, archived_at) on public.finance_accounts to authenticated;

grant insert (user_id, name, category_type, icon, display_color)
  on public.finance_categories to authenticated;
grant update (name, category_type, icon, display_color, archived_at)
  on public.finance_categories to authenticated;

grant insert (user_id, account_id, category_id, recurring_bill_id,
  recurring_income_id, amount, kind, status, transaction_date, merchant,
  description, notes) on public.finance_transactions to authenticated;
grant update (account_id, category_id, recurring_bill_id, recurring_income_id,
  amount, kind, status, transaction_date, merchant, description, notes)
  on public.finance_transactions to authenticated;

grant insert (user_id, name, expected_amount, currency, account_id, category_id,
  frequency, anchor_date, next_due_date, reminder_days, autopay, is_active)
  on public.recurring_bills to authenticated;
grant update (name, expected_amount, account_id, category_id, frequency,
  anchor_date, next_due_date, reminder_days, autopay, is_active)
  on public.recurring_bills to authenticated;

grant insert (user_id, name, expected_amount, currency, destination_account_id,
  category_id, frequency, anchor_date, next_payday, reminder_days, is_active)
  on public.recurring_income to authenticated;
grant update (name, expected_amount, destination_account_id, category_id,
  frequency, anchor_date, next_payday, reminder_days, is_active)
  on public.recurring_income to authenticated;

create or replace function public.create_finance_transfer(
  source_account uuid,
  destination_account uuid,
  transfer_amount numeric,
  occurred_on date,
  transfer_description text default null,
  transfer_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  source_row public.finance_accounts%rowtype;
  destination_row public.finance_accounts%rowtype;
  created_transfer_id uuid;
begin
  if owner_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if source_account = destination_account then
    raise exception 'Transfer accounts must be different' using errcode = '22023';
  end if;
  if transfer_amount is null or transfer_amount <= 0
     or transfer_amount <> round(transfer_amount, 4) then
    raise exception 'Transfer amount must be positive with at most four decimal places'
      using errcode = '22023';
  end if;
  if occurred_on is null then
    raise exception 'Transfer date is required' using errcode = '22023';
  end if;

  select * into source_row from public.finance_accounts
  where id = source_account and user_id = owner_id and archived_at is null;
  select * into destination_row from public.finance_accounts
  where id = destination_account and user_id = owner_id and archived_at is null;

  if source_row.id is null or destination_row.id is null then
    raise exception 'Both transfer accounts must be active accounts you own' using errcode = '42501';
  end if;
  if source_row.currency <> destination_row.currency then
    raise exception 'Currency conversion is not supported' using errcode = '22023';
  end if;
  if occurred_on < source_row.opening_balance_date
     or occurred_on < destination_row.opening_balance_date then
    raise exception 'Transfer date cannot precede either account opening date' using errcode = '22023';
  end if;

  insert into public.finance_transfers
    (user_id, source_account_id, destination_account_id, amount, currency,
     transfer_date, description, notes)
  values
    (owner_id, source_account, destination_account, transfer_amount,
     source_row.currency, occurred_on, nullif(btrim(transfer_description), ''),
     nullif(btrim(transfer_notes), ''))
  returning id into created_transfer_id;

  insert into public.finance_transactions
    (user_id, account_id, transfer_id, amount, kind, status,
     transaction_date, description, notes)
  values
    (owner_id, source_account, created_transfer_id, -transfer_amount,
     'transfer', 'posted', occurred_on,
     nullif(btrim(transfer_description), ''), nullif(btrim(transfer_notes), '')),
    (owner_id, destination_account, created_transfer_id, transfer_amount,
     'transfer', 'posted', occurred_on,
     nullif(btrim(transfer_description), ''), nullif(btrim(transfer_notes), ''));

  return created_transfer_id;
end;
$$;

revoke all on function public.create_finance_transfer(uuid, uuid, numeric, date, text, text)
  from public, anon, authenticated;
grant execute on function public.create_finance_transfer(uuid, uuid, numeric, date, text, text)
  to authenticated;

create view public.finance_account_balances
with (security_invoker = true)
as
select
  accounts.id,
  accounts.user_id,
  accounts.name,
  accounts.account_type,
  accounts.currency,
  accounts.opening_balance,
  accounts.opening_balance_date,
  accounts.include_in_net_worth,
  accounts.archived_at,
  (accounts.opening_balance + coalesce(sum(transactions.amount)
    filter (where transactions.status = 'posted'), 0))::numeric(19,4) as current_balance
from public.finance_accounts as accounts
left join public.finance_transactions as transactions
  on transactions.account_id = accounts.id
group by accounts.id;

comment on view public.finance_account_balances is
  'Reusable RLS-aware derived balance: opening balance plus posted signed ledger effects.';
revoke all on table public.finance_account_balances from public, anon, authenticated;
grant select on table public.finance_account_balances to authenticated;
