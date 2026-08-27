import { describe, expect, it } from "vitest";

import { buildKnownCashFlowForecast, getProjectedAccountBalance, getUnassignedObligations } from "./cash-flow-planning";
import { moneyToDecimal } from "./money";

const accounts = [
  { id: "chequing", name: "Chequing", accountType: "chequing", currency: "CAD", currentBalance: "2300", archivedAt: null },
  { id: "card", name: "Credit card", accountType: "credit_card", currency: "CAD", currentBalance: "-100", archivedAt: null },
  { id: "usd", name: "USD Cash", accountType: "cash", currency: "USD", currentBalance: "100", archivedAt: null },
];
const schedules = [
  { id: "rent", sourceType: "bill" as const, name: "Rent", amount: "1550", currency: "CAD", frequency: "monthly" as const, anchorDate: "2026-09-01", nextDate: "2026-09-01", accountId: "chequing", active: true },
  { id: "pay", sourceType: "income" as const, name: "Payday", amount: "900", currency: "CAD", frequency: "biweekly" as const, anchorDate: "2026-09-05", nextDate: "2026-09-05", accountId: "chequing", active: true },
  { id: "phone", sourceType: "bill" as const, name: "Phone", amount: "55", currency: "CAD", frequency: "monthly" as const, anchorDate: "2026-09-12", nextDate: "2026-09-12", accountId: null, active: true },
  { id: "usd-bill", sourceType: "bill" as const, name: "USD Bill", amount: "20", currency: "USD", frequency: "monthly" as const, anchorDate: "2026-09-03", nextDate: "2026-09-03", accountId: "usd", active: true },
  { id: "paused", sourceType: "bill" as const, name: "Paused", amount: "999", currency: "CAD", frequency: "weekly" as const, anchorDate: "2026-09-01", nextDate: "2026-09-01", accountId: "chequing", active: false },
];
const range = { start: "2026-09-01", end: "2026-09-30" };

describe("known cash-flow planning", () => {
  const forecast = buildKnownCashFlowForecast(accounts, schedules, range);

  it("orders the timeline chronologically and excludes paused schedules", () => {
    expect(forecast.timeline.map((entry) => `${entry.date}:${entry.name}`)).toEqual(["2026-09-01:Rent", "2026-09-03:USD Bill", "2026-09-05:Payday", "2026-09-12:Phone", "2026-09-19:Payday"]);
  });

  it("applies bills, income, and multiple occurrences to assigned accounts", () => {
    expect(moneyToDecimal(getProjectedAccountBalance(forecast, "chequing", "2026-09-05")!)).toBe("1650.0000");
    expect(moneyToDecimal(getProjectedAccountBalance(forecast, "chequing", "2026-09-30")!)).toBe("2550.0000");
  });

  it("keeps currencies separate and excludes credit cards from liquidity", () => {
    expect(forecast.liquidity.map((item) => [item.currency, moneyToDecimal(item.current), moneyToDecimal(item.projected)])).toEqual([["CAD", "2300.0000", "2550.0000"], ["USD", "100.0000", "80.0000"]]);
  });

  it("reports unassigned obligations without subtracting them from an account", () => {
    expect(getUnassignedObligations(forecast).map((item) => [item.currency, moneyToDecimal(item.bills)])).toEqual([["CAD", "55.0000"], ["USD", "0.0000"]]);
  });

  it("detects the first known below-zero account point", () => {
    const short = buildKnownCashFlowForecast([{ ...accounts[0], currentBalance: "100" }], [schedules[0]], range);
    expect(short.warnings).toEqual([{ accountId: "chequing", accountName: "Chequing", currency: "CAD", date: "2026-09-01", balance: BigInt(-14500000), after: "Rent" }]);
  });

  it("ignores recorded occurrences and transfer-like data is not part of schedule input", () => {
    const reconciled = buildKnownCashFlowForecast(accounts, schedules, range, new Set(["bill:rent:2026-09-01"]));
    expect(reconciled.timeline.some((entry) => entry.sourceId === "rent")).toBe(false);
    expect(moneyToDecimal(getProjectedAccountBalance(reconciled, "chequing", range.end)!)).toBe("4100.0000");
  });
});
