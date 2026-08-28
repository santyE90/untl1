import "server-only";

import type { FunctionTool } from "openai/resources/responses/responses";
import { z } from "zod";
import type { AssistantReference } from "../contracts";
import { assistantLimits } from "../limits";

import { getCalendarItems } from "@/features/calendar/queries";
import type { CalendarItem } from "@/features/calendar/types";
import { getFinanceAnalytics } from "@/features/finance/analytics-queries";
import { moneyToDecimal } from "@/features/finance/money";
import { getCashFlowForecast } from "@/features/finance/planning-queries";
import { getAccountBalances } from "@/features/finance/queries";
import { goalExactToDecimal, summarizeGoal } from "@/features/goals/progress";
import { getGoals } from "@/features/goals/queries";
import { getTodayOverview } from "@/features/overview/queries";
import { exactToString } from "@/features/school/grades";
import { getSchoolOverview, getUpcomingAssessments } from "@/features/school/queries";
import { addCalendarDays } from "@/features/shared/date-ranges";
import type { AuthenticatedAppContext } from "@/features/shared/server-context";
import { filterTasks, taskDueLocalDate } from "@/features/tasks/task-service";
import { getTasks } from "@/features/tasks/queries";
import { trustedReference } from "./references";

const emptySchema = z.object({}).strict();
const daysSchema = z.object({ days: z.number().int().min(1).max(90) }).strict();
const entitySchema = z.object({ id: z.string().uuid() }).strict();
const forecastSchema = z.object({ horizon: z.enum(["7", "30", "60", "90", "month"]) }).strict();
const taskSchema = z.object({ filter: z.enum(["all", "active", "today", "upcoming", "overdue", "completed"]) }).strict();
const goalsSchema = z.object({ status: z.enum(["all", "active", "completed"]) }).strict();

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false });
const noArgs = objectSchema({});
const daysArgs = objectSchema({ days: { type: "integer", minimum: 1, maximum: 90, description: "Number of local calendar days to include, starting today." } }, ["days"]);
const idArgs = (description: string) => objectSchema({ id: { type: "string", description } }, ["id"]);

export const assistantToolDefinitions: FunctionTool[] = [
  { type: "function", name: "get_today_overview", description: "Returns today's cross-module LifeStack events and obligations in the user's timezone.", parameters: noArgs, strict: true },
  { type: "function", name: "get_upcoming_calendar", description: "Returns normalized Calendar items across Native, Finance, School, Tasks, and Goals for a bounded upcoming period.", parameters: daysArgs, strict: true },
  { type: "function", name: "get_finance_summary", description: "Returns concise current account balances, net worth, income, expenses, and cash flow grouped by currency.", parameters: noArgs, strict: true },
  { type: "function", name: "get_upcoming_bills", description: "Returns scheduled bill occurrences in a bounded upcoming period.", parameters: daysArgs, strict: true },
  { type: "function", name: "get_cash_flow_projection", description: "Returns LifeStack's deterministic known cash-flow projection for a supported horizon, including through the end of this month.", parameters: objectSchema({ horizon: { type: "string", enum: ["7", "30", "60", "90", "month"], description: "Forecast horizon in days or through the current month end." } }, ["horizon"]), strict: true },
  { type: "function", name: "get_courses", description: "Returns concise active academic course metadata and authoritative standing values.", parameters: noArgs, strict: true },
  { type: "function", name: "get_upcoming_assessments", description: "Returns open School assessments in a bounded upcoming period.", parameters: daysArgs, strict: true },
  { type: "function", name: "get_assessments", description: "Returns a bounded list of existing assessments in active School courses, including exact scores and statuses, for unambiguous lookup before a proposed change.", parameters: noArgs, strict: true },
  { type: "function", name: "get_course_standing", description: "Returns authoritative exact grade and target-standing calculations for one owned course.", parameters: idArgs("Owned course ID returned by a LifeStack read tool."), strict: true },
  { type: "function", name: "get_tasks", description: "Returns the user's Tasks using a simple lifecycle or due-date filter.", parameters: objectSchema({ filter: { type: "string", enum: ["all", "active", "today", "upcoming", "overdue", "completed"] } }, ["filter"]), strict: true },
  { type: "function", name: "get_tasks_due_today", description: "Returns active Tasks due on the user's current local date.", parameters: noArgs, strict: true },
  { type: "function", name: "get_overdue_tasks", description: "Returns active Tasks whose local due date is before today.", parameters: noArgs, strict: true },
  { type: "function", name: "get_goals", description: "Returns concise owned Goals and progress summaries using a lifecycle filter.", parameters: objectSchema({ status: { type: "string", enum: ["all", "active", "completed"] } }, ["status"]), strict: true },
  { type: "function", name: "get_goal_progress", description: "Returns authoritative manual progress, milestones, and related Task counts for one owned Goal.", parameters: idArgs("Owned Goal ID returned by a LifeStack read tool."), strict: true },
  { type: "function", name: "get_upcoming_goal_deadlines", description: "Returns active Goal deadlines in a bounded upcoming period.", parameters: daysArgs, strict: true },
];

