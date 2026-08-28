import {
  calculateBudgetStatus, calculatePeriodAnalytics, percentageChange,
  type AnalyticsAccount, type AnalyticsCategory, type AnalyticsTransaction,
} from "@/features/finance/analytics";
import { moneyToDecimal, parseMoney, type Money } from "@/features/finance/money";
import { goalExactToDecimal, goalProgress, goalProgressSummary } from "@/features/goals/progress";
import type { GoalRecord } from "@/features/goals/types";
import { assessmentPercentage, exactToString, parseExact, type GradeAssessment } from "@/features/school/grades";
import { divideRounded } from "@/features/shared/exact-decimal";
import { analyticsLocalDate, bucketDate, dateInRange, enumerateBuckets, type AnalyticsRange } from "./date-range";

type FinanceTransaction = AnalyticsTransaction & { merchant?: string | null };

function expenseAmount(transaction: FinanceTransaction) {
  const value = parseMoney(transaction.amount); return value < 0n ? -value : value;
}

function eligibleExpense(transaction: FinanceTransaction, currencies: Map<string, string>) {
  return transaction.status === "posted" && transaction.kind === "expense" && currencies.has(transaction.accountId);
}

export function financeDeepAnalytics(transactions: FinanceTransaction[], accounts: AnalyticsAccount[], categories: AnalyticsCategory[], range: AnalyticsRange, previous: { start: string; end: string }) {
  const currencies = new Map(accounts.map((account) => [account.id, account.currency]));
  const current = calculatePeriodAnalytics(transactions, accounts, categories, range, range.end);
  const prior = calculatePeriodAnalytics(transactions, accounts, categories, previous, previous.end);
  const currentRows = transactions.filter((row) => eligibleExpense(row, currencies) && dateInRange(row.date, range));
  const priorRows = transactions.filter((row) => eligibleExpense(row, currencies) && dateInRange(row.date, previous));
  const allCurrencies = [...new Set([...current.byCurrency.map((item) => item.currency), ...prior.byCurrency.map((item) => item.currency)])].sort();
  const comparisons = allCurrencies.map((currency) => {
    const now = current.byCurrency.find((item) => item.currency === currency); const before = prior.byCurrency.find((item) => item.currency === currency);
    return {
      currency, income: moneyToDecimal(now?.income ?? 0n), expenses: moneyToDecimal(now?.expenses ?? 0n), netCashFlow: moneyToDecimal(now?.netCashFlow ?? 0n),
      previousIncome: moneyToDecimal(before?.income ?? 0n), previousExpenses: moneyToDecimal(before?.expenses ?? 0n),
      incomeChange: percentageChange(now?.income ?? 0n, before?.income ?? 0n), expenseChange: percentageChange(now?.expenses ?? 0n, before?.expenses ?? 0n),
    };
  });

  const categoryNames = new Map(categories.map((category) => [category.id, category]));
  const categoryTotals = new Map<string, { currency: string; categoryId: string | null; amount: Money; count: number; previousAmount: Money }>();
  for (const [rows, priorFlag] of [[currentRows, false], [priorRows, true]] as const) {
    for (const row of rows) {
      const currency = currencies.get(row.accountId)!; const key = `${currency}:${row.categoryId ?? "uncategorized"}`;
      const item = categoryTotals.get(key) ?? { currency, categoryId: row.categoryId, amount: 0n, count: 0, previousAmount: 0n };
      if (priorFlag) item.previousAmount += expenseAmount(row); else { item.amount += expenseAmount(row); item.count += 1; }
      categoryTotals.set(key, item);
    }
  }
  const expenseTotals = new Map(current.byCurrency.map((item) => [item.currency, item.expenses]));
  const sortedCategories = [...categoryTotals.values()].filter((item) => item.amount > 0n).map((item) => ({
    ...item,
    categoryName: item.categoryId ? categoryNames.get(item.categoryId)?.name ?? "Archived category" : "Uncategorized",
    color: item.categoryId ? categoryNames.get(item.categoryId)?.color ?? null : null,
    amount: moneyToDecimal(item.amount), previousAmount: moneyToDecimal(item.previousAmount),
    sharePercent: expenseTotals.get(item.currency) ? Number((item.amount * 10_000n) / expenseTotals.get(item.currency)!) / 100 : null,
    changePercent: percentageChange(item.amount, item.previousAmount),
  })).sort((a, b) => {
    const currency = a.currency.localeCompare(b.currency); if (currency) return currency;
    const aAmount = parseMoney(a.amount); const bAmount = parseMoney(b.amount);
    return aAmount === bAmount ? a.categoryName.localeCompare(b.categoryName) : aAmount > bAmount ? -1 : 1;
  });
  const categoryRanks = new Map<string, number>();
  const byCategory = sortedCategories.map((item) => { const rank = (categoryRanks.get(item.currency) ?? 0) + 1; categoryRanks.set(item.currency, rank); return { ...item, rank }; });

  const merchantTotals = new Map<string, { currency: string; merchant: string; amount: Money; count: number }>();
  for (const row of currentRows) {
    const merchant = row.merchant?.trim(); if (!merchant) continue; const currency = currencies.get(row.accountId)!; const key = `${currency}:${merchant}`;
    const item = merchantTotals.get(key) ?? { currency, merchant, amount: 0n, count: 0 }; item.amount += expenseAmount(row); item.count += 1; merchantTotals.set(key, item);
  }
  const merchants = [...merchantTotals.values()].map((item) => ({ ...item, amount: moneyToDecimal(item.amount) })).sort((a, b) => {
    const currency = a.currency.localeCompare(b.currency); if (currency) return currency;
    const aAmount = parseMoney(a.amount); const bAmount = parseMoney(b.amount); return aAmount === bAmount ? a.merchant.localeCompare(b.merchant) : aAmount > bAmount ? -1 : 1;
  });
  return { current, comparisons, byCategory, merchants };
}

