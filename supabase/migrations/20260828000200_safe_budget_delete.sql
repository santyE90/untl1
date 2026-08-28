-- Monthly budgets are plans rather than ledger history. Allow an owned budget
-- and its cascading category allocations to be removed explicitly.

create or replace function public.delete_finance_budget(owned_budget_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare owner_id uuid := auth.uid();
begin
  if owner_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  delete from public.finance_budgets
  where id = owned_budget_id and user_id = owner_id;
  if not found then
    raise exception 'Budget not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.delete_finance_budget(uuid) from public, anon;
grant execute on function public.delete_finance_budget(uuid) to authenticated;
