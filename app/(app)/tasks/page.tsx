import type { Metadata } from "next";
import Link from "next/link";
import { Archive, CalendarClock, Check, Circle, Play, RotateCcw } from "lucide-react";

import { formatCalendarDate, formatCalendarTime, instantToLocalInput } from "@/features/calendar/dates";
import { archiveTask, setTaskStatus } from "@/features/tasks/actions";
import { getTasks } from "@/features/tasks/queries";
import { filterTasks, formatEffort, taskBucket, taskDueLocalDate } from "@/features/tasks/task-service";
import { TaskForm } from "@/features/tasks/task-form";
import type { TaskWithContext } from "@/features/tasks/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tasks" };
const filters = [["all", "All"], ["today", "Today"], ["upcoming", "Upcoming"], ["overdue", "Overdue"], ["no_due_date", "No date"], ["completed", "Completed"]] as const;

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ filter?: string; error?: string; success?: string; assessment?: string; goal?: string; task?: string }> }) {
  const query = await searchParams;
  const data = await getTasks();
  const filter = filters.some(([value]) => value === query.filter) ? query.filter! : "all";
  const tasks = filterTasks(data.tasks, filter, data.today, data.timezone);
  const assessmentOptions = data.assessmentOptions.map((option) => ({ id: option.id, name: option.name, courseCode: option.course!.code }));
  const goalOptions = data.goalOptions.map((goal) => ({ id: goal.id, title: goal.title }));
  const prefill = data.assessmentOptions.find((option) => option.id === query.assessment);
  const prefillTimed = prefill?.dueAt ?? prefill?.startsAt;
  const prefillGoal = data.goalOptions.find((goal) => goal.id === query.goal);
  const prefillDefaults = { ...(prefill ? { title: `Work on ${prefill.course!.code} · ${prefill.name}`, assessmentId: prefill.id, dueKind: prefill.eventDate ? "date" : prefillTimed ? "timed" : "none", dueDate: prefill.eventDate ?? "", dueLocal: prefillTimed ? instantToLocalInput(prefillTimed, data.timezone) : "" } : {}), ...(prefillGoal ? { goalId: prefillGoal.id } : {}) };

  return <div className="space-y-7">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-primary">LifeStack Tasks</p><h1 className="mt-1 text-3xl font-bold sm:text-4xl">Tasks</h1><p className="mt-2 text-sm text-muted-foreground">Focused work with explicit priority, due dates, effort, and optional School context.</p></div><a className="rounded-lg bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-foreground" href="#new-task">Create task</a></header>
    {query.error ? <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{query.error}</p> : null}{query.success ? <p className="rounded-lg bg-success/10 p-3 text-sm text-success">{query.success}</p> : null}
    <nav aria-label="Task filters" className="flex gap-2 overflow-x-auto pb-1">{filters.map(([value, label]) => <Link className={cn("whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold", filter === value ? "bg-primary text-primary-foreground" : "border bg-card")} href={`/tasks?filter=${value}`} key={value}>{label}</Link>)}</nav>
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Summary label="Active" value={data.tasks.filter((task) => task.status !== "completed").length} /><Summary label="Due today" value={filterTasks(data.tasks, "today", data.today, data.timezone).length} /><Summary label="Overdue" value={filterTasks(data.tasks, "overdue", data.today, data.timezone).length} danger /><Summary label="Completed" value={filterTasks(data.tasks, "completed", data.today, data.timezone).length} /></section>
    <section aria-label={`${filter} tasks`} className="space-y-3">{tasks.length ? tasks.map((task) => <TaskCard assessmentOptions={assessmentOptions} goalOptions={goalOptions} highlighted={query.task === task.id} key={task.id} task={task} timezone={data.timezone} today={data.today} />) : <div className="rounded-2xl border border-dashed bg-card p-8 text-center"><p className="font-semibold">No tasks in this view</p><p className="mt-1 text-sm text-muted-foreground">LifeStack does not invent tasks or due dates.</p></div>}</section>
    <section className="rounded-2xl border bg-card p-5 shadow-sm" id="new-task"><details open={Boolean(prefill || prefillGoal) || !data.tasks.length}><summary className="cursor-pointer text-lg font-bold">Create task</summary><p className="mt-1 text-sm text-muted-foreground">Date-only work remains tied to its calendar date; timed work uses your profile timezone.</p><div className="mt-4"><TaskForm assessments={assessmentOptions} defaults={prefillDefaults} goals={goalOptions} /></div></details></section>
  </div>;
}

