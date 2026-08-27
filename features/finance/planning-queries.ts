import "server-only";

import { requireAuthenticatedUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import type { AuthenticatedAppContext } from "@/features/shared/server-context";

import { buildKnownCashFlowForecast, type PlanningAccount } from "./cash-flow-planning";
import { currentDateInTimeZone } from "./date-ranges";
import { resolveForecastRange } from "./forecast-range";
import type { RecurringProjectionSource } from "./recurrence-expansion";

export async function getCashFlowForecast(horizon?: string, through?: string, context?: AuthenticatedAppContext) {
  const user = context?.user ?? await requireAuthenticatedUser();
  const supabase = context?.supabase ?? await createClient();
  const profile = context?.profile ?? (await supabase.from("profiles").select("timezone").eq("id", user.id).single()).data;
  if (!profile) throw new Error("Unable to load planning preferences.");
  const today = context?.today ?? currentDateInTimeZone(profile.timezone);
  const selection = resolveForecastRange(today, horizon, through);

  const [accountsResult, billsResult, incomeResult, recordedResult] = await Promise.all([
    supabase.from("finance_account_balances").select("id,name,account_type,currency,current_balance,archived_at"),
    supabase.from("recurring_bills").select("id,name,expected_amount,currency,frequency,anchor_date,next_due_date,account_id,is_active"),
    supabase.from("recurring_income").select("id,name,expected_amount,currency,frequency,anchor_date,next_payday,destination_account_id,is_active"),
    supabase.from("finance_transactions").select("recurring_bill_id,recurring_income_id,transaction_date,status").eq("status", "posted").gte("transaction_date", selection.range.start).lte("transaction_date", selection.range.end).or("recurring_bill_id.not.is.null,recurring_income_id.not.is.null"),
  ]);
  const error = accountsResult.error ?? billsResult.error ?? incomeResult.error ?? recordedResult.error;
  if (error) throw new Error(`Unable to load cash-flow planning data: ${error.message}`);

  const accounts: PlanningAccount[] = (accountsResult.data ?? []).flatMap((row) => row.id && row.name && row.account_type && row.currency ? [{ id: row.id, name: row.name, accountType: row.account_type, currency: row.currency, currentBalance: String(row.current_balance ?? 0), archivedAt: row.archived_at }] : []);
  const schedules: RecurringProjectionSource[] = [
    ...(billsResult.data ?? []).map((bill) => ({ id: bill.id, sourceType: "bill" as const, name: bill.name, amount: String(bill.expected_amount), currency: bill.currency, frequency: bill.frequency as RecurringProjectionSource["frequency"], anchorDate: bill.anchor_date, nextDate: bill.next_due_date, accountId: bill.account_id, active: bill.is_active })),
    ...(incomeResult.data ?? []).map((income) => ({ id: income.id, sourceType: "income" as const, name: income.name, amount: String(income.expected_amount), currency: income.currency, frequency: income.frequency as RecurringProjectionSource["frequency"], anchorDate: income.anchor_date, nextDate: income.next_payday, accountId: income.destination_account_id, active: income.is_active })),
  ];
  const recordedOccurrenceIds = new Set<string>();
  for (const row of recordedResult.data ?? []) {
    if (row.recurring_bill_id) recordedOccurrenceIds.add(`bill:${row.recurring_bill_id}:${row.transaction_date}`);
    if (row.recurring_income_id) recordedOccurrenceIds.add(`income:${row.recurring_income_id}:${row.transaction_date}`);
  }
  return { today, horizon: selection.horizon, ...buildKnownCashFlowForecast(accounts, schedules, selection.range, recordedOccurrenceIds) };
}

export async function getUpcomingBills(horizon: string = "30") {
  const forecast = await getCashFlowForecast(horizon);
  return forecast.timeline.filter((entry) => entry.type === "bill");
}

export async function getNextPayday() {
  const forecast = await getCashFlowForecast("90");
  return forecast.nextPayday;
}

export async function getFinancialWarnings(horizon: string = "30") {
  const forecast = await getCashFlowForecast(horizon);
  return forecast.warnings;
}
