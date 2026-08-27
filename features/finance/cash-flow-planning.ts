import type { DateRange } from "./date-ranges";
import { parseMoney, type Money } from "./money";
import { expandRecurringSchedules, type RecurringProjectionSource } from "./recurrence-expansion";

export type PlanningAccount = {
  id: string;
  name: string;
  accountType: string;
  currency: string;
  currentBalance: string;
  archivedAt: string | null;
};

export type CashFlowEntry = {
  occurrenceId: string;
  date: string;
  type: "bill" | "income";
  name: string;
  amount: Money;
  currency: string;
  accountId: string | null;
  sourceId: string;
  sourceType: "recurring_bill" | "recurring_income";
};

export type ProjectedBalancePoint = {
  date: string;
  occurrenceId: string | null;
  label: string;
  balance: Money;
};

const LIQUID_ACCOUNT_TYPES = new Set(["chequing", "savings", "cash"]);

export function buildCashFlowTimeline(schedules: RecurringProjectionSource[], range: DateRange, recordedOccurrenceIds = new Set<string>()): CashFlowEntry[] {
  return expandRecurringSchedules(schedules, range, recordedOccurrenceIds).map((occurrence) => ({
    occurrenceId: occurrence.occurrenceId,
    date: occurrence.date,
    type: occurrence.sourceType,
    name: occurrence.name,
    amount: occurrence.sourceType === "bill" ? -parseMoney(occurrence.amount) : parseMoney(occurrence.amount),
    currency: occurrence.currency,
    accountId: occurrence.accountId,
    sourceId: occurrence.id,
    sourceType: occurrence.sourceType === "bill" ? "recurring_bill" : "recurring_income",
  }));
}

export function buildKnownCashFlowForecast(accounts: PlanningAccount[], schedules: RecurringProjectionSource[], range: DateRange, recordedOccurrenceIds = new Set<string>()) {
  const timeline = buildCashFlowTimeline(schedules, range, recordedOccurrenceIds);
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  const accountForecasts = accounts.map((account) => {
    let balance = parseMoney(account.currentBalance);
    const points: ProjectedBalancePoint[] = [{ date: range.start, occurrenceId: null, label: "Current derived balance", balance }];
    for (const entry of timeline.filter((item) => item.accountId === account.id)) {
      balance += entry.amount;
      points.push({ date: entry.date, occurrenceId: entry.occurrenceId, label: entry.name, balance });
    }
    const lowestPoint = points.reduce((lowest, point) => point.balance < lowest.balance ? point : lowest, points[0]);
    return { account, startingBalance: parseMoney(account.currentBalance), endingBalance: balance, lowestPoint, points };
  });

  const totals = new Map<string, { income: Money; bills: Money; unassignedBills: Money; unassignedIncome: Money }>();
  for (const entry of timeline) {
    const value = totals.get(entry.currency) ?? { income: BigInt(0), bills: BigInt(0), unassignedBills: BigInt(0), unassignedIncome: BigInt(0) };
    if (entry.type === "bill") {
      const bill = -entry.amount;
      value.bills += bill;
      if (!entry.accountId) value.unassignedBills += bill;
    } else {
      value.income += entry.amount;
      if (!entry.accountId) value.unassignedIncome += entry.amount;
    }
    totals.set(entry.currency, value);
  }

  const liquid = new Map<string, { current: Money; projected: Money }>();
  for (const account of accounts) {
    if (account.archivedAt || !LIQUID_ACCOUNT_TYPES.has(account.accountType)) continue;
    const value = liquid.get(account.currency) ?? { current: BigInt(0), projected: BigInt(0) };
    const current = parseMoney(account.currentBalance);
    value.current += current;
    value.projected += current;
    liquid.set(account.currency, value);
  }
  for (const entry of timeline) {
    if (!entry.accountId) continue;
    const account = accountMap.get(entry.accountId);
    if (!account || account.archivedAt || !LIQUID_ACCOUNT_TYPES.has(account.accountType)) continue;
    const value = liquid.get(entry.currency);
    if (value) value.projected += entry.amount;
  }

  const warnings = accountForecasts.flatMap((forecast) => {
    if (forecast.account.archivedAt || !LIQUID_ACCOUNT_TYPES.has(forecast.account.accountType)) return [];
    const firstNegative = forecast.points.find((point) => point.occurrenceId && point.balance < BigInt(0));
    return firstNegative ? [{ accountId: forecast.account.id, accountName: forecast.account.name, currency: forecast.account.currency, date: firstNegative.date, balance: firstNegative.balance, after: firstNegative.label }] : [];
  });

  return {
    range,
    timeline,
    accountForecasts,
    totals: [...totals].map(([currency, value]) => ({ currency, ...value, netScheduled: value.income - value.bills })).sort((a, b) => a.currency.localeCompare(b.currency)),
    liquidity: [...liquid].map(([currency, value]) => ({ currency, ...value })).sort((a, b) => a.currency.localeCompare(b.currency)),
    warnings,
    nextBill: timeline.find((entry) => entry.type === "bill") ?? null,
    nextPayday: timeline.find((entry) => entry.type === "income") ?? null,
  };
}

export function getProjectedAccountBalance(forecast: ReturnType<typeof buildKnownCashFlowForecast>, accountId: string, onDate: string) {
  const account = forecast.accountForecasts.find((item) => item.account.id === accountId);
  if (!account) return null;
  return account.points.filter((point) => point.date <= onDate).at(-1)?.balance ?? account.startingBalance;
}

export function getUnassignedObligations(forecast: ReturnType<typeof buildKnownCashFlowForecast>) {
  return forecast.totals.map((item) => ({ currency: item.currency, bills: item.unassignedBills, income: item.unassignedIncome }));
}

export function getLiquidAccountTypes() {
  return [...LIQUID_ACCOUNT_TYPES];
}
