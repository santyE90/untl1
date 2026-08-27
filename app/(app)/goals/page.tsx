import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CheckCircle2, Target } from "lucide-react";

import { GoalForm } from "@/features/goals/goal-form";
import { formatGoalCategory, formatGoalPercent, sortGoals, summarizeGoal } from "@/features/goals/progress";
import { getGoals } from "@/features/goals/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Goals" };
const filters = [["active", "Active"], ["completed", "Completed"], ["archived", "Archived"]] as const;

export default async function GoalsPage({ searchParams }: { searchParams: Promise<{ filter?: string; error?: string; success?: string }> }) {
  const query = await searchParams;
  const data = await getGoals();
  const filter = filters.some(([value]) => value === query.filter) ? query.filter! : "active";
  const goals = sortGoals(data.goals.filter((goal) => filter === "archived" ? Boolean(goal.archived_at) : !goal.archived_at && goal.status === filter));
  return <div className="space-y-7">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-primary">LifeStack Goals</p><h1 className="mt-1 text-3xl font-bold sm:text-4xl">Goals</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Longer-term outcomes with explicit progress, lightweight milestones, and supporting Tasks.</p></div><a className="rounded-lg bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-foreground" href="#new-goal">Create goal</a></header>
    {query.error ? <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{query.error}</p> : null}{query.success ? <p className="rounded-lg bg-success/10 p-3 text-sm text-success">{query.success}</p> : null}
    <nav aria-label="Goal filters" className="flex gap-2 overflow-x-auto pb-1">{filters.map(([value, label]) => <Link className={cn("rounded-full px-4 py-2 text-sm font-semibold", filter === value ? "bg-primary text-primary-foreground" : "border bg-card")} href={`/goals?filter=${value}`} key={value}>{label}</Link>)}</nav>
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{goals.length ? goals.map((goal) => { const summary = summarizeGoal(goal); const percentage = summary.progress ? Number(formatGoalPercent(summary.progress.percent).replace("%", "")) : 0; return <Link className="rounded-2xl border bg-card p-5 shadow-sm transition-colors hover:border-primary/50" href={`/goals/${goal.id}`} key={goal.id}><div className="flex items-start justify-between gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary"><Target className="size-5" /></span><span className="rounded-full bg-muted px-2 py-1 text-[0.6875rem] font-bold uppercase">{formatGoalCategory(goal.category)}</span></div><h2 className="mt-4 text-lg font-bold">{goal.title}</h2>{summary.progressSummary ? <><p className="mt-3 text-sm font-semibold text-primary">{summary.progressSummary}</p><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, percentage)}%` }} /></div>{summary.progress?.exceeded ? <p className="mt-1 text-xs font-semibold text-success">Target exceeded</p> : null}</> : <p className="mt-3 text-sm text-muted-foreground">No measured progress configured</p>}<div className="mt-4 space-y-1 text-xs text-muted-foreground"><p className="flex items-center gap-1"><CheckCircle2 className="size-3.5" />{summary.milestonesCompleted} of {summary.milestoneTotal} milestones complete</p><p>{summary.openTasks} open related {summary.openTasks === 1 ? "task" : "tasks"}</p>{goal.deadline ? <p className="flex items-center gap-1"><CalendarDays className="size-3.5" />Deadline {goal.deadline}</p> : <p>No deadline</p>}</div></Link>; }) : <div className="rounded-2xl border border-dashed bg-card p-8 text-center md:col-span-2 xl:col-span-3"><p className="font-semibold">No {filter} goals</p><p className="mt-1 text-sm text-muted-foreground">Create only the outcomes you genuinely want to track.</p></div>}</section>
    <section className="rounded-2xl border bg-card p-5 shadow-sm" id="new-goal"><details open={!data.goals.length}><summary className="cursor-pointer text-lg font-bold">Create goal</summary><p className="mt-1 text-sm text-muted-foreground">Goal completion always remains an explicit decision.</p><div className="mt-4"><GoalForm /></div></details></section>
  </div>;
}