export type AssistantToolName = (typeof assistantToolDefinitions)[number]["name"];
export type ToolResult = { ok: true; data: unknown; references?: AssistantReference[] } | { ok: false; error: { code: string; message: string } };

function capped<T>(items: T[], limit: number) {
  return { items: items.slice(0, limit), totalAvailable: items.length, truncated: items.length > limit };
}

function refs(references: AssistantReference[]) {
  return references.flatMap((reference) => trustedReference(reference) ?? []);
}

function calendarReference(item: CalendarItem): AssistantReference {
  const type = item.sourceType === "native" ? "calendar" : item.sourceType === "bill" || item.sourceType === "income" ? "finance" : item.sourceType === "course_meeting" ? "course" : item.sourceType;
  return { type, id: item.sourceId, label: item.title, href: item.sourceUrl } as AssistantReference;
}

function calendarItem(item: CalendarItem) {
  return { id: item.id, sourceType: item.sourceType, sourceId: item.sourceId, title: item.title, start: item.start, end: item.end, allDay: item.allDay, type: item.type, amount: item.amount, currency: item.currency, metadata: item.metadata };
}

function taskItem(task: Awaited<ReturnType<typeof getTasks>>["tasks"][number], timezone: string) {
  return { id: task.id, title: task.title, status: task.status, priority: task.priority, dueDate: task.due_date, dueAt: task.due_at, dueLocalDate: taskDueLocalDate(task, timezone), estimatedEffortMinutes: task.estimated_effort_minutes, assessment: task.assessment, goal: task.goal };
}

function goalItem(goal: Awaited<ReturnType<typeof getGoals>>["goals"][number]) {
  const summary = summarizeGoal(goal);
  return { id: goal.id, title: goal.title, category: goal.category, status: goal.status, deadline: goal.deadline, progressMode: goal.progress_mode, currentValue: goal.current_value_decimal, targetValue: goal.target_value_decimal, unit: goal.unit_label, progressPercent: summary.progress ? goalExactToDecimal(summary.progress.percent) : null, milestones: { completed: summary.milestonesCompleted, total: summary.milestoneTotal }, tasks: { completed: summary.tasksCompleted, open: summary.openTasks, total: summary.taskTotal } };
}

function safeError(code: string, message: string): ToolResult { return { ok: false, error: { code, message } }; }