function Summary({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) { return <div className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className={cn("mt-1 text-2xl font-bold", danger && value ? "text-destructive" : "")}>{value}</p></div>; }

function TaskCard({ task, today, timezone, assessmentOptions, goalOptions, highlighted }: { task: TaskWithContext; today: string; timezone: string; assessmentOptions: { id: string; name: string; courseCode: string }[]; goalOptions: { id: string; title: string }[]; highlighted: boolean }) {
  const bucket = taskBucket(task, today, timezone);
  const dueDate = taskDueLocalDate(task, timezone);
  const dueText = task.due_at ? `${formatCalendarDate(dueDate!)} at ${formatCalendarTime(task.due_at, timezone)}` : task.due_date ? formatCalendarDate(task.due_date) : "No due date";
  const dueKind = task.due_date ? "date" : task.due_at ? "timed" : "none";
  return <article className={cn("rounded-2xl border bg-card p-5 shadow-sm", highlighted && "ring-2 ring-primary")} id={`task-${task.id}`}>
    <div className="flex items-start gap-3"><span className={cn("mt-1 size-2.5 shrink-0 rounded-full", task.priority === "urgent" ? "bg-destructive" : task.priority === "high" ? "bg-amber-500" : task.priority === "medium" ? "bg-primary" : "bg-muted-foreground")} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className={cn("font-semibold", task.status === "completed" && "text-muted-foreground line-through")}>{task.title}</h2><span className="rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] font-bold uppercase">{task.priority}</span><span className="rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium capitalize">{task.status.replaceAll("_", " ")}</span></div><p className={cn("mt-1 flex flex-wrap items-center gap-1 text-xs", bucket === "overdue" ? "font-semibold text-destructive" : "text-muted-foreground")}><CalendarClock className="size-3.5" />{dueText}{bucket === "overdue" ? " · Overdue" : bucket === "today" ? " · Due today" : ""}{formatEffort(task.estimated_effort_minutes) ? ` · ${formatEffort(task.estimated_effort_minutes)} estimated` : ""}</p>{task.assessment ? <p className="mt-1 text-xs text-primary">Assessment: {task.assessment.courseCode} · {task.assessment.name}</p> : null}{task.goal ? <Link className="mt-1 block text-xs font-semibold text-primary hover:underline" href={`/goals/${task.goal.id}`}>Goal: {task.goal.title}</Link> : null}{task.description ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{task.description}</p> : null}</div></div>
    <div className="mt-4 flex flex-wrap gap-2">{task.status !== "completed" ? <><StatusButton icon={task.status === "todo" ? Play : Circle} id={task.id} label={task.status === "todo" ? "Start" : "Move to todo"} status={task.status === "todo" ? "in_progress" : "todo"} /><StatusButton icon={Check} id={task.id} label="Complete" status="completed" /></> : <StatusButton icon={RotateCcw} id={task.id} label="Reopen" status="todo" />}<details className="rounded-lg border px-3 py-1.5"><summary className="cursor-pointer text-xs font-semibold">Edit</summary><div className="mt-3 min-w-[min(38rem,75vw)]"><TaskForm assessments={assessmentOptions} defaults={{ id: task.id, title: task.title, description: task.description, status: task.status, priority: task.priority, dueKind, dueDate: task.due_date ?? "", dueLocal: task.due_at ? instantToLocalInput(task.due_at, timezone) : "", estimatedEffortMinutes: task.estimated_effort_minutes === null ? "" : String(task.estimated_effort_minutes), assessmentId: task.assessment_id, goalId: task.goal_id }} goals={goalOptions} /></div></details><form action={archiveTask}><input name="id" type="hidden" value={task.id} /><button className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-destructive"><Archive className="size-3.5" />Archive</button></form></div>
  </article>;
}

function StatusButton({ id, status, label, icon: Icon }: { id: string; status: string; label: string; icon: typeof Check }) { return <form action={setTaskStatus}><input name="id" type="hidden" value={id} /><input name="status" type="hidden" value={status} /><button className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold"><Icon className="size-3.5" />{label}</button></form>; }
