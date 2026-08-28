import "server-only";

import { groupNetWorth, calculatePeriodAnalytics, type AnalyticsAccount, type AnalyticsCategory, type AnalyticsTransaction } from "@/features/finance/analytics";
import { monthRange, nextMonthKey } from "@/features/finance/date-ranges";
import { moneyToDecimal } from "@/features/finance/money";
import { formatGoalCategory } from "@/features/goals/progress";
import type { GoalRecord } from "@/features/goals/types";
import { zonedLocalDateTimeToUtc } from "@/features/calendar/dates";
import { exactToString } from "@/features/school/grades";
import { assessmentLocalDate } from "@/features/school/planning";
import { getSchoolOverview, gradeRow } from "@/features/school/queries";
import { addCalendarDays } from "@/features/shared/date-ranges";
import { getAuthenticatedAppContext, type AuthenticatedAppContext } from "@/features/shared/server-context";
import type { TaskRecord } from "@/features/tasks/types";
import { analyticsLocalDate, previousAnalyticsRange, resolveAnalyticsRange } from "./date-range";
import { financeTrend } from "./calculations";
import { financeDeepAnalytics, goalDeepAnalytics, schoolDeepAnalytics, serializeBudgetStatus, taskDeepAnalytics } from "./deep-calculations";

type RangeRequest = { range?: unknown; from?: unknown; to?: unknown };

function rangeState(request: RangeRequest, context: AuthenticatedAppContext) {
  const resolved = resolveAnalyticsRange(request, context.today);
  return { range: resolved.range, rangeSelection: { selectedKey: resolved.selectedKey, customFrom: resolved.customFrom, customTo: resolved.customTo, error: resolved.error }, today: context.today, timeZone: context.timeZone };
}

function monthKeys(start: string, end: string) {
  const keys: string[] = []; for (let key = start.slice(0, 7); key <= end.slice(0, 7); key = nextMonthKey(key)) keys.push(key); return keys;
}

export async function getFinanceDeepAnalytics(request: RangeRequest = {}, suppliedContext?: AuthenticatedAppContext) {
  const context = suppliedContext ?? await getAuthenticatedAppContext(); const state = rangeState(request, context); const previous = previousAnalyticsRange(state.range); const months = monthKeys(state.range.start, state.range.end);
  const budgetRange = { start: monthRange(months[0]).start, end: monthRange(months.at(-1)!).end }; const transactionStart = previous.start < budgetRange.start ? previous.start : budgetRange.start; const transactionEnd = state.range.end > budgetRange.end ? state.range.end : budgetRange.end;
  const [accountsResult, categoriesResult, transactionsResult, budgetsResult] = await Promise.all([
    context.supabase.from("finance_account_balances").select("id,currency,current_balance,include_in_net_worth,archived_at"),
    context.supabase.from("finance_categories").select("id,name,display_color"),
    context.supabase.from("finance_transactions").select("id,account_id,category_id,amount,kind,status,transaction_date,merchant,description").gte("transaction_date", transactionStart).lte("transaction_date", transactionEnd).in("kind", ["expense", "income"]),
    context.supabase.from("finance_budgets").select("id,budget_month,currency,overall_limit").gte("budget_month", budgetRange.start).lte("budget_month", budgetRange.end).order("budget_month"),
  ]);
  const initialError = accountsResult.error ?? categoriesResult.error ?? transactionsResult.error ?? budgetsResult.error; if (initialError) throw new Error("Unable to load Finance analytics.");
  const budgetRows = budgetsResult.data ?? []; const allocationResult = budgetRows.length ? await context.supabase.from("finance_budget_categories").select("budget_id,category_id,amount").in("budget_id", budgetRows.map((row) => row.id)) : { data: [], error: null };
  if (allocationResult.error) throw new Error("Unable to load Finance budget analytics.");
  const accounts: AnalyticsAccount[] = (accountsResult.data ?? []).map((row) => ({ id: row.id!, currency: row.currency!, currentBalance: String(row.current_balance ?? 0), includeInNetWorth: row.include_in_net_worth ?? true, archivedAt: row.archived_at }));
  const categories: AnalyticsCategory[] = (categoriesResult.data ?? []).map((row) => ({ id: row.id, name: row.name, color: row.display_color })); const categoryNames = new Map(categories.map((item) => [item.id, item.name]));
  const transactions = (transactionsResult.data ?? []).map((row) => ({ id: row.id, accountId: row.account_id, categoryId: row.category_id, amount: String(row.amount), kind: row.kind, status: row.status, date: row.transaction_date, label: row.merchant || row.description || row.kind, merchant: row.merchant })) as Array<AnalyticsTransaction & { merchant: string | null }>;
  const deep = financeDeepAnalytics(transactions, accounts, categories, state.range, previous); const currencies = new Map(accounts.map((account) => [account.id, account.currency]));
  const budgets = budgetRows.map((budget) => {
    const month = budget.budget_month.slice(0, 7); const range = monthRange(month); const period = calculatePeriodAnalytics(transactions, accounts, categories, range, range.end);
    const allocations = (allocationResult.data ?? []).filter((row) => row.budget_id === budget.id).map((row) => ({ categoryId: row.category_id, amount: String(row.amount) }));
    return { month, ...serializeBudgetStatus({ id: budget.id, currency: budget.currency, overallLimit: String(budget.overall_limit) }, allocations, period.byCategory, categoryNames) };
  });
  return { ...state, previousRange: previous, comparisons: deep.comparisons, categories: deep.byCategory, merchants: deep.merchants, trend: financeTrend(transactions, currencies, state.range), budgets, budgetMonths: months, netWorth: groupNetWorth(accounts).map((item) => ({ currency: item.currency, amount: moneyToDecimal(item.amount) })) };
}

