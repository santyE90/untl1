import type { CalendarItem } from "../calendar/types";
import { formatGoalCategory, goalProgressSummary } from "./progress";
import type { GoalRecord } from "./types";

export function goalToCalendarItem(goal: GoalRecord): CalendarItem | null {
  if (goal.archived_at || goal.status === "completed" || !goal.deadline) return null;
  const progress = goalProgressSummary(goal);
  return {
    id: `goal:${goal.id}`,
    sourceType: "goal",
    sourceId: goal.id,
    title: goal.title,
    start: goal.deadline,
    end: goal.deadline,
    allDay: true,
    category: formatGoalCategory(goal.category),
    type: "Goal deadline",
    description: progress ? `${formatGoalCategory(goal.category)} · ${progress}` : formatGoalCategory(goal.category),
    location: null,
    amount: null,
    currency: null,
    isEditable: false,
    sourceUrl: `/goals/${goal.id}`,
    recurrence: null,
    reminderOffsets: [],
    metadata: { category: goal.category, status: goal.status, progressMode: goal.progress_mode },
  };
}
