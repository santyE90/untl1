-- School Phase 4A: academic hierarchy, weekly meeting sources, assessments,
-- exact grade inputs, and private ownership. Calendar occurrences are projected.

create table public.academic_terms (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null, academic_year text, start_date date not null, end_date date not null,
  archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id,user_id), check (char_length(btrim(name)) between 1 and 100), check (start_date <= end_date),
  check (academic_year is null or char_length(btrim(academic_year)) between 1 and 30)
);
create table public.courses (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  term_id uuid not null, code text not null, name text not null, instructor text, section text, location text,
  course_url text, notes text, color_key text not null default 'plum', target_grade numeric(7,4),
  archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id,user_id), foreign key(term_id,user_id) references public.academic_terms(id,user_id) on delete restrict,
  check(char_length(btrim(code)) between 1 and 30), check(char_length(btrim(name)) between 1 and 160),
  check(color_key in ('plum','blue','teal','amber','rose','slate')),
  check(target_grade is null or (target_grade >= 0 and target_grade <= 100))
);
create table public.course_meetings (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null, meeting_type text not null default 'lecture', weekday smallint not null,
  start_time time not null, end_time time not null, timezone text not null, location text,
  effective_start_date date not null, effective_end_date date not null, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id,user_id), foreign key(course_id,user_id) references public.courses(id,user_id) on delete cascade,
  check(meeting_type in ('lecture','tutorial','lab','seminar','other')), check(weekday between 0 and 6),
  check(start_time < end_time), check(effective_start_date <= effective_end_date),
  check(char_length(btrim(timezone)) between 1 and 100)
);
create table public.assessments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null, name text not null, assessment_type text not null, timing_type text not null,
  due_at timestamptz, starts_at timestamptz, ends_at timestamptz, event_date date,
  weight_percent numeric(7,4) not null, score_earned numeric(12,4), score_max numeric(12,4),
  status text not null default 'upcoming', location text, notes text, archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id,user_id), foreign key(course_id,user_id) references public.courses(id,user_id) on delete restrict,
  check(char_length(btrim(name)) between 1 and 160),
  check(assessment_type in ('assignment','quiz','midterm','final_exam','project','lab','participation','presentation','other')),
  check(timing_type in ('deadline','scheduled','all_day')),
  check((timing_type='deadline' and due_at is not null and starts_at is null and ends_at is null and event_date is null)
    or (timing_type='scheduled' and starts_at is not null and ends_at is not null and ends_at > starts_at and due_at is null and event_date is null)
    or (timing_type='all_day' and event_date is not null and due_at is null and starts_at is null and ends_at is null)),
  check(weight_percent > 0 and weight_percent <= 100),
  check((score_earned is null and score_max is null) or (score_earned is not null and score_max > 0 and score_earned >= 0 and score_earned <= score_max)),
  check(status in ('upcoming','submitted','graded','missed','exempt')),
  check(status <> 'graded' or (score_earned is not null and score_max is not null))
);

create index academic_terms_user_dates_idx on public.academic_terms(user_id,start_date,end_date);
create index courses_user_term_idx on public.courses(user_id,term_id,archived_at);
create index course_meetings_course_active_idx on public.course_meetings(course_id,is_active,effective_start_date,effective_end_date);
create index assessments_user_course_idx on public.assessments(user_id,course_id,archived_at);
create index assessments_user_due_idx on public.assessments(user_id,due_at) where archived_at is null;

create or replace function private.validate_school_child_dates() returns trigger language plpgsql security definer set search_path='' as $$
declare term_start date; term_end date;
begin
  select t.start_date,t.end_date into term_start,term_end from public.courses c join public.academic_terms t on t.id=c.term_id and t.user_id=c.user_id where c.id=new.course_id and c.user_id=new.user_id;
  if term_start is null then raise exception 'Course is unavailable' using errcode='23503'; end if;
  if tg_table_name='course_meetings' and (new.effective_start_date < term_start or new.effective_end_date > term_end) then raise exception 'Meeting dates must remain within the academic term' using errcode='23514'; end if;
  return new;
end; $$;
revoke all on function private.validate_school_child_dates() from public,anon,authenticated;
create trigger course_meetings_validate before insert or update on public.course_meetings for each row execute function private.validate_school_child_dates();

create or replace function private.validate_school_container_dates() returns trigger language plpgsql security definer set search_path='' as $$
declare target_start date; target_end date;
begin
  if tg_table_name = 'academic_terms' then
    if exists (
      select 1 from public.courses c join public.course_meetings m on m.course_id = c.id and m.user_id = c.user_id
      where c.term_id = new.id and c.user_id = new.user_id
        and (m.effective_start_date < new.start_date or m.effective_end_date > new.end_date)
    ) then raise exception 'Term dates cannot exclude an existing meeting schedule' using errcode='23514'; end if;
  elsif new.term_id is distinct from old.term_id then
    select start_date, end_date into target_start, target_end from public.academic_terms where id = new.term_id and user_id = new.user_id;
    if exists (
      select 1 from public.course_meetings m where m.course_id = new.id and m.user_id = new.user_id
        and (m.effective_start_date < target_start or m.effective_end_date > target_end)
    ) then raise exception 'Move or pause meeting schedules before changing this course term' using errcode='23514'; end if;
  end if;
  return new;
end; $$;
revoke all on function private.validate_school_container_dates() from public,anon,authenticated;
create trigger academic_terms_validate_dates before update of start_date,end_date on public.academic_terms for each row execute function private.validate_school_container_dates();
create trigger courses_validate_term before update of term_id on public.courses for each row execute function private.validate_school_container_dates();

create trigger academic_terms_updated before update on public.academic_terms for each row execute function private.set_updated_at();
create trigger courses_updated before update on public.courses for each row execute function private.set_updated_at();
create trigger course_meetings_updated before update on public.course_meetings for each row execute function private.set_updated_at();
create trigger assessments_updated before update on public.assessments for each row execute function private.set_updated_at();

alter table public.academic_terms enable row level security; alter table public.courses enable row level security;
alter table public.course_meetings enable row level security; alter table public.assessments enable row level security;
create policy academic_terms_own on public.academic_terms for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy courses_own on public.courses for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy course_meetings_own on public.course_meetings for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy assessments_own on public.assessments for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);

revoke all on public.academic_terms,public.courses,public.course_meetings,public.assessments from public,anon,authenticated;
grant select on public.academic_terms,public.courses,public.course_meetings,public.assessments to authenticated;
grant insert(user_id,name,academic_year,start_date,end_date) on public.academic_terms to authenticated;
grant update(name,academic_year,start_date,end_date,archived_at) on public.academic_terms to authenticated;
grant insert(user_id,term_id,code,name,instructor,section,location,course_url,notes,color_key,target_grade) on public.courses to authenticated;
grant update(term_id,code,name,instructor,section,location,course_url,notes,color_key,target_grade,archived_at) on public.courses to authenticated;
grant insert(user_id,course_id,meeting_type,weekday,start_time,end_time,timezone,location,effective_start_date,effective_end_date,is_active) on public.course_meetings to authenticated;
grant update(meeting_type,weekday,start_time,end_time,timezone,location,effective_start_date,effective_end_date,is_active) on public.course_meetings to authenticated;
grant insert(user_id,course_id,name,assessment_type,timing_type,due_at,starts_at,ends_at,event_date,weight_percent,score_earned,score_max,status,location,notes) on public.assessments to authenticated;
grant update(name,assessment_type,timing_type,due_at,starts_at,ends_at,event_date,weight_percent,score_earned,score_max,status,location,notes,archived_at) on public.assessments to authenticated;
