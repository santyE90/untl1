import { describe, expect, it } from "vitest";

import { calculateBudgetStatus, calculatePeriodAnalytics, groupNetWorth, normalizeRecurringCosts, percentageChange } from "./analytics";
import { moneyToDecimal, parseMoney } from "./money";

const range = { start: "2026-08-01", end: "2026-08-31" };
const accounts = [
  { id: "cad", currency: "CAD", currentBalance: "900", includeInNetWorth: true, archivedAt: null },
  { id: "card", currency: "CAD", currentBalance: "-100", includeInNetWorth: true, archivedAt: null },
  { id: "usd", currency: "USD", currentBalance: "50", includeInNetWorth: true, archivedAt: null },
  { id: "old", currency: "CAD", currentBalance: "999", includeInNetWorth: true, archivedAt: "2026-01-01" },
];
const categories = [{ id: "groceries", name: "Groceries", color: "#9865A9" }, { id: "dining", name: "Restaurants", color: null }];

describe("finance analytics", () => {
  const analytics = calculatePeriodAnalytics([
    { id: "1", accountId: "cad", categoryId: "groceries", amount: "-287", kind: "expense", status: "posted", date: "2026-08-02", label: "Food" },
    { id: "2", accountId: "cad", categoryId: "dining", amount: "-200", kind: "expense", status: "posted", date: "2026-08-03", label: "Dinner" },
    { id: "3", accountId: "cad", categoryId: null, amount: "-13", kind: "expense", status: "posted", date: "2026-08-04", label: "Other" },
    { id: "4", accountId: "cad", categoryId: null, amount: "2000", kind: "income", status: "posted", date: "2026-08-05", label: "Pay" },
    { id: "5", accountId: "usd", categoryId: "groceries", amount: "-20", kind: "expense", status: "posted", date: "2026-08-06", label: "USD food" },
    { id: "6", accountId: "cad", categoryId: "groceries", amount: "-999", kind: "expense", status: "void", date: "2026-08-07", label: "Void" },
    { id: "7", accountId: "cad", categoryId: null, amount: "-500", kind: "transfer", status: "posted", date: "2026-08-08", label: "Transfer" },
  ], accounts, categories, range);

  it("counts only posted expenses and income while grouping currencies", () => {
    expect(analytics.byCurrency.map((item) => [item.currency, moneyToDecimal(item.expenses), moneyToDecimal(item.income)])).toEqual([
      ["CAD", "500.0000", "2000.0000"], ["USD", "20.0000", "0.0000"],
    ]);
    expect(analytics.byCategory.find((item) => item.categoryName === "Groceries" && item.currency === "CAD")?.amount).toBe(parseMoney("287"));
  });

  it("uses elapsed days for a partial-month daily average", () => {
    const partial = calculatePeriodAnalytics([
      { id: "partial", accountId: "cad", categoryId: "groceries", amount: "-50", kind: "expense", status: "posted", date: "2026-08-05", label: "Food" },
    ], accounts, categories, range, "2026-08-05");
    expect(moneyToDecimal(partial.byCurrency[0].averageDailySpending)).toBe("10.0000");
  });

  it("calculates remaining, over-budget, and unbudgeted spending", () => {
    const status = calculateBudgetStatus({ id: "budget", currency: "CAD", overallLimit: "450" }, [{ categoryId: "groceries", amount: "350" }, { categoryId: "dining", amount: "150" }, { categoryId: "health", amount: "20" }], analytics.byCategory);
    expect(moneyToDecimal(status.remaining)).toBe("-50.0000");
    expect(moneyToDecimal(status.overAmount)).toBe("50.0000");
    expect(moneyToDecimal(status.unbudgetedSpending)).toBe("13.0000");
    expect(status.categories.find((item) => item.categoryId === "dining")?.overAmount).toBe(parseMoney("50"));
    expect(status.categories.find((item) => item.categoryId === "health")?.actual).toBe(BigInt(0));
  });

  it("handles zero-denominator comparisons and savings rates", () => {
    expect(percentageChange(parseMoney("10"), BigInt(0))).toBeNull();
    expect(analytics.byCurrency.find((item) => item.currency === "USD")?.savingsRate).toBeNull();
    expect(analytics.byCurrency.find((item) => item.currency === "CAD")?.savingsRate).toBe(75);
  });

  it("calculates net worth per currency and excludes archived accounts", () => {
    expect(groupNetWorth(accounts).map((item) => [item.currency, moneyToDecimal(item.amount)])).toEqual([["CAD", "800.0000"], ["USD", "50.0000"]]);
  });

  it("normalizes recurring costs using 52 weeks and 26 biweekly periods", () => {
    const totals = normalizeRecurringCosts([
      { amount: "10", currency: "CAD", frequency: "weekly" },
      { amount: "100", currency: "CAD", frequency: "biweekly" },
      { amount: "1200", currency: "USD", frequency: "yearly" },
    ]);
    expect(totals.map((item) => [item.currency, moneyToDecimal(item.monthly), moneyToDecimal(item.annual)])).toEqual([
      ["CAD", "260.0000", "3120.0000"], ["USD", "100.0000", "1200.0000"],
    ]);
  });
});
