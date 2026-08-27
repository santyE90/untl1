import "server-only";

import { addCalendarDays, type DateRange } from "@/features/shared/date-ranges";

import { zonedLocalDateTimeToUtc } from "./dates";
import { expandNativeEvent } from "./native-recurrence";
import type { CalendarProviderContext, CalendarSourceProvider } from "./provider";
import type { NativeCalendarEvent } from "./types";

export const nativeSelect = "id,title,event_type,all_day,starts_at,ends_at,start_date,end_date,description,location,archived_at,recurrence_frequency,recurrence_until,recurrence_timezone" as const;

export function nativeEvent(row: {
  id: string; title: string; event_type: string | null; all_day: boolean;
  starts_at: string | null; ends_at: string | null; start_date: string | null;
  end_date: string | null; description: string | null; location: string | null;
  archived_at: string | null; recurrence_frequency: string | null;
  recurrence_until: string | null; recurrence_timezone: string | null;
}, reminderOffsets: number[] = []): NativeCalendarEvent {
  return { id: row.id, title: row.title, eventType: row.event_type, allDay: row.all_day, startsAt: row.starts_at, endsAt: row.ends_at, startDate: row.start_date, endDate: row.end_date, description: row.description, location: row.location, archivedAt: row.archived_at, recurrenceFrequency: row.recurrence_frequency as NativeCalendarEvent["recurrenceFrequency"], recurrenceUntil: row.recurrence_until, recurrenceTimezone: row.recurrence_timezone, reminderOffsets };
}

export async function getNativeCalendarItems(range: DateRange, context: CalendarProviderContext) {
  const rangeStartInstant = zonedLocalDateTimeToUtc(`${range.start}T00:00`, context.timeZone);
  const rangeEndExclusive = zonedLocalDateTimeToUtc(`${addCalendarDays(range.end, 1)}T00:00`, context.timeZone);
  const recurrenceBound = `recurrence_until.is.null,recurrence_until.gte.${range.start}`;
  const [allDayResult, timedResult, recurringAllDayResult, recurringTimedResult] = await Promise.all([
    context.supabase.from("calendar_events").select(nativeSelect).is("archived_at", null).is("recurrence_frequency", null).eq("all_day", true).lte("start_date", range.end).gte("end_date", range.start),
    context.supabase.from("calendar_events").select(nativeSelect).is("archived_at", null).is("recurrence_frequency", null).eq("all_day", false).lt("starts_at", rangeEndExclusive).gt("ends_at", rangeStartInstant),
    context.supabase.from("calendar_events").select(nativeSelect).is("archived_at", null).not("recurrence_frequency", "is", null).eq("all_day", true).lte("start_date", range.end).or(recurrenceBound),
    context.supabase.from("calendar_events").select(nativeSelect).is("archived_at", null).not("recurrence_frequency", "is", null).eq("all_day", false).lt("starts_at", rangeEndExclusive).or(recurrenceBound),
  ]);
  const error = allDayResult.error ?? timedResult.error ?? recurringAllDayResult.error ?? recurringTimedResult.error;
  if (error) throw new Error(`Unable to load native Calendar items: ${error.message}`);
  const rows = [...(allDayResult.data ?? []), ...(timedResult.data ?? []), ...(recurringAllDayResult.data ?? []), ...(recurringTimedResult.data ?? [])];
  const uniqueRows = [...new Map(rows.map((row) => [row.id, row])).values()];
  const ids = uniqueRows.map((row) => row.id);
  const remindersResult = ids.length ? await context.supabase.from("calendar_event_reminders").select("event_id,offset_minutes").in("event_id", ids) : { data: [], error: null };
  if (remindersResult.error) throw new Error(`Unable to load Calendar reminders: ${remindersResult.error.message}`);
  const reminders = new Map<string, number[]>();
  for (const row of remindersResult.data ?? []) reminders.set(row.event_id, [...(reminders.get(row.event_id) ?? []), row.offset_minutes]);
  return uniqueRows.flatMap((row) => expandNativeEvent(nativeEvent(row, reminders.get(row.id) ?? []), range, context.timeZone));
}

export const nativeCalendarProvider: CalendarSourceProvider = { id: "native", getItems: getNativeCalendarItems };