export function serializeBudgetStatus(budget: { id: string; currency: string; overallLimit: string }, allocations: Array<{ categoryId: string; amount: string }>, spending: ReturnType<typeof calculatePeriodAnalytics>["byCategory"], names: Map<string, string>) {
  const status = calculateBudgetStatus(budget, allocations, spending);
  return {
    id: budget.id, currency: budget.currency, overallLimit: moneyToDecimal(status.overallLimit), actual: moneyToDecimal(status.totalSpent), remaining: moneyToDecimal(status.remaining), over: moneyToDecimal(status.overAmount), utilization: status.percentageUsed, unbudgeted: moneyToDecimal(status.unbudgetedSpending),
    categories: status.categories.map((item) => ({ categoryId: item.categoryId, categoryName: names.get(item.categoryId) ?? "Archived category", limit: moneyToDecimal(item.limit), actual: moneyToDecimal(item.actual), remaining: moneyToDecimal(item.remaining), over: moneyToDecimal(item.overAmount), utilization: item.percentageUsed })),
  };
}

export type SchoolDeepInput = { id: string; courseId: string; courseCode: string; name: string; type: string; status: string; localDate: string; weight: string; effortMinutes: number | null; grade: GradeAssessment };

export function schoolDeepAnalytics(items: SchoolDeepInput[], range: AnalyticsRange) {
  const relevant = items.filter((item) => dateInRange(item.localDate, range));
  const typeMap = new Map<string, { type: string; assessments: number; samples: number; totalPercent: bigint; effortMinutes: number; effortCount: number; weight: bigint }>();
  for (const item of relevant) {
    if (item.status === "exempt") continue;
    const group = typeMap.get(item.type) ?? { type: item.type, assessments: 0, samples: 0, totalPercent: 0n, effortMinutes: 0, effortCount: 0, weight: 0n };
    group.assessments += 1; group.weight += parseExact(item.weight);
    if (item.effortMinutes !== null) { group.effortMinutes += item.effortMinutes; group.effortCount += 1; }
    const percent = assessmentPercentage(item.grade); if (percent !== null) { group.totalPercent += percent; group.samples += 1; }
    typeMap.set(item.type, group);
  }
  const byType = [...typeMap.values()].map((item) => ({
    type: item.type, assessments: item.assessments, sampleCount: item.samples,
    averagePercent: item.samples ? exactToString(divideRounded(item.totalPercent, BigInt(item.samples))) : null,
    effortMinutes: item.effortMinutes, effortCount: item.effortCount, configuredWeight: exactToString(item.weight),
  })).sort((a, b) => b.assessments - a.assessments || a.type.localeCompare(b.type));
  const timeline = relevant.flatMap((item) => {
    if (item.status === "exempt") return []; const percentage = assessmentPercentage(item.grade);
    return percentage === null ? [] : [{ id: item.id, courseId: item.courseId, courseCode: item.courseCode, name: item.name, date: item.localDate, type: item.type, status: item.status, percentage: exactToString(percentage) }];
  }).sort((a, b) => a.date.localeCompare(b.date) || a.courseCode.localeCompare(b.courseCode));
  const nonExempt = relevant.filter((item) => item.status !== "exempt"); const estimates = nonExempt.filter((item) => item.effortMinutes !== null);
  return {
    due: relevant.length, completed: relevant.filter((item) => ["graded", "submitted", "missed"].includes(item.status)).length,
    graded: relevant.filter((item) => item.status === "graded").length, missed: relevant.filter((item) => item.status === "missed").length, exempt: relevant.filter((item) => item.status === "exempt").length,
    effortMinutes: estimates.reduce((sum, item) => sum + item.effortMinutes!, 0), effortCount: estimates.length,
    configuredWeight: exactToString(nonExempt.reduce((sum, item) => sum + parseExact(item.weight), 0n)), byType, timeline,
  };
}

