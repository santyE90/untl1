"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

import { assertCalendarDate, zonedLocalDateTimeToUtc } from "./dates";
import { calendarEventIdSchema, calendarEventSchema } from "./schemas";

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");

function destinationError(destination: string, message: string): never {
  redirect(`${destination}?error=${encodeURIComponent(message)}`);
}

async function mutationContext() {
  const user = await requireAuthenticatedUser();
  const supabase = await createClient();
  const { data: profile, error } = await supabase.from("profiles").select("timezone").eq("id", user.id).single();
  if (error) throw new Error(`Unable to load timezone: ${error.message}`);
  return { user, supabase, timeZone: profile.timezone };
}

function parseEvent(formData: FormData, timeZone: string) {
  const parsed = calendarEventSchema.safeParse({
    title: text(formData, "title"), eventType: text(formData, "eventType"), allDay: formData.get("allDay") === "on",
    startDate: text(formData, "startDate"), endDate: text(formData, "endDate"), startsAtLocal: text(formData, "startsAtLocal"), endsAtLocal: text(formData, "endsAtLocal"),
    description: text(formData, "description"), location: text(formData, "location"), recurrenceFrequency: text(formData, "recurrenceFrequency"), recurrenceUntil: text(formData, "recurrenceUntil"), reminderOffsets: formData.getAll("reminderOffsets"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check the event details.");
  const data = parsed.data;
  if (data.allDay) {
    assertCalendarDate(data.startDate); assertCalendarDate(data.endDate);
    return { values: { title: data.title, event_type: data.eventType, all_day: true, starts_at: null, ends_at: null, start_date: data.startDate, end_date: data.endDate, description: data.description, location: data.location, recurrence_frequency: data.recurrenceFrequency, recurrence_until: data.recurrenceUntil || null, recurrence_timezone: null }, reminderOffsets: data.reminderOffsets };
  }
  const startsAt = zonedLocalDateTimeToUtc(data.startsAtLocal, timeZone);
  const endsAt = zonedLocalDateTimeToUtc(data.endsAtLocal, timeZone);
  if (endsAt <= startsAt) throw new Error("End time must be after start time.");
  return { values: { title: data.title, event_type: data.eventType, all_day: false, starts_at: startsAt, ends_at: endsAt, start_date: null, end_date: null, description: data.description, location: data.location, recurrence_frequency: data.recurrenceFrequency, recurrence_until: data.recurrenceUntil || null, recurrence_timezone: data.recurrenceFrequency ? timeZone : null }, reminderOffsets: data.reminderOffsets };
}

export async function createCalendarEvent(formData: FormData) {
  const context = await mutationContext();
  let values;
  try { values = parseEvent(formData, context.timeZone); } catch (error) { destinationError("/calendar/new", error instanceof Error ? error.message : "Check the event details."); }
  const { data: created, error } = await context.supabase.from("calendar_events").insert({ user_id: context.user.id, ...values.values }).select("id").single();
  if (error) destinationError("/calendar/new", error.message);
  const { error: reminderError } = await context.supabase.rpc("save_calendar_event_reminders", { target_event_id: created.id, reminder_offsets: values.reminderOffsets });
  if (reminderError) destinationError(`/calendar/events/${created.id}/edit`, `Event created, but reminders need to be saved again: ${reminderError.message}`);
  revalidatePath("/calendar", "layout");
  revalidatePath("/dashboard");
  redirect("/calendar?success=Event%20created.");
}

export async function updateCalendarEvent(formData: FormData) {
  const id = text(formData, "id");
  const parsedId = calendarEventIdSchema.safeParse(id);
  if (!parsedId.success) destinationError("/calendar", "Event is invalid.");
  const context = await mutationContext();
  const { data: existing, error: existingError } = await context.supabase.from("calendar_events").select("recurrence_timezone").eq("id", id).eq("user_id", context.user.id).is("archived_at", null).maybeSingle();
  if (existingError) destinationError(`/calendar/events/${id}/edit`, existingError.message);
  if (!existing) destinationError("/calendar", "Event was not found.");
  let values;
  try { values = parseEvent(formData, existing.recurrence_timezone ?? context.timeZone); } catch (error) { destinationError(`/calendar/events/${id}/edit`, error instanceof Error ? error.message : "Check the event details."); }
  const { data, error } = await context.supabase.from("calendar_events").update(values.values).eq("id", id).eq("user_id", context.user.id).is("archived_at", null).select("id").maybeSingle();
  if (error) destinationError(`/calendar/events/${id}/edit`, error.message);
  if (!data) destinationError("/calendar", "Event was not found.");
  const { error: reminderError } = await context.supabase.rpc("save_calendar_event_reminders", { target_event_id: id, reminder_offsets: values.reminderOffsets });
  if (reminderError) destinationError(`/calendar/events/${id}/edit`, `Event updated, but reminders need to be saved again: ${reminderError.message}`);
  revalidatePath("/calendar", "layout"); revalidatePath("/dashboard");
  redirect(`/calendar/events/${id}?success=Event%20updated.`);
}

export async function archiveCalendarEvent(formData: FormData) {
  const id = text(formData, "id");
  if (!calendarEventIdSchema.safeParse(id).success) destinationError("/calendar", "Event is invalid.");
  const { user, supabase } = await mutationContext();
  const { data, error } = await supabase.from("calendar_events").update({ archived_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).is("archived_at", null).select("id").maybeSingle();
  if (error) destinationError(`/calendar/events/${id}`, error.message);
  if (!data) destinationError("/calendar", "Event was not found.");
  revalidatePath("/calendar", "layout"); revalidatePath("/dashboard");
  redirect("/calendar?success=Event%20archived.");
}

export async function restoreCalendarEvent(formData: FormData) {
  const id = text(formData, "id");
  if (!calendarEventIdSchema.safeParse(id).success) destinationError("/calendar/settings", "Event is invalid.");
  const { user, supabase } = await mutationContext();
  const { data, error } = await supabase.from("calendar_events").update({ archived_at: null }).eq("id", id).eq("user_id", user.id).not("archived_at", "is", null).select("id").maybeSingle();
  if (error) destinationError("/calendar/settings", error.message);
  if (!data) destinationError("/calendar/settings", "Archived event was not found.");
  revalidatePath("/calendar", "layout"); revalidatePath("/dashboard");
  redirect("/calendar/settings?success=Event%20restored.");
}

export async function saveCalendarDefaultView(formData: FormData) {
  const view = text(formData, "view");
  if (!["month", "week", "day", "agenda"].includes(view)) destinationError("/calendar/settings", "Choose a valid Calendar view.");
  const { user, supabase } = await mutationContext();
  const { error } = await supabase.from("profiles").update({ calendar_default_view: view }).eq("id", user.id);
  if (error) destinationError("/calendar/settings", error.message);
  revalidatePath("/calendar", "layout");
  redirect("/calendar/settings?success=Default%20view%20saved.");
}
