import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, CircleDollarSign, GraduationCap, ListChecks, Sparkles, Target } from "lucide-react";

import { CalendarItemCard } from "@/features/calendar/calendar-item-card";
import { dateForInstant } from "@/features/calendar/dates";
import { getCalendarContext, getCalendarItems } from "@/features/calendar/queries";
import { addCalendarDays } from "@/features/finance/date-ranges";
import { formatPercent } from "@/features/school/grades";
import { assessmentLocalDate, daysUntilLabel } from "@/features/school/planning";
import { getSchoolPlanning } from "@/features/school/queries";
import { getTaskSummary } from "@/features/tasks/queries";
import { taskDueLocalDate } from "@/features/tasks/task-service";
import { formatGoalPercent, summarizeGoal } from "@/features/goals/progress";
import { getGoalSummary } from "@/features/goals/queries";

export const metadata: Metadata = { title: "Dashboard" };

const moduleCards = [
  { icon: CircleDollarSign, title: "Finance", description: "Accounts, transactions, recurring schedules, budgets, analytics, and planning.", status: "Available" },
  { icon: CalendarDays, title: "Calendar", description: "Native events and projected Finance, School, Tasks, and Goals dates in one source-aware timeline.", status: "Available" },
  { icon: GraduationCap, title: "School", description: "Courses, weekly schedules, assessments, and exact grade tracking.", status: "Available" },
  { icon: ListChecks, title: "Tasks", description: "Priorities, due dates, effort, School links, and completion history.", status: "Available" },
  { icon: Target, title: "Goals", description: "Measurable outcomes, milestones, deadlines, and supporting Tasks.", status: "Available" },
];

