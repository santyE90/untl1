import "server-only";

import { getCalendarItems } from "@/features/calendar/queries";
import { getGoalSummary } from "@/features/goals/queries";
import { getSchoolPlanning } from "@/features/school/queries";
import { addCalendarDays, type DateRange } from "@/features/shared/date-ranges";
import { getAuthenticatedAppContext, type AuthenticatedAppContext } from "@/features/shared/server-context";
import { getTaskSummary } from "@/features/tasks/queries";
import { summarizeCalendarOverview } from "./summary";

export async function getUpcomingOverview(range: DateRange, suppliedContext?: AuthenticatedAppContext) {
  const context = suppliedContext ?? await getAuthenticatedAppContext();
  const items = await getCalendarItems(range, context);
  return summarizeCalendarOverview(items, range, context.today, context.timeZone);
}

export async function getTodayOverview(suppliedContext?: AuthenticatedAppContext) {
  const context = suppliedContext ?? await getAuthenticatedAppContext();
  const overview = await getUpcomingOverview({ start: context.today, end: context.today }, context);
  return { ...overview, date: context.today };
}

export async function getDashboardOverview() {
  const context = await getAuthenticatedAppContext();
  const schoolPromise = getSchoolPlanning(undefined, context);
  const goalsPromise = getGoalSummary(context);
  const upcomingPromise = getUpcomingOverview({ start: context.today, end: addCalendarDays(context.today, 29) }, context);
  const school = await schoolPromise;
  const tasksPromise = getTaskSummary({ context, school });
  const [goals, upcoming, tasks] = await Promise.all([goalsPromise, upcomingPromise, tasksPromise]);
  return { context, school, goals, tasks, upcoming, todayItems: upcoming.todayItems };
}
