import type { CalendarItem } from "../calendar/types";
import type { TaskWithContext } from "./types";

export function taskToCalendarItem(task: TaskWithContext): CalendarItem | null {
  if (task.archived_at || task.status === "completed" || (!task.due_date && !task.due_at)) return null;
  const allDay = Boolean(task.due_date);
  const start = task.due_date ?? task.due_at!;
  return {
    id: `task:${task.id}`,
    sourceType: "task",
    sourceId: task.id,
    title: task.title,
    start,
    end: start,
    allDay,
    category: "Tasks",
    type: `${task.priority} priority task`,
    description: `${task.status.replaceAll("_", " ")}${task.assessment ? ` · ${task.assessment.courseCode} · ${task.assessment.name}` : ""}${task.goal ? ` · Goal: ${task.goal.title}` : ""}${task.description ? ` · ${task.description}` : ""}`,
    location: null,
    amount: null,
    currency: null,
    isEditable: false,
    sourceUrl: `/tasks?task=${task.id}#task-${task.id}`,
    recurrence: null,
    reminderOffsets: [],
    metadata: { priority: task.priority, status: task.status, assessmentId: task.assessment_id, goalId: task.goal_id },
  };
}
