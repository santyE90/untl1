import "server-only";

import { redirect } from "next/navigation";

import { getAuthenticatedUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

import { currentDateInTimeZone } from "./date-ranges";

export type AuthenticatedAppContext = Awaited<ReturnType<typeof getAuthenticatedAppContext>>;

async function loadContext() {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) return null;
  const { data: profile, error } = await supabase.from("profiles").select("currency,timezone,week_starts_on,calendar_default_view,theme_preference").eq("id", user.id).single();
  if (error) throw new Error(`Unable to load profile context: ${error.message}`);
  return { user, supabase, profile, timeZone: profile.timezone, today: currentDateInTimeZone(profile.timezone) };
}

export async function getOptionalAuthenticatedAppContext() {
  return loadContext();
}

export async function getAuthenticatedAppContext() {
  const context = await loadContext();
  if (context) return context;
  redirect("/login");
}
