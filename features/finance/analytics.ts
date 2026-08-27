import { addMoney, divideMoneyRounded, moneyToDecimal, multiplyMoney, parseMoney, type Money } from "./money";
import type { DateRange } from "./date-ranges";

export type AnalyticsTransaction = {
  id: string;
  accountId: string;
  categoryId: string | null;
  amount: string;
  kind: string;
  status: string;
  date: string;
  label: string;
};

export type AnalyticsAccount = {
  id: string;
  currency: string;
  currentBalance: string;
  includeInNetWorth: boolean;
  archivedAt: string | null;
};

export type AnalyticsCategory = { id: string; name: string; color: string | null };

export type CurrencyPeriodMetrics = {
  currency: string;
  income: Money;
  expenses: Money;
  netCashFlow: Money;
  savingsRate: number | null;
  averageDailySpending: Money;
};

export type CategorySpending = {
  categoryId: string | null;
  categoryName: string;
  color: string | null;
  currency: string;
  amount: Money;
};

export function percentageUsed(actual: Money, limit: Money): number | null {
  if (limit <= BigInt(0)) return null;
  return Number((actual * BigInt(10_000)) / limit) / 100;
}

export function percentageChange(current: Money, previous: Money): number | null {
  if (previous === BigInt(0)) return null;
  return Number(((current - previous) * BigInt(10_000)) / previous) / 100;
}

export function calculatePeriodAnalytics(
  transactions: AnalyticsTransaction[],
  accounts: AnalyticsAccount[],
  categories: AnalyticsCategory[],
  range: DateRange,
  asOfDate = range.end,
) {
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const currencyTotals = new Map<string, { income: Money; expenses: Money }>();
  const categoryTotals = new Map<string, CategorySpending>();
  const dailyTotals = new Map<string, Map<string, Money>>();
  const largestExpenses: Array<AnalyticsTransaction & { currency: string; expenseAmount: Money }> = [];
  const effectiveEnd = asOfDate < range.start ? range.start : asOfDate > range.end ? range.end : asOfDate;
  const days = Math.round((Date.parse(effectiveEnd) - Date.parse(range.start)) / 86_400_000) + 1;

  for (const transaction of transactions) {
    if (transaction.status !== "posted" || transaction.date < range.start || transaction.date > range.end) continue;
    if (transaction.kind !== "income" && transaction.kind !== "expense") continue;
    const account = accountMap.get(transaction.accountId);
    if (!account) continue;
    const amount = parseMoney(transaction.amount);
    const totals = currencyTotals.get(account.currency) ?? { income: BigInt(0), expenses: BigInt(0) };

    if (transaction.kind === "income") {
      totals.income += amount;
    } else {
      const expenseAmount = amount < BigInt(0) ? -amount : amount;
      totals.expenses += expenseAmount;
      const category = transaction.categoryId ? categoryMap.get(transaction.categoryId) : null;
      const categoryKey = `${account.currency}:${transaction.categoryId ?? "uncategorized"}`;
      const existing = categoryTotals.get(categoryKey);
      categoryTotals.set(categoryKey, {
        categoryId: transaction.categoryId,
        categoryName: category?.name ?? "Uncategorized",
        color: category?.color ?? null,
        currency: account.currency,
        amount: (existing?.amount ?? BigInt(0)) + expenseAmount,
      });
      const day = dailyTotals.get(transaction.date) ?? new Map<string, Money>();
      day.set(account.currency, (day.get(account.currency) ?? BigInt(0)) + expenseAmount);
      dailyTotals.set(transaction.date, day);
      largestExpenses.push({ ...transaction, currency: account.currency, expenseAmount });
    }
    currencyTotals.set(account.currency, totals);
  }

  const byCurrency: CurrencyPeriodMetrics[] = [...currencyTotals].map(([currency, totals]) => ({
    currency,
    income: totals.income,
    expenses: totals.expenses,
    netCashFlow: totals.income - totals.expenses,
    savingsRate: totals.income === BigInt(0) ? null : Number(((totals.income - totals.expenses) * BigInt(10_000)) / totals.income) / 100,
    averageDailySpending: divideMoneyRounded(totals.expenses, BigInt(days)),
  })).sort((a, b) => a.currency.localeCompare(b.currency));

  return {
    byCurrency,
    byCategory: [...categoryTotals.values()].sort((a, b) => a.currency.localeCompare(b.currency) || (a.amount > b.amount ? -1 : 1)),
    byDay: [...dailyTotals].sort(([a], [b]) => a.localeCompare(b)).map(([date, currencies]) => ({ date, currencies })),
    largestExpenses: largestExpenses.sort((a, b) => a.expenseAmount > b.expenseAmount ? -1 : 1).slice(0, 5),
  };
}

