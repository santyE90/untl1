import { dateForInstant } from "../calendar/dates";
import type { TaskRecord } from "./types";

const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export function taskDueLocalDate(task: Pick<TaskRecord, "due_date" | "due_at">, timezone: string) {
  return task.due_date ?? (task.due_at ? dateForInstant(task.due_at, timezone) : null);
}

export type TaskBucket = "overdue" | "today" | "upcoming" | "no_due_date" | "completed";

export function taskBucket(task: Pick<TaskRecord, "status" | "due_date" | "due_at">, today: string, timezone: string): TaskBucket {
  if (task.status === "completed") return "completed";
  const date = taskDueLocalDate(task, timezone);
  if (!date) return "no_due_date";
  if (date < today) return "overdue";
  if (date === today) return "today";
  return "upcoming";
}

export function sortTasks<T extends TaskRecord>(tasks: T[], today: string, timezone: string): T[] {
  const bucketOrder: Record<TaskBucket, number> = { overdue: 0, today: 1, upcoming: 2, no_due_date: 3, completed: 4 };
  return [...tasks].sort((a, b) => {
    const bucketDifference = bucketOrder[taskBucket(a, today, timezone)] - bucketOrder[taskBucket(b, today, timezone)];
    if (bucketDifference) return bucketDifference;
    if (a.status === "completed" && b.status === "completed") return (b.completed_at ?? b.updated_at).localeCompare(a.completed_at ?? a.updated_at);
    const aDate = taskDueLocalDate(a, timezone) ?? "9999-12-31";
    const bDate = taskDueLocalDate(b, timezone) ?? "9999-12-31";
    const dateDifference = aDate.localeCompare(bDate);
    if (dateDifference) return dateDifference;
    const priorityDifference = (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
    return priorityDifference || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
  });
}

export function filterTasks<T extends TaskRecord>(tasks: T[], filter: string, today: string, timezone: string): T[] {
  const sorted = sortTasks(tasks, today, timezone);
  if (filter === "all") return sorted.filter((task) => task.status !== "completed");
  if (filter === "completed") return sorted.filter((task) => task.status === "completed");
  if (filter === "today") return sorted.filter((task) => taskBucket(task, today, timezone) === "today");
  if (filter === "overdue") return sorted.filter((task) => taskBucket(task, today, timezone) === "overdue");
  if (filter === "upcoming") return sorted.filter((task) => taskBucket(task, today, timezone) === "upcoming");
  if (filter === "no_due_date") return sorted.filter((task) => taskBucket(task, today, timezone) === "no_due_date");
  return sorted.filter((task) => task.status !== "completed");
}

export function summarizeTasks(tasks: TaskRecord[], today: string, timezone: string) {
  const counts = { active: 0, dueToday: 0, overdue: 0, upcoming: 0, noDueDate: 0, completed: 0 };
  for (const task of tasks) {
    const bucket = taskBucket(task, today, timezone);
    if (bucket === "completed") counts.completed += 1;
    else {
      counts.active += 1;
      if (bucket === "today") counts.dueToday += 1;
      else if (bucket === "overdue") counts.overdue += 1;
      else if (bucket === "upcoming") counts.upcoming += 1;
      else counts.noDueDate += 1;
    }
  }
  return counts;
}

export function formatEffort(minutes: number | null) {
  if (minutes === null) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}
