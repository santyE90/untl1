-- Tasks Phase 5A: owned non-recurring tasks with exact due-date shapes,
-- lifecycle normalization, optional School linkage, RLS, and least privilege.

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo',
  priority text not null default 'medium',
  due_date date,
  due_at timestamptz,
  estimated_effort_minutes integer,
  assessment_id uuid,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (assessment_id, user_id) references public.assessments(id, user_id) on delete restrict,
  check (char_length(btrim(title)) between 1 and 200),
  check (description is null or char_length(description) <= 10000),
  check (status in ('todo', 'in_progress', 'completed')),
  check (priority in ('low', 'medium', 'high', 'urgent')),
  check (not (due_date is not null and due_at is not null)),
  check (estimated_effort_minutes is null or estimated_effort_minutes between 1 and 100000),
  check ((status = 'completed' and completed_at is not null) or (status <> 'completed' and completed_at is null))
);

create index tasks_user_active_sort_idx
  on public.tasks(user_id, archived_at, status, priority, created_at);
create index tasks_user_due_date_idx
  on public.tasks(user_id, due_date) where archived_at is null and due_date is not null;
create index tasks_user_due_at_idx
  on public.tasks(user_id, due_at) where archived_at is null and due_at is not null;
create index tasks_assessment_idx
  on public.tasks(user_id, assessment_id) where assessment_id is not null;

create or replace function private.normalize_task_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' then
    if tg_op = 'INSERT' or old.status is distinct from 'completed' or new.completed_at is null then
      new.completed_at := now();
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

revoke all on function private.normalize_task_lifecycle() from public, anon, authenticated;

create trigger tasks_normalize_lifecycle
  before insert or update of status on public.tasks
  for each row execute function private.normalize_task_lifecycle();
create trigger tasks_updated
  before update on public.tasks
  for each row execute function private.set_updated_at();

alter table public.tasks enable row level security;
create policy tasks_own on public.tasks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.tasks from public, anon, authenticated;
grant select on public.tasks to authenticated;
grant insert(user_id, title, description, status, priority, due_date, due_at, estimated_effort_minutes, assessment_id) on public.tasks to authenticated;
grant update(title, description, status, priority, due_date, due_at, estimated_effort_minutes, assessment_id, archived_at) on public.tasks to authenticated;
