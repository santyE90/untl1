-- Finance Phase 2B: normalized monthly budgets.
-- Actual usage remains derived from posted expense ledger rows; no aggregates
-- or transaction totals are persisted in these tables.

create table public.finance_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  budget_month date not null,
  currency text not null default 'CAD',
  overall_limit numeric(19,4) not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint finance_budgets_owner_key unique (id, user_id),
  constraint finance_budgets_month_currency_key unique (user_id, budget_month, currency),
  constraint finance_budgets_month_start check (budget_month = date_trunc('month', budget_month)::date),
  constraint finance_budgets_currency_iso_shape check (currency ~ '^[A-Z]{3}$'),
  constraint finance_budgets_positive_limit check (overall_limit > 0),
  constraint finance_budgets_notes_length check (notes is null or char_length(notes) <= 2000)
);

create table public.finance_budget_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  budget_id uuid not null,
  category_id uuid not null,
  amount numeric(19,4) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint finance_budget_categories_owner_key unique (id, user_id),
  constraint finance_budget_categories_budget_category_key unique (budget_id, category_id),
  constraint finance_budget_categories_budget_owner_fk foreign key (budget_id, user_id)
    references public.finance_budgets (id, user_id) on delete cascade,
  constraint finance_budget_categories_category_owner_fk foreign key (category_id, user_id)
    references public.finance_categories (id, user_id) on delete restrict,
  constraint finance_budget_categories_positive_amount check (amount > 0)
);

comment on table public.finance_budgets is
  'One user-owned monthly spending budget per currency. Usage is always derived from posted expense transactions.';
comment on table public.finance_budget_categories is
  'Optional category limits within a monthly budget; categories without rows remain valid unbudgeted spending.';

create index finance_budgets_user_month_idx
  on public.finance_budgets (user_id, budget_month desc, currency);
create index finance_budget_categories_user_budget_idx
  on public.finance_budget_categories (user_id, budget_id);
create index finance_budget_categories_category_idx
  on public.finance_budget_categories (category_id);

create trigger finance_budgets_set_updated_at
before update on public.finance_budgets
for each row execute function private.set_updated_at();

create trigger finance_budget_categories_set_updated_at
before update on public.finance_budget_categories
for each row execute function private.set_updated_at();

alter table public.finance_budgets enable row level security;
alter table public.finance_budget_categories enable row level security;

create policy finance_budgets_select_own
  on public.finance_budgets for select to authenticated
  using ((select auth.uid()) = user_id);

create policy finance_budget_categories_select_own
  on public.finance_budget_categories for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.finance_budgets, public.finance_budget_categories
  from anon, authenticated;
grant select on table public.finance_budgets, public.finance_budget_categories
  to authenticated;

create or replace function public.save_monthly_finance_budget(
  budget_month date,
  budget_currency text,
  overall_amount numeric,
  budget_notes text default null,
  category_limits jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  saved_budget_id uuid;
  category_entry record;
  parsed_category_id uuid;
  parsed_amount numeric;
  supplied_category_ids uuid[] := '{}'::uuid[];
begin
  if owner_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if budget_month is null or budget_month <> date_trunc('month', budget_month)::date then
    raise exception 'Budget month must be the first day of a month' using errcode = '22023';
  end if;
  budget_currency := upper(btrim(budget_currency));
  if budget_currency !~ '^[A-Z]{3}$' then
    raise exception 'Budget currency must be a three-letter code' using errcode = '22023';
  end if;
  if overall_amount is null or overall_amount <= 0 or overall_amount <> round(overall_amount, 4) then
    raise exception 'Overall budget must be positive with at most four decimal places' using errcode = '22023';
  end if;
  if budget_notes is not null and char_length(budget_notes) > 2000 then
    raise exception 'Budget notes cannot exceed 2000 characters' using errcode = '22023';
  end if;
  if category_limits is null or jsonb_typeof(category_limits) <> 'object' then
    raise exception 'Category limits must be a JSON object' using errcode = '22023';
  end if;

  insert into public.finance_budgets
    (user_id, budget_month, currency, overall_limit, notes)
  values
    (owner_id, budget_month, budget_currency, overall_amount, nullif(btrim(budget_notes), ''))
  on conflict (user_id, budget_month, currency)
  do update set overall_limit = excluded.overall_limit, notes = excluded.notes
  returning id into saved_budget_id;

  for category_entry in select key, value from jsonb_each_text(category_limits)
  loop
    begin
      parsed_category_id := category_entry.key::uuid;
      parsed_amount := category_entry.value::numeric;
    exception when others then
      raise exception 'Every category limit requires a UUID key and numeric value' using errcode = '22023';
    end;

    if parsed_amount <= 0 or parsed_amount <> round(parsed_amount, 4) then
      raise exception 'Category limits must be positive with at most four decimal places' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.finance_categories
      where id = parsed_category_id
        and user_id = owner_id
        and category_type in ('expense', 'both')
        and (
          archived_at is null
          or exists (
            select 1 from public.finance_budget_categories
            where budget_id = saved_budget_id
              and user_id = owner_id
              and category_id = parsed_category_id
          )
        )
    ) then
      raise exception 'Budget categories must be active expense categories you own' using errcode = '42501';
    end if;

    supplied_category_ids := array_append(supplied_category_ids, parsed_category_id);

    insert into public.finance_budget_categories
      (user_id, budget_id, category_id, amount)
    values
      (owner_id, saved_budget_id, parsed_category_id, parsed_amount)
    on conflict (budget_id, category_id)
    do update set amount = excluded.amount;
  end loop;

  delete from public.finance_budget_categories
  where budget_id = saved_budget_id
    and user_id = owner_id
    and not (category_id = any(supplied_category_ids));

  return saved_budget_id;
end;
$$;

revoke all on function public.save_monthly_finance_budget(date, text, numeric, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_monthly_finance_budget(date, text, numeric, text, jsonb)
  to authenticated;