export async function executeAssistantTool(name: string, rawArguments: string, context: AuthenticatedAppContext): Promise<ToolResult> {
  try {
    const input: unknown = JSON.parse(rawArguments || "{}");
    if (name === "get_today_overview") {
      emptySchema.parse(input);
      const data = await getTodayOverview(context);
      const result = capped(data.items, assistantLimits.itemCaps.calendar);
      return { ok: true, data: { date: data.date, timeZone: data.timeZone, countsBySource: data.countsBySource, items: result.items.map(calendarItem), totalAvailable: result.totalAvailable, truncated: result.truncated }, references: refs(result.items.map(calendarReference)) };
    }
    if (name === "get_upcoming_calendar") {
      const { days } = daysSchema.parse(input); const range = { start: context.today, end: addCalendarDays(context.today, days - 1) };
      const result = capped(await getCalendarItems(range, context), assistantLimits.itemCaps.calendar);
      return { ok: true, data: { range, timeZone: context.timeZone, items: result.items.map(calendarItem), totalAvailable: result.totalAvailable, truncated: result.truncated }, references: refs(result.items.map(calendarReference)) };
    }
    if (name === "get_finance_summary") {
      emptySchema.parse(input);
      const [accounts, analytics] = await Promise.all([getAccountBalances(context), getFinanceAnalytics(undefined, context)]);
      const activeAccounts = accounts.filter((account) => !account.archivedAt); const result = capped(activeAccounts, assistantLimits.itemCaps.accounts);
      return { ok: true, data: { month: analytics.month, accounts: result.items.map((account) => ({ id: account.id, name: account.name, accountType: account.accountType, currency: account.currency, currentBalance: account.currentBalance, includeInNetWorth: account.includeInNetWorth })), totalAvailable: result.totalAvailable, truncated: result.truncated, netWorth: analytics.netWorth.map((item) => ({ currency: item.currency, amount: moneyToDecimal(item.amount) })), byCurrency: analytics.current.byCurrency.map((item) => ({ currency: item.currency, income: moneyToDecimal(item.income), expenses: moneyToDecimal(item.expenses), netCashFlow: moneyToDecimal(item.netCashFlow) })) }, references: refs([{ type: "finance", id: "finance-overview", label: "Open Finance", href: "/finance" }]) };
    }
    if (name === "get_upcoming_bills" || name === "get_cash_flow_projection") {
      const forecast = name === "get_cash_flow_projection"
        ? await getCashFlowForecast(forecastSchema.parse(input).horizon, undefined, context)
        : await getCashFlowForecast("custom", addCalendarDays(context.today, daysSchema.parse(input).days - 1), context);
      if (name === "get_upcoming_bills") { const result = capped(forecast.timeline.filter((entry) => entry.type === "bill"), assistantLimits.itemCaps.bills); return { ok: true, data: { range: forecast.range, bills: result.items.map((entry) => ({ id: entry.occurrenceId, sourceId: entry.sourceId, name: entry.name, date: entry.date, amount: moneyToDecimal(-entry.amount), currency: entry.currency, accountId: entry.accountId })), totalAvailable: result.totalAvailable, truncated: result.truncated }, references: refs([{ type: "finance", id: "finance-bills", label: "View Finance planning", href: "/finance/planning" }]) }; }
      return { ok: true, data: { range: forecast.range, liquidity: forecast.liquidity.map((item) => ({ currency: item.currency, current: moneyToDecimal(item.current), projected: moneyToDecimal(item.projected) })), totals: forecast.totals.map((item) => ({ currency: item.currency, income: moneyToDecimal(item.income), bills: moneyToDecimal(item.bills), netScheduled: moneyToDecimal(item.netScheduled) })), warnings: forecast.warnings.map((item) => ({ ...item, balance: moneyToDecimal(item.balance) })) }, references: refs([{ type: "finance", id: "finance-cash-flow", label: "View cash-flow planning", href: "/finance/planning" }]) };
    }
    if (name === "get_courses" || name === "get_upcoming_assessments" || name === "get_assessments" || name === "get_course_standing") {
      if (name === "get_upcoming_assessments") {
        const { days } = daysSchema.parse(input); const end = addCalendarDays(context.today, days - 1); const upcoming = await getUpcomingAssessments({ start: context.today, end, context });
        const assessments = upcoming.assessments.map((item) => ({ id: item.id, name: item.name, course: { id: item.course.id, code: item.course.code }, timingType: item.timing_type, dueAt: item.due_at, startsAt: item.starts_at, eventDate: item.event_date, weightPercent: String(item.weight_percent), estimatedEffortMinutes: item.estimated_effort_minutes, status: item.status }));
        const result = capped(assessments, assistantLimits.itemCaps.assessments);
        return { ok: true, data: { range: { start: context.today, end }, timeZone: context.timeZone, assessments: result.items, totalAvailable: result.totalAvailable, truncated: result.truncated }, references: refs(result.items.map((item) => ({ type: "assessment", id: item.id, label: `${item.course.code} · ${item.name}`, href: `/school/courses/${item.course.id}#assessment-${item.id}` }))) };
      }
      const courseId = name === "get_course_standing" ? entitySchema.parse(input).id : null;
      if (name === "get_courses") emptySchema.parse(input);
      const school = await getSchoolOverview(context);
      if (name === "get_assessments") {
        emptySchema.parse(input);
        const courses = new Map(school.courses.map((course) => [course.id, course]));
        const assessments = school.assessments.map((item) => ({ id: item.id, name: item.name, course: { id: item.course_id, code: courses.get(item.course_id)!.code }, assessmentType: item.assessment_type, timingType: item.timing_type, dueAt: item.due_at, startsAt: item.starts_at, endsAt: item.ends_at, eventDate: item.event_date, status: item.status, weightPercent: String(item.weight_percent), scoreEarned: item.score_earned === null ? null : String(item.score_earned), scoreMax: item.score_max === null ? null : String(item.score_max), estimatedEffortMinutes: item.estimated_effort_minutes, location: item.location, notes: item.notes }));
        const result = capped(assessments, assistantLimits.itemCaps.assessments);
        return { ok: true, data: { timeZone: school.timezone, assessments: result.items, totalAvailable: result.totalAvailable, truncated: result.truncated }, references: refs(result.items.map((item) => ({ type: "assessment", id: item.id, label: `${item.course.code} · ${item.name}`, href: `/school/courses/${item.course.id}#assessment-${item.id}` }))) };
      }
      const courseOutput = (course: typeof school.courses[number]) => ({ id: course.id, termId: course.term_id, code: course.code, name: course.name, target: course.target.target === null ? null : exactToString(course.target.target), completedWorkGrade: course.grade.completedWorkGrade === null ? null : exactToString(course.grade.completedWorkGrade), earnedCoursePoints: exactToString(course.grade.earnedCoursePoints), gradedWeight: exactToString(course.grade.gradedWeight), remainingConfiguredWeight: exactToString(course.grade.remainingConfiguredWeight), requiredRemainingAverage: course.target.requiredAverage === null ? null : exactToString(course.target.requiredAverage), targetStanding: course.target.standing });
      if (name === "get_courses") { const result = capped(school.courses, assistantLimits.itemCaps.courses); return { ok: true, data: { today: school.today, timeZone: school.timezone, courses: result.items.map(courseOutput), totalAvailable: result.totalAvailable, truncated: result.truncated }, references: refs(result.items.map((course) => ({ type: "course", id: course.id, label: course.code, href: `/school/courses/${course.id}` }))) }; }
      if (name === "get_course_standing") { const course = school.courses.find((item) => item.id === courseId); return course ? { ok: true, data: courseOutput(course), references: refs([{ type: "course", id: course.id, label: course.code, href: `/school/courses/${course.id}` }]) } : safeError("not_found", "Course was not found or is unavailable."); }
    }
    if (name === "get_tasks" || name === "get_tasks_due_today" || name === "get_overdue_tasks") {
      const filter = name === "get_tasks" ? taskSchema.parse(input).filter : (emptySchema.parse(input), name === "get_tasks_due_today" ? "today" : "overdue");
      const data = await getTasks({ context }); let tasks = data.tasks;
      tasks = filter === "active" ? tasks.filter((task) => task.status !== "completed") : filter === "all" ? tasks : filterTasks(tasks, filter, data.today, data.timezone);
      const result = capped(tasks, assistantLimits.itemCaps.tasks);
      return { ok: true, data: { today: data.today, timeZone: data.timezone, tasks: result.items.map((task) => taskItem(task, data.timezone)), totalAvailable: result.totalAvailable, truncated: result.truncated }, references: refs(result.items.map((task) => ({ type: "task", id: task.id, label: task.title, href: `/tasks?task=${task.id}#task-${task.id}` }))) };
    }
    if (name === "get_goals" || name === "get_goal_progress" || name === "get_upcoming_goal_deadlines") {
      const goalId = name === "get_goal_progress" ? entitySchema.parse(input).id : null;
      const goalStatus = name === "get_goals" ? goalsSchema.parse(input).status : null;
      const deadlineDays = name === "get_upcoming_goal_deadlines" ? daysSchema.parse(input).days : null;
      const data = await getGoals(context);
      if (name === "get_goal_progress") { const goal = data.goals.find((item) => item.id === goalId && !item.archived_at); return goal ? { ok: true, data: goalItem(goal), references: refs([{ type: "goal", id: goal.id, label: goal.title, href: `/goals/${goal.id}` }]) } : safeError("not_found", "Goal was not found or is unavailable."); }
      if (name === "get_goals") { const goals = data.goals.filter((goal) => !goal.archived_at && (goalStatus === "all" || goal.status === goalStatus)); const result = capped(goals, assistantLimits.itemCaps.goals); return { ok: true, data: { today: data.today, goals: result.items.map(goalItem), totalAvailable: result.totalAvailable, truncated: result.truncated }, references: refs(result.items.map((goal) => ({ type: "goal", id: goal.id, label: goal.title, href: `/goals/${goal.id}` }))) }; }
      const end = addCalendarDays(context.today, deadlineDays! - 1); const goals = data.goals.filter((goal) => !goal.archived_at && goal.status === "active" && goal.deadline && goal.deadline >= context.today && goal.deadline <= end);
      const result = capped(goals, assistantLimits.itemCaps.goals);
      return { ok: true, data: { range: { start: context.today, end }, goals: result.items.map(goalItem), totalAvailable: result.totalAvailable, truncated: result.truncated }, references: refs(result.items.map((goal) => ({ type: "goal", id: goal.id, label: goal.title, href: `/goals/${goal.id}` }))) };
    }
    return safeError("validation", "Unknown read-only tool.");
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return safeError("validation", "Tool arguments were invalid or outside the allowed range.");
    return safeError("unexpected", "LifeStack could not complete this read operation.");
  }
}
