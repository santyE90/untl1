-- Focused V1 usability corrections: persisted appearance, atomic School meeting
-- replacement, and narrowly scoped permanent deletion functions.

alter table public.profiles
  add column theme_preference text not null default 'system'
  constraint profiles_theme_preference_valid
    check (theme_preference in ('system', 'light', 'dark'));

grant update (theme_preference) on public.profiles to authenticated;

comment on column public.profiles.theme_preference is
  'Persisted appearance preference. System resolves against the current device color scheme.';

create or replace function public.replace_course_meetings(
  owned_course_id uuid,
  meeting_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  inserted_count integer;
begin
  if owner_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if meeting_rows is null or jsonb_typeof(meeting_rows) <> 'array'
     or jsonb_array_length(meeting_rows) > 35 then
    raise exception 'Meeting schedule must be an array of at most 35 rows' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.courses
    where id = owned_course_id and user_id = owner_id and archived_at is null
  ) then
    raise exception 'Course not found' using errcode = '42501';
  end if;

  -- Parsing and replacement occur in this single transaction. Any invalid row
  -- rolls back the delete as well as every insert.
  delete from public.course_meetings
  where course_id = owned_course_id and user_id = owner_id;

  insert into public.course_meetings (
    user_id, course_id, meeting_type, weekday, start_time, end_time,
    timezone, location, effective_start_date, effective_end_date, is_active
  )
  select
    owner_id,
    owned_course_id,
    row.meeting_type,
    row.weekday,
    row.start_time,
    row.end_time,
    row.timezone,
    nullif(btrim(row.location), ''),
    row.effective_start_date,
    row.effective_end_date,
    coalesce(row.is_active, true)
  from jsonb_to_recordset(meeting_rows) as row(
    meeting_type text,
    weekday smallint,
    start_time time,
    end_time time,
    timezone text,
    location text,
    effective_start_date date,
    effective_end_date date,
    is_active boolean
  );

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.replace_course_meetings(uuid, jsonb) from public, anon;
grant execute on function public.replace_course_meetings(uuid, jsonb) to authenticated;

create or replace function public.delete_empty_school_term(owned_term_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if exists (select 1 from public.courses where term_id = owned_term_id and user_id = owner_id) then
    raise exception 'Archive this term instead because it still contains courses' using errcode = '23503';
  end if;
  delete from public.academic_terms where id = owned_term_id and user_id = owner_id;
  if not found then raise exception 'Term not found' using errcode = 'P0002'; end if;
end; $$;

create or replace function public.delete_empty_school_course(owned_course_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if exists (select 1 from public.assessments where course_id = owned_course_id and user_id = owner_id)
     or exists (select 1 from public.course_meetings where course_id = owned_course_id and user_id = owner_id)
     or exists (select 1 from public.course_resources where course_id = owned_course_id and user_id = owner_id) then
    raise exception 'Archive this course instead because it still contains School records' using errcode = '23503';
  end if;
  delete from public.courses where id = owned_course_id and user_id = owner_id;
  if not found then raise exception 'Course not found' using errcode = 'P0002'; end if;
end; $$;

create or replace function public.delete_unused_finance_account(owned_account_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if exists (select 1 from public.finance_transactions where account_id = owned_account_id and user_id = owner_id)
     or exists (select 1 from public.finance_transfers where user_id = owner_id and (source_account_id = owned_account_id or destination_account_id = owned_account_id))
     or exists (select 1 from public.recurring_bills where account_id = owned_account_id and user_id = owner_id)
     or exists (select 1 from public.recurring_income where destination_account_id = owned_account_id and user_id = owner_id) then
    raise exception 'Archive this account instead because it has financial history or schedules' using errcode = '23503';
  end if;
  delete from public.finance_accounts where id = owned_account_id and user_id = owner_id;
  if not found then raise exception 'Account not found' using errcode = 'P0002'; end if;
end; $$;

create or replace function public.delete_recurring_bill(owned_bill_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  update public.finance_transactions set recurring_bill_id = null
    where recurring_bill_id = owned_bill_id and user_id = owner_id;
  delete from public.recurring_bills where id = owned_bill_id and user_id = owner_id;
  if not found then raise exception 'Recurring bill not found' using errcode = 'P0002'; end if;
end; $$;

create or replace function public.delete_recurring_income(owned_income_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  update public.finance_transactions set recurring_income_id = null
    where recurring_income_id = owned_income_id and user_id = owner_id;
  delete from public.recurring_income where id = owned_income_id and user_id = owner_id;
  if not found then raise exception 'Recurring income not found' using errcode = 'P0002'; end if;
end; $$;

revoke all on function public.delete_empty_school_term(uuid) from public, anon;
revoke all on function public.delete_empty_school_course(uuid) from public, anon;
revoke all on function public.delete_unused_finance_account(uuid) from public, anon;
revoke all on function public.delete_recurring_bill(uuid) from public, anon;
revoke all on function public.delete_recurring_income(uuid) from public, anon;
grant execute on function public.delete_empty_school_term(uuid) to authenticated;
grant execute on function public.delete_empty_school_course(uuid) to authenticated;
grant execute on function public.delete_unused_finance_account(uuid) to authenticated;
grant execute on function public.delete_recurring_bill(uuid) to authenticated;
grant execute on function public.delete_recurring_income(uuid) to authenticated;
