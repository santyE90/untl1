"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAuthenticatedAppContext } from "../shared/server-context";
import { createNativeCalendarEvent, updateNativeCalendarEvent } from "./mutations";
import { calendarEventIdSchema, calendarEventSchema } from "./schemas";

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");

function destinationError(destination: string, message: string): never {
  redirect(`${destination}?error=${encodeURIComponent(message)}`);
}

function eventInput(formData: FormData) {
  const parsed = calendarEventSchema.safeParse({
    title: text(formData, "title"), eventType: text(formData, "eventType"), allDay: formData.get("allDay") === "on",
    startDate: text(formData, "startDate"), endDate: text(formData, "endDate"), startsAtLocal: text(formData, "startsAtLocal"), endsAtLocal: text(formData, "endsAtLocal"),
    description: text(formData, "description"), location: text(formData, "location"), recurrenceFrequency: text(formData, "recurrenceFrequency"), recurrenceUntil: text(formData, "recurrenceUntil"), reminderOffsets: formData.getAll("reminderOffsets"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check the event details.");
  return parsed.data;
}

export async function createCalendarEvent(formData: FormData) {
  let input; try { input = eventInput(formData); } catch (error) { destinationError("/calendar/new", error instanceof Error ? error.message : "Check the event details."); }
  const result = await createNativeCalendarEvent(input, await getAuthenticatedAppContext());
  if (!result.ok) destinationError("/calendar/new", result.error.message);
  revalidatePath("/calendar", "layout");
  revalidatePath("/dashboard");
  redirect("/calendar?success=Event%20created.");
}

export async function updateCalendarEvent(formData: FormData) {
  const id = text(formData, "id");
  const parsedId = calendarEventIdSchema.safeParse(id);
  if (!parsedId.success) destinationError("/calendar", "Event is invalid.");
  let input; try { input = eventInput(formData); } catch (error) { destinationError(`/calendar/events/${id}/edit`, error instanceof Error ? error.message : "Check the event details."); }
  const result = await updateNativeCalendarEvent(id, input, await getAuthenticatedAppContext());
  if (!result.ok) destinationError(result.error.code === "not_found" ? "/calendar" : `/calendar/events/${id}/edit`, result.error.message);
  revalidatePath("/calendar", "layout"); revalidatePath("/dashboard");
  redirect(`/calendar/events/${id}?success=Event%20updated.`);
}

export async function archiveCalendarEvent(formData: FormData) {
  const id = text(formData, "id");
  if (!calendarEventIdSchema.safeParse(id).success) destinationError("/calendar", "Event is invalid.");
  const context = await getAuthenticatedAppContext();
  const { data, error } = await context.supabase.from("calendar_events").update({ archived_at: new Date().toISOString() }).eq("id", id).eq("user_id", context.user.id).is("archived_at", null).select("id").maybeSingle();
  if (error) destinationError(`/calendar/events/${id}`, error.message);
  if (!data) destinationError("/calendar", "Event was not found.");
  revalidatePath("/calendar", "layout"); revalidatePath("/dashboard");
  redirect("/calendar?success=Event%20archived.");
}

export async function restoreCalendarEvent(formData: FormData) {
  const id = text(formData, "id");
  if (!calendarEventIdSchema.safeParse(id).success) destinationError("/calendar/settings", "Event is invalid.");
  const context = await getAuthenticatedAppContext();
  const { data, error } = await context.supabase.from("calendar_events").update({ archived_at: null }).eq("id", id).eq("user_id", context.user.id).not("archived_at", "is", null).select("id").maybeSingle();
  if (error) destinationError("/calendar/settings", error.message);
  if (!data) destinationError("/calendar/settings", "Archived event was not found.");
  revalidatePath("/calendar", "layout"); revalidatePath("/dashboard");
  redirect("/calendar/settings?success=Event%20restored.");
}

export async function saveCalendarDefaultView(formData: FormData) {
  const view = text(formData, "view");
  if (!["month", "week", "day", "agenda"].includes(view)) destinationError("/calendar/settings", "Choose a valid Calendar view.");
  const context = await getAuthenticatedAppContext();
  const { error } = await context.supabase.from("profiles").update({ calendar_default_view: view }).eq("id", context.user.id);
  if (error) destinationError("/calendar/settings", error.message);
  revalidatePath("/calendar", "layout");
  redirect("/calendar/settings?success=Default%20view%20saved.");
}
