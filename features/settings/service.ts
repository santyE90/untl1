import "server-only";

import { serviceFailure, serviceSuccess } from "@/features/shared/service-result";
import { getAuthenticatedAppContext, type AuthenticatedAppContext } from "@/features/shared/server-context";
import { calendarPreferenceSchema, generalPreferencesSchema, themePreferenceSchema } from "./schemas";

export async function updateProfilePreferences(input: unknown, suppliedContext?: AuthenticatedAppContext) {
  const parsed = generalPreferencesSchema.safeParse(input);
  if (!parsed.success) return serviceFailure("validation", parsed.error.issues[0]?.message ?? "Check the preferences.");
  const context = suppliedContext ?? await getAuthenticatedAppContext();
  const values = { currency: parsed.data.currency, timezone: parsed.data.timeZone, week_starts_on: parsed.data.weekStartsOn };
  const { data, error } = await context.supabase.from("profiles").update(values).eq("id", context.user.id).select("currency,timezone,week_starts_on,calendar_default_view").maybeSingle();
  if (error) return serviceFailure("unexpected", "LifeStack could not save these preferences. Try again.");
  if (!data) return serviceFailure("not_found", "Your profile could not be updated.");
  return serviceSuccess({ currency: data.currency, timeZone: data.timezone, weekStartsOn: data.week_starts_on, calendarDefaultView: data.calendar_default_view });
}

export async function updateCalendarPreference(input: unknown, suppliedContext?: AuthenticatedAppContext) {
  const parsed = calendarPreferenceSchema.safeParse(input);
  if (!parsed.success) return serviceFailure("validation", "Choose a valid Calendar view.");
  const context = suppliedContext ?? await getAuthenticatedAppContext();
  const { data, error } = await context.supabase.from("profiles").update({ calendar_default_view: parsed.data.defaultView }).eq("id", context.user.id).select("calendar_default_view").maybeSingle();
  if (error) return serviceFailure("unexpected", "LifeStack could not save the Calendar preference. Try again.");
  if (!data) return serviceFailure("not_found", "Your profile could not be updated.");
  return serviceSuccess({ defaultView: data.calendar_default_view as "month" | "week" | "day" | "agenda" });
}

export async function updateThemePreference(input: unknown, suppliedContext?: AuthenticatedAppContext) {
  const parsed = themePreferenceSchema.safeParse(input);
  if (!parsed.success) return serviceFailure("validation", "Choose System, Light, or Dark.");
  const context = suppliedContext ?? await getAuthenticatedAppContext();
  const { data, error } = await context.supabase.from("profiles").update({ theme_preference: parsed.data.theme }).eq("id", context.user.id).select("theme_preference").maybeSingle();
  if (error) return serviceFailure("unexpected", "LifeStack could not save the appearance preference. Try again.");
  if (!data) return serviceFailure("not_found", "Your profile could not be updated.");
  return serviceSuccess({ theme: data.theme_preference as "system" | "light" | "dark" });
}

export async function getSettingsData(suppliedContext?: AuthenticatedAppContext) {
  const context = suppliedContext ?? await getAuthenticatedAppContext();
  const { data, error } = await context.supabase.from("profiles").select("created_at").eq("id", context.user.id).single();
  if (error) throw new Error("Unable to load Settings.");
  return { email: context.user.email, createdAt: data.created_at, currency: context.profile.currency, timeZone: context.profile.timezone, weekStartsOn: context.profile.week_starts_on, calendarDefaultView: context.profile.calendar_default_view as "month" | "week" | "day" | "agenda", theme: context.profile.theme_preference as "system" | "light" | "dark" };
}
