import "server-only";

import type { Database } from "@/types/database";
import type { ServiceResult } from "../shared/service-result";
import { serviceFailure, serviceSuccess } from "../shared/service-result";
import type { AuthenticatedAppContext } from "../shared/server-context";
import { assertCalendarDate, zonedLocalDateTimeToUtc } from "./dates";
import { calendarEventSchema } from "./schemas";

type EventInsert = Database["public"]["Tables"]["calendar_events"]["Insert"];
type EventValues = Pick<EventInsert, "title" | "event_type" | "all_day" | "starts_at" | "ends_at" | "start_date" | "end_date" | "description" | "location" | "recurrence_frequency" | "recurrence_until" | "recurrence_timezone">;
export type CalendarEventMutationResult = Pick<Database["public"]["Tables"]["calendar_events"]["Row"], "id" | "title" | "event_type" | "all_day" | "starts_at" | "ends_at" | "start_date" | "end_date" | "description" | "location" | "recurrence_frequency" | "recurrence_until" | "recurrence_timezone" | "updated_at">;

export function parseCalendarEventMutation(input: unknown, timeZone: string): ServiceResult<{ values: EventValues; reminderOffsets: number[] }> {
  const parsed = calendarEventSchema.safeParse(input);
  if (!parsed.success) return serviceFailure("validation", parsed.error.issues[0]?.message ?? "Check the event details.");
  const data = parsed.data;
  try {
    if (data.allDay) {
      assertCalendarDate(data.startDate); assertCalendarDate(data.endDate);
      return serviceSuccess({ values: { title: data.title, event_type: data.eventType, all_day: true, starts_at: null, ends_at: null, start_date: data.startDate, end_date: data.endDate, description: data.description, location: data.location, recurrence_frequency: data.recurrenceFrequency, recurrence_until: data.recurrenceUntil || null, recurrence_timezone: null }, reminderOffsets: data.reminderOffsets });
    }
    const startsAt = zonedLocalDateTimeToUtc(data.startsAtLocal, timeZone);
    const endsAt = zonedLocalDateTimeToUtc(data.endsAtLocal, timeZone);
    if (endsAt <= startsAt) return serviceFailure("validation", "End time must be after start time.");
    return serviceSuccess({ values: { title: data.title, event_type: data.eventType, all_day: false, starts_at: startsAt, ends_at: endsAt, start_date: null, end_date: null, description: data.description, location: data.location, recurrence_frequency: data.recurrenceFrequency, recurrence_until: data.recurrenceUntil || null, recurrence_timezone: data.recurrenceFrequency ? timeZone : null }, reminderOffsets: data.reminderOffsets });
  } catch (error) { return serviceFailure("validation", error instanceof Error ? error.message : "Check the event details."); }
}

const selection = "id,title,event_type,all_day,starts_at,ends_at,start_date,end_date,description,location,recurrence_frequency,recurrence_until,recurrence_timezone,updated_at" as const;

export async function createNativeCalendarEvent(input: unknown, context: AuthenticatedAppContext): Promise<ServiceResult<CalendarEventMutationResult>> {
  const parsed = parseCalendarEventMutation(input, context.timeZone);
  if (!parsed.ok) return parsed;
  const result = await context.supabase.from("calendar_events").insert({ user_id: context.user.id, ...parsed.data.values }).select(selection).single();
  if (result.error) return serviceFailure("unexpected", "The Calendar event could not be created.");
  if (parsed.data.reminderOffsets.length) {
    const reminders = await context.supabase.rpc("save_calendar_event_reminders", { target_event_id: result.data.id, reminder_offsets: parsed.data.reminderOffsets });
    if (reminders.error) return serviceFailure("unexpected", "The event was created, but its reminders could not be saved.");
  }
  return serviceSuccess(result.data);
}

export async function updateNativeCalendarEvent(id: string, input: unknown, context: AuthenticatedAppContext, options: { expectedUpdatedAt?: string; preserveReminders?: boolean } = {}): Promise<ServiceResult<CalendarEventMutationResult>> {
  const existing = await context.supabase.from("calendar_events").select("id,recurrence_timezone,updated_at").eq("id", id).eq("user_id", context.user.id).is("archived_at", null).maybeSingle();
  if (existing.error) return serviceFailure("unexpected", "The Calendar event could not be checked.");
  if (!existing.data) return serviceFailure("not_found", "The Calendar event is unavailable.");
  if (options.expectedUpdatedAt && existing.data.updated_at !== options.expectedUpdatedAt) return serviceFailure("conflict", "The Calendar event changed after this proposal. Please review it again.");
  const parsed = parseCalendarEventMutation(input, existing.data.recurrence_timezone ?? context.timeZone);
  if (!parsed.ok) return parsed;
  let query = context.supabase.from("calendar_events").update(parsed.data.values).eq("id", id).eq("user_id", context.user.id).is("archived_at", null);
  if (options.expectedUpdatedAt) query = query.eq("updated_at", options.expectedUpdatedAt);
  const result = await query.select(selection).maybeSingle();
  if (result.error) return serviceFailure("unexpected", "The Calendar event could not be updated.");
  if (!result.data) return serviceFailure(options.expectedUpdatedAt ? "conflict" : "not_found", options.expectedUpdatedAt ? "The Calendar event changed after this proposal. Please review it again." : "The Calendar event is unavailable.");
  if (!options.preserveReminders) {
    const reminders = await context.supabase.rpc("save_calendar_event_reminders", { target_event_id: id, reminder_offsets: parsed.data.reminderOffsets });
    if (reminders.error) return serviceFailure("unexpected", "The event was updated, but its reminders could not be saved.");
  }
  return serviceSuccess(result.data);
}
