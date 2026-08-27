import "server-only";

import { notFound } from "next/navigation";

import { financeCalendarProvider } from "@/features/finance/calendar-provider";
import { goalCalendarProvider } from "@/features/goals/calendar-provider";
import { schoolCalendarProvider } from "@/features/school/calendar-provider";
import type { DateRange } from "@/features/shared/date-ranges";
import { getAuthenticatedAppContext, type AuthenticatedAppContext } from "@/features/shared/server-context";
import { taskCalendarProvider } from "@/features/tasks/calendar-provider";

import { nativeCalendarProvider, nativeEvent, nativeSelect } from "./native-calendar-provider";
import { combineCalendarItems } from "./projection";
import type { CalendarSourceProvider } from "./provider";

export const calendarSourceProviders: readonly CalendarSourceProvider[] = [
  nativeCalendarProvider,
  financeCalendarProvider,
  schoolCalendarProvider,
  taskCalendarProvider,
  goalCalendarProvider,
];

export async function getCalendarContext(context?: AuthenticatedAppContext) {
  const app = context ?? await getAuthenticatedAppContext();
  return {
    ...app,
    weekStartsOn: app.profile.week_starts_on,
    defaultView: app.profile.calendar_default_view as "month" | "week" | "day" | "agenda",
  };
}

export async function getCalendarItems(range: DateRange, suppliedContext?: AuthenticatedAppContext) {
  const context = suppliedContext ?? await getAuthenticatedAppContext();
  const providerItems = await Promise.all(calendarSourceProviders.map((provider) => provider.getItems(range, context)));
  return combineCalendarItems(providerItems.flat(), range, context.timeZone);
}

export async function getNativeCalendarEvent(id: string) {
  const context = await getCalendarContext();
  const { data, error } = await context.supabase.from("calendar_events").select(nativeSelect).eq("id", id).is("archived_at", null).maybeSingle();
  if (error) throw new Error(`Unable to load event: ${error.message}`);
  if (!data) notFound();
  const { data: reminders, error: reminderError } = await context.supabase.from("calendar_event_reminders").select("offset_minutes").eq("event_id", id).order("offset_minutes");
  if (reminderError) throw new Error(`Unable to load event reminders: ${reminderError.message}`);
  return { event: nativeEvent(data, (reminders ?? []).map((row) => row.offset_minutes)), timeZone: context.timeZone };
}

export async function getArchivedCalendarEvents() {
  const context = await getCalendarContext();
  const { data, error } = await context.supabase.from("calendar_events").select(nativeSelect).not("archived_at", "is", null).order("archived_at", { ascending: false });
  if (error) throw new Error(`Unable to load archived events: ${error.message}`);
  return { events: (data ?? []).map((row) => nativeEvent(row)), timeZone: context.timeZone, defaultView: context.defaultView };
}
