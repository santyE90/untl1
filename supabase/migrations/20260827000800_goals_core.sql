-- Goals Phase 5B: owned goals, exact manual progress, lightweight milestones,
-- optional Task linkage, lifecycle normalization, RLS, and least privilege.

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  category text not null default 'personal',
  status text not null default 'active',
  deadline date,
  progress_mode text not null default 'none',
  current_value numeric(20,4),
  target_value numeric(20,4),
  unit_label text,
  current_value_decimal text generated always as (current_value::text) stored,
  target_value_decimal text generated always as (target_value::text) stored,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (char_length(btrim(title)) between 1 and 200),
  check (description is null or char_length(description) <= 10000),
  check (category in ('finance', 'school', 'career', 'personal', 'health_fitness', 'project', 'other')),
  check (status in ('active', 'completed')),
  check (progress_mode in ('none', 'percentage', 'numeric')),
  check (current_value is null or current_value >= 0),
  check (target_value is null or target_value > 0),
  check (unit_label is null or char_length(btrim(unit_label)) between 1 and 40),
  check (
    (progress_mode = 'none' and current_value is null and target_value is null and unit_label is null)
    or (progress_mode = 'percentage' and current_value is not null and target_value is null and unit_label is null)
    or (progress_mode = 'numeric' and current_value is not null and target_value is not null)
  ),
  check ((status = 'completed' and completed_at is not null) or (status = 'active' and completed_at is null))
);

create table public.goal_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  goal_id uuid not null,
  title text not null,
  description text,
  target_date date,
  sort_order integer not null default 0,
  is_completed boolean not null default false,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (goal_id, user_id) references public.goals(id, user_id) on delete restrict,
  check (char_length(btrim(title)) between 1 and 200),
  check (description is null or char_length(description) <= 5000),
  check (sort_order between 0 and 1000000),
  check ((is_completed and completed_at is not null) or (not is_completed and completed_at is null))
);

alter table public.tasks add column goal_id uuid;
alter table public.tasks
  add constraint tasks_goal_id_user_id_fkey
  foreign key (goal_id, user_id) references public.goals(id, user_id) on delete restrict;

create index goals_user_lifecycle_idx on public.goals(user_id, archived_at, status, deadline);
create index goals_user_deadline_idx on public.goals(user_id, deadline)
  where archived_at is null and status = 'active' and deadline is not null;
create index goal_milestones_goal_sort_idx on public.goal_milestones(user_id, goal_id, archived_at, sort_order, created_at);
create index tasks_goal_idx on public.tasks(user_id, goal_id) where goal_id is not null;

create or replace function private.normalize_goal_lifecycle()
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

create or replace function private.normalize_goal_milestone_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_completed then
    if tg_op = 'INSERT' or old.is_completed is distinct from true or new.completed_at is null then
      new.completed_at := now();
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

revoke all on function private.normalize_goal_lifecycle() from public, anon, authenticated;
revoke all on function private.normalize_goal_milestone_lifecycle() from public, anon, authenticated;

create trigger goals_normalize_lifecycle
  before insert or update of status on public.goals
  for each row execute function private.normalize_goal_lifecycle();
create trigger goals_updated
  before update on public.goals
  for each row execute function private.set_updated_at();
create trigger goal_milestones_normalize_lifecycle
  before insert or update of is_completed on public.goal_milestones
  for each row execute function private.normalize_goal_milestone_lifecycle();
create trigger goal_milestones_updated
  before update on public.goal_milestones
  for each row execute function private.set_updated_at();

alter table public.goals enable row level security;
alter table public.goal_milestones enable row level security;

create policy goals_own on public.goals
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy goal_milestones_own on public.goal_milestones
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.goals from public, anon, authenticated;
revoke all on public.goal_milestones from public, anon, authenticated;
grant select on public.goals to authenticated;
grant select on public.goal_milestones to authenticated;
grant insert(user_id, title, description, category, status, deadline, progress_mode, current_value, target_value, unit_label) on public.goals to authenticated;
grant update(title, description, category, status, deadline, progress_mode, current_value, target_value, unit_label, archived_at) on public.goals to authenticated;
grant insert(user_id, goal_id, title, description, target_date, sort_order, is_completed) on public.goal_milestones to authenticated;
grant update(title, description, target_date, sort_order, is_completed, archived_at) on public.goal_milestones to authenticated;
grant insert(goal_id) on public.tasks to authenticated;
grant update(goal_id) on public.tasks to authenticated;
