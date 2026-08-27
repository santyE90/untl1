import "server-only";

import { notFound } from "next/navigation";

import { buildCashFlowTimeline } from "@/features/finance/cash-flow-planning";
import { addCalendarDays, currentDateInTimeZone, type DateRange } from "@/features/finance/date-ranges";
import type { RecurringProjectionSource } from "@/features/finance/recurrence-expansion";
import { requireAuthenticatedUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

import { zonedLocalDateTimeToUtc } from "./dates";
import { expandNativeEvent } from "./native-recurrence";
import { combineCalendarItems, financeEntryToCalendarItem } from "./projection";
import type { NativeCalendarEvent } from "./types";
import { getSchoolCalendarItems } from "@/features/school/calendar-provider";

function nativeEvent(row: {
  id: string; title: string; event_type: string | null; all_day: boolean;
  starts_at: string | null; ends_at: string | null; start_date: string | null;
  end_date: string | null; description: string | null; location: string | null;
  archived_at: string | null;
  recurrence_frequency: string | null; recurrence_until: string | null; recurrence_timezone: string | null;
}, reminderOffsets: number[] = []): NativeCalendarEvent {
  return { id: row.id, title: row.title, eventType: row.event_type, allDay: row.all_day, startsAt: row.starts_at, endsAt: row.ends_at, startDate: row.start_date, endDate: row.end_date, description: row.description, location: row.location, archivedAt: row.archived_at, recurrenceFrequency: row.recurrence_frequency as NativeCalendarEvent["recurrenceFrequency"], recurrenceUntil: row.recurrence_until, recurrenceTimezone: row.recurrence_timezone, reminderOffsets };
}

const nativeSelect = "id,title,event_type,all_day,starts_at,ends_at,start_date,end_date,description,location,archived_at,recurrence_frequency,recurrence_until,recurrence_timezone" as const;

export async function getCalendarContext() {
  const user = await requireAuthenticatedUser();
  const supabase = await createClient();
  const { data: profile, error } = await supabase.from("profiles").select("timezone,week_starts_on,calendar_default_view").eq("id", user.id).single();
  if (error) throw new Error(`Unable to load calendar preferences: ${error.message}`);
  return { user, supabase, timeZone: profile.timezone, weekStartsOn: profile.week_starts_on, defaultView: profile.calendar_default_view as "month" | "week" | "day" | "agenda", today: currentDateInTimeZone(profile.timezone) };
}

export async function getCalendarItems(range: DateRange) {
  const schoolItemsPromise = getSchoolCalendarItems(range);
  const { supabase, timeZone } = await getCalendarContext();
  const rangeStartInstant = zonedLocalDateTimeToUtc(`${range.start}T00:00`, timeZone);
  const rangeEndExclusive = zonedLocalDateTimeToUtc(`${addCalendarDays(range.end, 1)}T00:00`, timeZone);

  const recurrenceBound = `recurrence_until.is.null,recurrence_until.gte.${range.start}`;
  const [allDayResult, timedResult, recurringAllDayResult, recurringTimedResult, billsResult, incomeResult, recordedResult, accountsResult] = await Promise.all([
    supabase.from("calendar_events").select(nativeSelect).is("archived_at", null).is("recurrence_frequency", null).eq("all_day", true).lte("start_date", range.end).gte("end_date", range.start),
    supabase.from("calendar_events").select(nativeSelect).is("archived_at", null).is("recurrence_frequency", null).eq("all_day", false).lt("starts_at", rangeEndExclusive).gt("ends_at", rangeStartInstant),
    supabase.from("calendar_events").select(nativeSelect).is("archived_at", null).not("recurrence_frequency", "is", null).eq("all_day", true).lte("start_date", range.end).or(recurrenceBound),
    supabase.from("calendar_events").select(nativeSelect).is("archived_at", null).not("recurrence_frequency", "is", null).eq("all_day", false).or(recurrenceBound),
    supabase.from("recurring_bills").select("id,name,expected_amount,currency,frequency,anchor_date,next_due_date,account_id,is_active").eq("is_active", true).lte("next_due_date", range.end),
    supabase.from("recurring_income").select("id,name,expected_amount,currency,frequency,anchor_date,next_payday,destination_account_id,is_active").eq("is_active", true).lte("next_payday", range.end),
    supabase.from("finance_transactions").select("recurring_bill_id,recurring_income_id,transaction_date").eq("status", "posted").gte("transaction_date", range.start).lte("transaction_date", range.end).or("recurring_bill_id.not.is.null,recurring_income_id.not.is.null"),
    supabase.from("finance_accounts").select("id,name"),
  ]);
  const error = allDayResult.error ?? timedResult.error ?? recurringAllDayResult.error ?? recurringTimedResult.error ?? billsResult.error ?? incomeResult.error ?? recordedResult.error ?? accountsResult.error;
  if (error) throw new Error(`Unable to load Calendar: ${error.message}`);

  const nativeRows = [...(allDayResult.data ?? []), ...(timedResult.data ?? []), ...(recurringAllDayResult.data ?? []), ...(recurringTimedResult.data ?? [])];
  const nativeIds = [...new Set(nativeRows.map((row) => row.id))];
  const remindersResult = nativeIds.length ? await supabase.from("calendar_event_reminders").select("event_id,offset_minutes").in("event_id", nativeIds) : { data: [], error: null };
  if (remindersResult.error) throw new Error(`Unable to load Calendar reminders: ${remindersResult.error.message}`);
  const reminders = new Map<string, number[]>();
  for (const row of remindersResult.data ?? []) reminders.set(row.event_id, [...(reminders.get(row.event_id) ?? []), row.offset_minutes]);

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
  const uniqueNativeRows = [...new Map(nativeRows.map((row) => [row.id, row])).values()];
  const nativeItems = uniqueNativeRows.flatMap((row) => expandNativeEvent(nativeEvent(row, reminders.get(row.id) ?? []), range, timeZone));
  const financeItems = buildCashFlowTimeline(schedules, range, recordedIds).map((entry) => financeEntryToCalendarItem(entry, entry.accountId ? accountNames.get(entry.accountId) ?? null : null));
  return combineCalendarItems([...nativeItems, ...financeItems, ...await schoolItemsPromise], range, timeZone);
}

export async function getNativeCalendarEvent(id: string) {
  const { supabase, timeZone } = await getCalendarContext();
  const { data, error } = await supabase.from("calendar_events").select(nativeSelect).eq("id", id).is("archived_at", null).maybeSingle();
  if (error) throw new Error(`Unable to load event: ${error.message}`);
  if (!data) notFound();
  const { data: reminders, error: reminderError } = await supabase.from("calendar_event_reminders").select("offset_minutes").eq("event_id", id).order("offset_minutes");
  if (reminderError) throw new Error(`Unable to load event reminders: ${reminderError.message}`);
  return { event: nativeEvent(data, (reminders ?? []).map((row) => row.offset_minutes)), timeZone };
}

export async function getArchivedCalendarEvents() {
  const { supabase, timeZone, defaultView } = await getCalendarContext();
  const { data, error } = await supabase.from("calendar_events").select(nativeSelect).not("archived_at", "is", null).order("archived_at", { ascending: false });
  if (error) throw new Error(`Unable to load archived events: ${error.message}`);
  return { events: (data ?? []).map((row) => nativeEvent(row)), timeZone, defaultView };
}
