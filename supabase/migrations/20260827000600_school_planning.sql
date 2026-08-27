-- School Phase 4B: transparent workload inputs, course-resource links,
-- and parent-aware archive restoration. No derived planning rows are stored.

alter table public.assessments
  add column estimated_effort_minutes integer,
  add constraint assessments_estimated_effort_check
    check (estimated_effort_minutes is null or estimated_effort_minutes between 1 and 100000);

create table public.course_resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null,
  label text not null,
  url text not null,
  resource_type text not null default 'other',
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (course_id, user_id) references public.courses(id, user_id) on delete cascade,
  check (char_length(btrim(label)) between 1 and 100),
  check (char_length(url) between 8 and 2048 and url ~* '^https?://'),
  check (resource_type in ('course_website','lms','syllabus','textbook','repository','lecture_notes','other')),
  check (sort_order between 0 and 10000)
);

create index course_resources_course_order_idx
  on public.course_resources(user_id, course_id, archived_at, sort_order, created_at);

create trigger course_resources_updated
  before update on public.course_resources
  for each row execute function private.set_updated_at();

alter table public.course_resources enable row level security;
create policy course_resources_own on public.course_resources
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.course_resources from public, anon, authenticated;
grant select on public.course_resources to authenticated;
grant insert(user_id, course_id, label, url, resource_type, sort_order) on public.course_resources to authenticated;
grant update(label, url, resource_type, sort_order, archived_at) on public.course_resources to authenticated;
grant update(estimated_effort_minutes) on public.assessments to authenticated;

create or replace function private.validate_school_restore()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.archived_at is not null and new.archived_at is null then
    if tg_table_name = 'courses' and exists (
      select 1 from public.academic_terms t
      where t.id = new.term_id and t.user_id = new.user_id and t.archived_at is not null
    ) then
      raise exception 'Restore the academic term before restoring this course' using errcode = '23514';
    elsif tg_table_name = 'assessments' and exists (
      select 1
      from public.courses c
      join public.academic_terms t on t.id = c.term_id and t.user_id = c.user_id
      where c.id = new.course_id and c.user_id = new.user_id
        and (c.archived_at is not null or t.archived_at is not null)
    ) then
      raise exception 'Restore the parent term and course before restoring this assessment' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.validate_school_restore() from public, anon, authenticated;

create trigger courses_validate_restore
  before update of archived_at on public.courses
  for each row execute function private.validate_school_restore();

create trigger assessments_validate_restore
  before update of archived_at on public.assessments
  for each row execute function private.validate_school_restore();