export default async function DashboardPage() {
  const [context, school, taskData, goalData] = await Promise.all([getCalendarContext(), getSchoolPlanning(), getTaskSummary(), getGoalSummary()]);
  const user = context.user;
  const upcoming = await getCalendarItems({ start: context.today, end: addCalendarDays(context.today, 30) });
  const todayItems = upcoming.filter((item) => item.allDay ? item.start.slice(0, 10) <= context.today && (item.end ?? item.start).slice(0, 10) >= context.today : dateForInstant(item.start, context.timeZone) === context.today);
  const firstName = user.displayName?.trim().split(/\s+/)[0];
  const today = new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: context.timeZone,
  }).format(new Date());

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">{today}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Good to see you{firstName ? `, ${firstName}` : ""}.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Your workspace is ready. It will become more useful as each real module is connected.</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-xs"><span className="size-2 rounded-full bg-success" /> Foundation active</span>
      </header>

      <section aria-labelledby="today-heading" className="rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary"><Sparkles className="size-5" /></span>
          <div>
            <h2 className="font-semibold" id="today-heading">Today</h2>
            <p className="text-sm text-muted-foreground">Native events plus Finance, School, Tasks, and Goals projections for the next 30 days.</p>
          </div>
        </div>
        {upcoming.length ? <div className="mt-6 grid gap-6 lg:grid-cols-2"><div><h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Today · {todayItems.length} {todayItems.length === 1 ? "item" : "items"}</h3><div className="space-y-2">{todayItems.length ? todayItems.slice(0, 4).map((item) => <CalendarItemCard item={item} key={item.id} timeZone={context.timeZone} />) : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Nothing scheduled today.</p>}</div></div><div><h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Upcoming</h3><div className="space-y-2">{upcoming.filter((item) => !todayItems.some((todayItem) => todayItem.id === item.id)).slice(0, 4).map((item) => <CalendarItemCard item={item} key={item.id} timeZone={context.timeZone} />)}</div></div></div> : <div className="mt-6 rounded-xl border border-dashed bg-muted/45 px-5 py-8 text-center"><p className="font-medium">Nothing scheduled yet</p><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">Create a Calendar event, add a dated task, or add a recurring bill or payday in Finance. No activity is fabricated.</p></div>}
      </section>

      <section aria-labelledby="goals-heading" className="rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
        <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary"><Target className="size-5" /></span><div><h2 className="font-semibold" id="goals-heading">Goals</h2><p className="text-sm text-muted-foreground">Longer-term outcomes from the shared Goals service.</p></div></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Active goals</p><b className="text-2xl">{goalData.summary.active}</b></div><div><p className="text-xs text-muted-foreground">Overdue deadlines</p><b className={goalData.summary.overdue ? "text-2xl text-destructive" : "text-2xl"}>{goalData.summary.overdue}</b></div><div><p className="text-xs text-muted-foreground">Next deadline</p><b className="text-sm">{goalData.summary.upcomingDeadlines[0]?.deadline ?? "None scheduled"}</b></div></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{goalData.goals.filter((goal) => !goal.archived_at && goal.status === "active").slice(0, 3).map((goal) => { const summary = summarizeGoal(goal); return <Link className="rounded-xl border p-4 transition-colors hover:bg-muted/45" href={`/goals/${goal.id}`} key={goal.id}><p className="font-medium">{goal.title}</p><p className="mt-2 text-xs text-muted-foreground">{summary.progress ? formatGoalPercent(summary.progress.percent) : `${summary.milestonesCompleted} of ${summary.milestoneTotal} milestones`}{goal.deadline ? ` · Due ${goal.deadline}` : ""}</p></Link>; })}</div>
        <Link className="mt-4 inline-block text-sm font-semibold text-primary" href="/goals">Open Goals →</Link>
      </section>

      <section aria-labelledby="tasks-heading" className="rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
        <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary"><ListChecks className="size-5" /></span><div><h2 className="font-semibold" id="tasks-heading">Tasks</h2><p className="text-sm text-muted-foreground">Immediate obligations from the shared Tasks service.</p></div></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Due today</p><b className="text-2xl">{taskData.summary.dueToday}</b></div><div><p className="text-xs text-muted-foreground">Overdue</p><b className={taskData.summary.overdue ? "text-2xl text-destructive" : "text-2xl"}>{taskData.summary.overdue}</b></div><div><p className="text-xs text-muted-foreground">Active</p><b className="text-2xl">{taskData.summary.active}</b></div></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[...taskData.overdue, ...taskData.dueToday, ...taskData.upcoming].slice(0, 3).map((task) => <Link className="rounded-xl border p-4 transition-colors hover:bg-muted/45" href={`/tasks?task=${task.id}#task-${task.id}`} key={task.id}><p className="text-xs font-bold uppercase text-primary">{task.priority} priority</p><p className="mt-1 font-medium">{task.title}</p><p className="mt-2 text-xs text-muted-foreground">{taskDueLocalDate(task, taskData.timezone) ?? "No due date"}{task.assessment ? ` · ${task.assessment.courseCode}` : ""}</p></Link>)}</div>
        <Link className="mt-4 inline-block text-sm font-semibold text-primary" href="/tasks">Open Tasks →</Link>
      </section>

      <section aria-labelledby="school-heading" className="rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
        <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary"><BookOpen className="size-5" /></span><div><h2 className="font-semibold" id="school-heading">School</h2><p className="text-sm text-muted-foreground">A concise view of active coursework; assessment dates also appear above.</p></div></div>
        {school.courses.length ? <><div className="mt-5 grid gap-3 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Assessments this week</p><b className="text-2xl">{school.thisWeek.length}</b></div><div><p className="text-xs text-muted-foreground">Combined course weight</p><b className="text-2xl">{formatPercent(school.workload.combinedWeight)}</b></div><div><p className="text-xs text-muted-foreground">Next major assessment</p><b className="text-sm">{school.major[0] ? `${school.courses.find((course) => course.id === school.major[0].course_id)?.code} · ${school.major[0].name}` : "None scheduled"}</b></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{school.thisWeek.slice(0, 3).map((assessment) => { const course = school.courses.find((candidate) => candidate.id === assessment.course_id); const date = assessmentLocalDate(assessment, school.timezone); return <Link className="rounded-xl border p-4 transition-colors hover:bg-muted/45" href={`/school/courses/${assessment.course_id}#assessment-${assessment.id}`} key={assessment.id}><p className="text-sm font-bold text-primary">{course?.code}</p><p className="mt-1 truncate font-medium">{assessment.name}</p><p className="mt-2 text-sm text-muted-foreground">{assessment.weight_percent}% · {daysUntilLabel(school.today, date)}</p></Link>; })}</div><Link className="mt-4 inline-block text-sm font-semibold text-primary" href="/school/planning">Open academic planning →</Link></> : <div className="mt-5 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No active courses yet. Add an academic term and course in School when you are ready.</div>}
      </section>

      <section aria-labelledby="workspace-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold" id="workspace-heading">Your workspace</h2>
            <p className="mt-1 text-sm text-muted-foreground">A preview of the connected areas being built.</p>
          </div>
          <span className="hidden items-center gap-1 text-xs font-medium text-muted-foreground sm:flex">Built one milestone at a time <ArrowRight className="size-3.5" /></span>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {moduleCards.map(({ icon: Icon, title, description, status }) => (
            <article className="rounded-2xl border bg-card p-5 shadow-xs" key={title}>
              <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary"><Icon className="size-5" /></span>
              <div className="mt-5 flex items-center justify-between gap-3"><h3 className="font-semibold">{title}</h3><span className="rounded-full bg-muted px-2 py-1 text-[0.6875rem] font-medium text-muted-foreground">{status ?? "Coming soon"}</span></div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
