import "server-only";

import { requireAuthenticatedUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import type { AuthenticatedAppContext } from "@/features/shared/server-context";

import { calculateBudgetStatus, calculatePeriodAnalytics, getRecurringCostBreakdown, groupNetWorth, percentageChange, type AnalyticsAccount, type AnalyticsCategory, type AnalyticsTransaction } from "./analytics";
import { currentDateInTimeZone, currentMonthKey, daysRemainingInPeriod, monthRange, previousMonthKey } from "./date-ranges";

export async function getFinanceAnalytics(requestedMonth?: string, context?: AuthenticatedAppContext) {
  const user = context?.user ?? await requireAuthenticatedUser();
  const supabase = context?.supabase ?? await createClient();
  const profile = context?.profile ?? (await supabase.from("profiles").select("currency,timezone").eq("id", user.id).single()).data;
  if (!profile) throw new Error("Unable to load finance preferences.");

  const month = requestedMonth ?? currentMonthKey(profile.timezone);
  const currentRange = monthRange(month);
  const previousMonth = previousMonthKey(month);
  const previousRange = monthRange(previousMonth);
  const today = currentDateInTimeZone(profile.timezone);

  const [accountsResult, categoriesResult, transactionsResult, billsResult, budgetsResult, allocationsResult] = await Promise.all([
    supabase.from("finance_account_balances").select("*"),
    supabase.from("finance_categories").select("id,name,display_color,archived_at,category_type").order("name"),
    supabase.from("finance_transactions").select("id,account_id,category_id,amount,kind,status,transaction_date,merchant,description").gte("transaction_date", previousRange.start).lte("transaction_date", currentRange.end).in("kind", ["expense", "income"]),
    supabase.from("recurring_bills").select("id,name,expected_amount,currency,frequency,category_id,account_id,next_due_date,is_active").eq("is_active", true).order("next_due_date"),
    supabase.from("finance_budgets").select("*").order("budget_month", { ascending: false }),
    supabase.from("finance_budget_categories").select("*"),
  ]);
  const error = accountsResult.error ?? categoriesResult.error ?? transactionsResult.error ?? billsResult.error ?? budgetsResult.error ?? allocationsResult.error;
  if (error) throw new Error(`Unable to load finance analytics: ${error.message}`);

  const accounts: AnalyticsAccount[] = (accountsResult.data ?? []).flatMap((row) => row.id && row.currency ? [{ id: row.id, currency: row.currency, currentBalance: String(row.current_balance ?? 0), includeInNetWorth: row.include_in_net_worth ?? true, archivedAt: row.archived_at }] : []);
  const categories: AnalyticsCategory[] = (categoriesResult.data ?? []).map((row) => ({ id: row.id, name: row.name, color: row.display_color }));
  const transactions: AnalyticsTransaction[] = (transactionsResult.data ?? []).map((row) => ({ id: row.id, accountId: row.account_id, categoryId: row.category_id, amount: String(row.amount), kind: row.kind, status: row.status, date: row.transaction_date, label: row.merchant || row.description || row.kind }));
  const current = calculatePeriodAnalytics(transactions, accounts, categories, currentRange, today);
  const previous = calculatePeriodAnalytics(transactions, accounts, categories, previousRange);
  const allocations = allocationsResult.data ?? [];
  const currentBudgets = (budgetsResult.data ?? []).filter((budget) => budget.budget_month === currentRange.start).map((budget) => ({
    row: budget,
    status: calculateBudgetStatus(
      { id: budget.id, currency: budget.currency, overallLimit: String(budget.overall_limit) },
      allocations.filter((item) => item.budget_id === budget.id).map((item) => ({ categoryId: item.category_id, amount: String(item.amount) })),
      current.byCategory,
    ),
  }));

  const comparisons = [...new Set([...current.byCurrency.map((item) => item.currency), ...previous.byCurrency.map((item) => item.currency)])].sort().map((currency) => {
    const currentMetrics = current.byCurrency.find((item) => item.currency === currency);
    const previousMetrics = previous.byCurrency.find((item) => item.currency === currency);
    return {
      currency,
      currentIncome: currentMetrics?.income ?? BigInt(0),
      previousIncome: previousMetrics?.income ?? BigInt(0),
      currentExpenses: currentMetrics?.expenses ?? BigInt(0),
      previousExpenses: previousMetrics?.expenses ?? BigInt(0),
      expenseChange: percentageChange(currentMetrics?.expenses ?? BigInt(0), previousMetrics?.expenses ?? BigInt(0)),
    };
  });

  const recurringCostBreakdown = getRecurringCostBreakdown((billsResult.data ?? []).map((bill) => ({ amount: String(bill.expected_amount), currency: bill.currency, frequency: bill.frequency as "weekly" | "biweekly" | "monthly" | "yearly", categoryId: bill.category_id, accountId: bill.account_id })));

  return {
    month,
    previousMonth,
    range: currentRange,
    today,
    daysRemaining: daysRemainingInPeriod(today, currentRange),
    defaultCurrency: profile.currency,
    current,
    previous,
    comparisons,
    budgets: currentBudgets,
    budgetHistory: budgetsResult.data ?? [],
    allocations,
    netWorth: groupNetWorth(accounts),
    recurringCosts: recurringCostBreakdown.totals,
    recurringCostBreakdown,
    upcomingBills: billsResult.data ?? [],
    categories: categoriesResult.data ?? [],
    accountCurrencies: [...new Set(accounts.filter((account) => !account.archivedAt).map((account) => account.currency))].sort(),
  };
}