export async function getSchoolDeepAnalytics(request: RangeRequest = {}, suppliedContext?: AuthenticatedAppContext) {
  const context = suppliedContext ?? await getAuthenticatedAppContext(); const state = rangeState(request, context); const school = await getSchoolOverview(context); const courses = new Map(school.courses.map((course) => [course.id, course]));
  const input = school.assessments.flatMap((assessment) => { const course = courses.get(assessment.course_id); if (!course) return []; return [{ id: assessment.id, courseId: course.id, courseCode: course.code, name: assessment.name, type: assessment.assessment_type, status: assessment.status, localDate: assessmentLocalDate(assessment, context.timeZone), weight: String(assessment.weight_percent), effortMinutes: assessment.estimated_effort_minutes, grade: gradeRow(assessment) }]; });
  const deep = schoolDeepAnalytics(input, state.range);
  const courseStandings = school.courses.map((course) => ({
    id: course.id, code: course.code, name: course.name,
    completedWorkGrade: course.grade.completedWorkGrade === null ? null : exactToString(course.grade.completedWorkGrade), earnedCoursePoints: exactToString(course.grade.earnedCoursePoints), gradedWeight: exactToString(course.grade.gradedWeight), remainingConfiguredWeight: exactToString(course.grade.remainingConfiguredWeight),
    target: course.target.target === null ? null : exactToString(course.target.target), requiredAverage: course.target.requiredAverage === null ? null : exactToString(course.target.requiredAverage), targetState: course.target.standing,
    statuses: ["graded", "submitted", "missed", "exempt", "upcoming"].map((status) => ({ status, count: school.assessments.filter((item) => item.course_id === course.id && item.status === status).length })),
  }));
  return { ...state, ...deep, courseStandings };
}

const taskSelect = "id,title,status,priority,due_date,due_at,estimated_effort_minutes,completed_at,archived_at,created_at,updated_at,assessment_id,goal_id" as const;
export async function getTaskDeepAnalytics(request: RangeRequest = {}, suppliedContext?: AuthenticatedAppContext) {
  const context = suppliedContext ?? await getAuthenticatedAppContext(); const state = rangeState(request, context);
  const startInstant = zonedLocalDateTimeToUtc(`${state.range.start}T00:00`, context.timeZone); const endInstant = zonedLocalDateTimeToUtc(`${addCalendarDays(state.range.end, 1)}T00:00`, context.timeZone);
  const [createdResult, completedResult, activeResult] = await Promise.all([
    context.supabase.from("tasks").select(taskSelect).gte("created_at", startInstant).lt("created_at", endInstant),
    context.supabase.from("tasks").select(taskSelect).gte("completed_at", startInstant).lt("completed_at", endInstant),
    context.supabase.from("tasks").select(taskSelect).is("archived_at", null).neq("status", "completed"),
  ]);
  const error = createdResult.error ?? completedResult.error ?? activeResult.error; if (error) throw new Error("Unable to load Task analytics.");
  const rows = new Map<string, TaskRecord>(); for (const row of [...(createdResult.data ?? []), ...(completedResult.data ?? []), ...(activeResult.data ?? [])]) rows.set(row.id, row as TaskRecord);
  const tasks = [...rows.values()].map((task) => ({ id: task.id, status: task.status, priority: task.priority, createdAt: task.created_at, completedAt: task.completed_at, createdDate: analyticsLocalDate(task.created_at, context.timeZone), completedDate: task.completed_at ? analyticsLocalDate(task.completed_at, context.timeZone) : null, dueDate: task.due_date, dueAt: task.due_at, effortMinutes: task.estimated_effort_minutes, archived: Boolean(task.archived_at) }));
  return { ...state, ...taskDeepAnalytics(tasks, state.range, context.today, new Date().toISOString()) };
}

export async function getGoalDeepAnalytics(request: RangeRequest = {}, suppliedContext?: AuthenticatedAppContext) {
  const context = suppliedContext ?? await getAuthenticatedAppContext(); const state = rangeState(request, context);
  const result = await context.supabase.from("goals").select("id,title,description,category,status,deadline,progress_mode,current_value_decimal,target_value_decimal,unit_label,completed_at,archived_at,created_at,updated_at").is("archived_at", null);
  if (result.error) throw new Error("Unable to load Goal analytics."); const goals = (result.data ?? []) as GoalRecord[];
  const deep = goalDeepAnalytics(goals, state.range, context.today, addCalendarDays(context.today, 30), context.timeZone);
  return { ...state, ...deep, categories: deep.categories.map((item) => ({ ...item, label: formatGoalCategory(item.category) })) };
}
