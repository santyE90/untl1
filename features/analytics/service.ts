import "server-only";

import { calculatePeriodAnalytics, type AnalyticsAccount, type AnalyticsCategory, type AnalyticsTransaction } from "@/features/finance/analytics";
import { moneyToDecimal } from "@/features/finance/money";
import { goalExactToDecimal, goalProgress, goalProgressSummary } from "@/features/goals/progress";
import { gradeRow } from "@/features/school/queries";
import { assessmentLocalDate } from "@/features/school/planning";
import { exactToString } from "@/features/school/grades";
import { getSchoolOverview } from "@/features/school/queries";
import { addCalendarDays } from "@/features/shared/date-ranges";
import { getAuthenticatedAppContext, type AuthenticatedAppContext } from "@/features/shared/server-context";
import { taskDueLocalDate } from "@/features/tasks/task-service";
import type { GoalRecord } from "@/features/goals/types";
import type { TaskRecord } from "@/features/tasks/types";
import { financeTrend, goalModeSummary, schoolStatusAnalytics, taskAnalytics } from "./calculations";
import { analyticsLocalDate, resolveAnalyticsRange } from "./date-range";

export async function getAnalyticsOverview(request: { range?: unknown; from?: unknown; to?: unknown } = {}, suppliedContext?: AuthenticatedAppContext) {
  const context = suppliedContext ?? await getAuthenticatedAppContext(); const resolvedRange = resolveAnalyticsRange(request, context.today); const range = resolvedRange.range; const supabase = context.supabase;
  const [accountsResult, categoriesResult, transactionsResult, tasksResult, goalsResult, school] = await Promise.all([
    supabase.from("finance_account_balances").select("id,currency,current_balance,include_in_net_worth,archived_at"),
    supabase.from("finance_categories").select("id,name,display_color"),
    supabase.from("finance_transactions").select("id,account_id,category_id,amount,kind,status,transaction_date,merchant,description").gte("transaction_date", range.start).lte("transaction_date", range.end).in("kind", ["expense", "income"]),
    supabase.from("tasks").select("id,title,status,priority,due_date,due_at,estimated_effort_minutes,completed_at,archived_at,created_at,updated_at,assessment_id,goal_id"),
    supabase.from("goals").select("id,title,description,category,status,deadline,progress_mode,current_value_decimal,target_value_decimal,unit_label,completed_at,archived_at,created_at,updated_at"),
    getSchoolOverview(context),
  ]);
  const error = accountsResult.error ?? categoriesResult.error ?? transactionsResult.error ?? tasksResult.error ?? goalsResult.error; if (error) throw new Error("Unable to load Analytics data.");
  const accounts: AnalyticsAccount[] = (accountsResult.data ?? []).map((row) => ({ id: row.id!, currency: row.currency!, currentBalance: String(row.current_balance ?? 0), includeInNetWorth: row.include_in_net_worth ?? true, archivedAt: row.archived_at }));
  const categories: AnalyticsCategory[] = (categoriesResult.data ?? []).map((row) => ({ id: row.id, name: row.name, color: row.display_color }));
  const transactions: AnalyticsTransaction[] = (transactionsResult.data ?? []).map((row) => ({ id: row.id, accountId: row.account_id, categoryId: row.category_id, amount: String(row.amount), kind: row.kind, status: row.status, date: row.transaction_date, label: row.merchant || row.description || row.kind }));
  const financePeriod = calculatePeriodAnalytics(transactions, accounts, categories, range, range.end); const currencies = new Map(accounts.map((account) => [account.id, account.currency]));
  const postedTransactions = transactions.filter((row) => row.status === "posted" && (row.kind === "income" || row.kind === "expense") && currencies.has(row.accountId));
  const finance = {
    byCurrency: financePeriod.byCurrency.map((item) => ({ currency: item.currency, income: moneyToDecimal(item.income), expenses: moneyToDecimal(item.expenses), netCashFlow: moneyToDecimal(item.netCashFlow), transactionCount: postedTransactions.filter((row) => currencies.get(row.accountId) === item.currency).length })),
    byCategory: financePeriod.byCategory.map((item) => ({ ...item, amount: moneyToDecimal(item.amount) })),
    largestExpenses: financePeriod.largestExpenses.map((item) => ({ id: item.id, label: item.label, date: item.date, currency: item.currency, amount: moneyToDecimal(item.expenseAmount) })),
    trend: financeTrend(transactions, currencies, range),
  };
  const taskRows = (tasksResult.data ?? []) as TaskRecord[];
  const tasks = taskAnalytics(taskRows.map((task) => { const due = taskDueLocalDate(task, context.timeZone); return { status: task.status, priority: task.priority, createdDate: analyticsLocalDate(task.created_at, context.timeZone), completedDate: task.completed_at ? analyticsLocalDate(task.completed_at, context.timeZone) : null, overdue: Boolean(due && due < context.today), effortMinutes: task.estimated_effort_minutes, archived: Boolean(task.archived_at) }; }), range);
  const schoolMetrics = schoolStatusAnalytics(school.assessments.map((assessment) => ({ status: assessment.status, localDate: assessmentLocalDate(assessment, context.timeZone), grade: gradeRow(assessment) })), range);
  const courseStandings = school.courses.map((course) => ({ courseId: course.id, code: course.code, name: course.name, completedWorkGrade: course.grade.completedWorkGrade === null ? null : exactToString(course.grade.completedWorkGrade), gradedWeight: exactToString(course.grade.gradedWeight) }));
  const goalRows = (goalsResult.data ?? []) as GoalRecord[];
  const goalItems = goalRows.filter((goal) => !goal.archived_at).map((goal) => { const progress = goalProgress(goal); return { id: goal.id, title: goal.title, status: goal.status, deadline: goal.deadline, mode: goal.progress_mode, progressPercent: progress ? goalExactToDecimal(progress.percent) : null, progressLabel: goalProgressSummary(goal) }; });
  const goals = { ...goalModeSummary(goalRows.map((goal) => { const progress = goalProgress(goal); return { archived: Boolean(goal.archived_at), status: goal.status, completedDate: goal.completed_at ? analyticsLocalDate(goal.completed_at, context.timeZone) : null, deadline: goal.deadline, progressMode: goal.progress_mode, progressPercent: progress ? goalExactToDecimal(progress.percent) : null }; }), range, context.today, addCalendarDays(context.today, 30)), items: goalItems };
  return { range, rangeSelection: { selectedKey: resolvedRange.selectedKey, customFrom: resolvedRange.customFrom, customTo: resolvedRange.customTo, error: resolvedRange.error }, today: context.today, timeZone: context.timeZone, finance, school: { ...schoolMetrics, courseStandings }, tasks, goals };
}
