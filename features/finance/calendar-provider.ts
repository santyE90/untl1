import "server-only";

import type { CalendarProviderContext, CalendarSourceProvider } from "@/features/calendar/provider";
import { financeEntryToCalendarItem } from "@/features/calendar/projection";
import type { DateRange } from "@/features/shared/date-ranges";

import { buildCashFlowTimeline } from "./cash-flow-planning";
import type { RecurringProjectionSource } from "./recurrence-expansion";

export async function getFinanceCalendarItems(range: DateRange, context: CalendarProviderContext) {
  const [billsResult, incomeResult, recordedResult, accountsResult] = await Promise.all([
    context.supabase.from("recurring_bills").select("id,name,expected_amount,currency,frequency,anchor_date,next_due_date,account_id,is_active").eq("is_active", true).lte("next_due_date", range.end),
    context.supabase.from("recurring_income").select("id,name,expected_amount,currency,frequency,anchor_date,next_payday,destination_account_id,is_active").eq("is_active", true).lte("next_payday", range.end),
    context.supabase.from("finance_transactions").select("recurring_bill_id,recurring_income_id,transaction_date").eq("status", "posted").gte("transaction_date", range.start).lte("transaction_date", range.end).or("recurring_bill_id.not.is.null,recurring_income_id.not.is.null"),
    context.supabase.from("finance_accounts").select("id,name"),
  ]);
  const error = billsResult.error ?? incomeResult.error ?? recordedResult.error ?? accountsResult.error;
  if (error) throw new Error(`Unable to load Finance Calendar items: ${error.message}`);
  const schedules: RecurringProjectionSource[] = [
    ...(billsResult.data ?? []).map((row) => ({ id: row.id, sourceType: "bill" as const, name: row.name, amount: String(row.expected_amount), currency: row.currency, frequency: row.frequency as RecurringProjectionSource["frequency"], anchorDate: row.anchor_date, nextDate: row.next_due_date, accountId: row.account_id, active: row.is_active })),
    ...(incomeResult.data ?? []).map((row) => ({ id: row.id, sourceType: "income" as const, name: row.name, amount: String(row.expected_amount), currency: row.currency, frequency: row.frequency as RecurringProjectionSource["frequency"], anchorDate: row.anchor_date, nextDate: row.next_payday, accountId: row.destination_account_id, active: row.is_active })),
  ];
  const recordedIds = new Set<string>();
  for (const row of recordedResult.data ?? []) {
    if (row.recurring_bill_id) recordedIds.add(`bill:${row.recurring_bill_id}:${row.transaction_date}`);
    if (row.recurring_income_id) recordedIds.add(`income:${row.recurring_income_id}:${row.transaction_date}`);
  }
  const accountNames = new Map((accountsResult.data ?? []).map((row) => [row.id, row.name]));
  return buildCashFlowTimeline(schedules, range, recordedIds).map((entry) => financeEntryToCalendarItem(entry, entry.accountId ? accountNames.get(entry.accountId) ?? null : null));
}

export const financeCalendarProvider: CalendarSourceProvider = { id: "finance", getItems: getFinanceCalendarItems };