export type BudgetInput = { id: string; currency: string; overallLimit: string };
export type BudgetAllocationInput = { categoryId: string; amount: string };

export function calculateBudgetStatus(
  budget: BudgetInput,
  allocations: BudgetAllocationInput[],
  spending: CategorySpending[],
) {
  const overallLimit = parseMoney(budget.overallLimit);
  const relevantSpending = spending.filter((item) => item.currency === budget.currency);
  const totalSpent = addMoney(relevantSpending.map((item) => item.amount));
  const allocationMap = new Map(allocations.map((allocation) => [allocation.categoryId, parseMoney(allocation.amount)]));
  const spendMap = new Map(relevantSpending.map((item) => [item.categoryId, item.amount]));
  const categories = allocations.map((allocation) => {
    const limit = parseMoney(allocation.amount);
    const actual = spendMap.get(allocation.categoryId) ?? BigInt(0);
    return {
      categoryId: allocation.categoryId,
      limit,
      actual,
      remaining: limit - actual,
      overAmount: actual > limit ? actual - limit : BigInt(0),
      percentageUsed: percentageUsed(actual, limit),
    };
  });
  const unbudgetedSpending = addMoney(relevantSpending.filter((item) => !item.categoryId || !allocationMap.has(item.categoryId)).map((item) => item.amount));
  return {
    overallLimit,
    totalSpent,
    remaining: overallLimit - totalSpent,
    overAmount: totalSpent > overallLimit ? totalSpent - overallLimit : BigInt(0),
    percentageUsed: percentageUsed(totalSpent, overallLimit),
    unbudgetedSpending,
    categories,
  };
}

export function groupNetWorth(accounts: AnalyticsAccount[]) {
  const grouped = new Map<string, Money>();
  for (const account of accounts) {
    if (!account.includeInNetWorth || account.archivedAt) continue;
    grouped.set(account.currency, (grouped.get(account.currency) ?? BigInt(0)) + parseMoney(account.currentBalance));
  }
  return [...grouped].map(([currency, amount]) => ({ currency, amount })).sort((a, b) => a.currency.localeCompare(b.currency));
}

export type RecurringCostInput = { amount: string; currency: string; frequency: "weekly" | "biweekly" | "monthly" | "yearly"; categoryId?: string | null; accountId?: string | null };

function normalizedAnnual(cost: RecurringCostInput) {
  const amount = parseMoney(cost.amount);
  return cost.frequency === "weekly" ? multiplyMoney(amount, BigInt(52))
    : cost.frequency === "biweekly" ? multiplyMoney(amount, BigInt(26))
      : cost.frequency === "monthly" ? multiplyMoney(amount, BigInt(12)) : amount;
}

function recurringGroups(costs: RecurringCostInput[], key: "categoryId" | "accountId") {
  const grouped = new Map<string, { id: string | null; currency: string; annual: Money; monthly: Money }>();
  for (const cost of costs) {
    const id = cost[key] ?? null;
    const annual = normalizedAnnual(cost);
    const groupKey = `${cost.currency}:${id ?? "unassigned"}`;
    const existing = grouped.get(groupKey) ?? { id, currency: cost.currency, annual: BigInt(0), monthly: BigInt(0) };
    existing.annual += annual;
    existing.monthly += divideMoneyRounded(annual, BigInt(12));
    grouped.set(groupKey, existing);
  }
  return [...grouped.values()].sort((a, b) => a.currency.localeCompare(b.currency) || (a.annual > b.annual ? -1 : 1));
}

export function getRecurringCostBreakdown(costs: RecurringCostInput[]) {
  const grouped = new Map<string, { annual: Money; monthly: Money }>();
  for (const cost of costs) {
    const annual = normalizedAnnual(cost);
    const existing = grouped.get(cost.currency) ?? { annual: BigInt(0), monthly: BigInt(0) };
    existing.annual += annual;
    existing.monthly += divideMoneyRounded(annual, BigInt(12));
    grouped.set(cost.currency, existing);
  }
  return {
    totals: [...grouped].map(([currency, totals]) => ({ currency, ...totals })).sort((a, b) => a.currency.localeCompare(b.currency)),
    byCategory: recurringGroups(costs, "categoryId"),
    byAccount: recurringGroups(costs, "accountId"),
  };
}

export function normalizeRecurringCosts(costs: RecurringCostInput[]) {
  return getRecurringCostBreakdown(costs).totals;
}

export function serializeMoney<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, typeof entry === "bigint" ? moneyToDecimal(entry) : entry])) as T;
}