export type TaskDeepInput = { id: string; status: string; priority: string; createdAt: string; completedAt: string | null; createdDate: string; completedDate: string | null; dueDate: string | null; dueAt: string | null; effortMinutes: number | null; archived: boolean };
function median(values: number[]) { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2); }

export function taskDeepAnalytics(tasks: TaskDeepInput[], range: AnalyticsRange, today: string, nowInstant: string) {
  const visible = tasks.filter((task) => !task.archived); const created = visible.filter((task) => dateInRange(task.createdDate, range)); const completed = visible.filter((task) => task.status === "completed" && dateInRange(task.completedDate, range));
  const trendCounts = new Map<string, { created: number; completed: number }>();
  for (const task of created) { const key = bucketDate(task.createdDate, range); const value = trendCounts.get(key) ?? { created: 0, completed: 0 }; value.created += 1; trendCounts.set(key, value); }
  for (const task of completed) { const key = bucketDate(task.completedDate!, range); const value = trendCounts.get(key) ?? { created: 0, completed: 0 }; value.completed += 1; trendCounts.set(key, value); }
  const withDue = completed.filter((task) => task.dueDate || task.dueAt);
  const onTime = withDue.filter((task) => task.dueDate ? task.completedDate! <= task.dueDate : Date.parse(task.completedAt!) <= Date.parse(task.dueAt!));
  const durations = completed.flatMap((task) => { const value = task.completedAt ? Math.round((Date.parse(task.completedAt) - Date.parse(task.createdAt)) / 60_000) : -1; return value >= 0 ? [value] : []; });
  const estimates = completed.flatMap((task) => task.effortMinutes === null ? [] : [task.effortMinutes]);
  return {
    created: created.length, completed: completed.length,
    currentlyOverdue: visible.filter((task) => task.status !== "completed" && ((task.dueDate && task.dueDate < today) || (task.dueAt && task.dueAt < nowInstant))).length,
    activeNoDueDate: visible.filter((task) => task.status !== "completed" && !task.dueDate && !task.dueAt).length,
    deadline: { eligible: withDue.length, onTime: onTime.length, late: withDue.length - onTime.length },
    medianCompletionMinutes: median(durations), completionDurationSamples: durations.length,
    completedEffortMinutes: estimates.reduce((sum, value) => sum + value, 0), effortCoverage: { estimated: estimates.length, completed: completed.length }, medianEstimatedMinutes: median(estimates),
    priorities: ["urgent", "high", "medium", "low"].map((priority) => ({ priority, created: created.filter((task) => task.priority === priority).length, completed: completed.filter((task) => task.priority === priority).length, active: visible.filter((task) => task.status !== "completed" && task.priority === priority).length })),
    trend: enumerateBuckets(range).map((date) => ({ date, ...(trendCounts.get(date) ?? { created: 0, completed: 0 }) })),
  };
}

export function goalDeepAnalytics(goals: GoalRecord[], range: AnalyticsRange, today: string, deadlineEnd: string, timeZone: string) {
  const visible = goals.filter((goal) => !goal.archived_at); const active = visible.filter((goal) => goal.status === "active");
  const categories = new Map<string, { category: string; active: number; completed: number; upcoming: number }>();
  for (const goal of visible) {
    const item = categories.get(goal.category) ?? { category: goal.category, active: 0, completed: 0, upcoming: 0 };
    if (goal.status === "active") { item.active += 1; if (goal.deadline && goal.deadline >= today && goal.deadline <= deadlineEnd) item.upcoming += 1; }
    else if (goal.status === "completed") item.completed += 1; categories.set(goal.category, item);
  }
  return {
    active: active.length, completedTotal: visible.filter((goal) => goal.status === "completed").length,
    completedInRange: visible.filter((goal) => goal.status === "completed" && goal.completed_at && dateInRange(analyticsLocalDate(goal.completed_at, timeZone), range)).length,
    overdue: active.filter((goal) => goal.deadline && goal.deadline < today).length,
    upcoming: active.filter((goal) => goal.deadline && goal.deadline >= today && goal.deadline <= deadlineEnd).length,
    measured: visible.filter((goal) => goal.progress_mode !== "none").length, unmeasured: visible.filter((goal) => goal.progress_mode === "none").length,
    categories: [...categories.values()].sort((a, b) => b.active - a.active || a.category.localeCompare(b.category)),
    items: visible.map((goal) => { const progress = goalProgress(goal); return { id: goal.id, title: goal.title, category: goal.category, status: goal.status, deadline: goal.deadline, progressMode: goal.progress_mode, progressPercent: progress ? goalExactToDecimal(progress.percent) : null, overTarget: Boolean(progress?.exceeded), progressLabel: goalProgressSummary(goal) }; }),
  };
}
