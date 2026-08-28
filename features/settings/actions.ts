"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { updateCalendarPreference, updateProfilePreferences } from "./service";

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");
function destination(kind: "success" | "error", section: string, message: string): never { redirect(`/settings?${kind}=${encodeURIComponent(message)}&section=${section}#${section}`); }

export async function saveGeneralPreferences(formData: FormData) {
  const result = await updateProfilePreferences({ currency: text(formData, "currency"), timeZone: text(formData, "timeZone"), weekStartsOn: text(formData, "weekStartsOn") });
  if (!result.ok) destination("error", "general", result.error.message);
  for (const path of ["/settings", "/calendar", "/dashboard", "/analytics", "/finance", "/tasks", "/school", "/assistant"]) revalidatePath(path);
  destination("success", "general", "General preferences saved.");
}

export async function saveCalendarPreference(formData: FormData) {
  const result = await updateCalendarPreference({ defaultView: text(formData, "defaultView") });
  if (!result.ok) destination("error", "calendar", result.error.message);
  revalidatePath("/settings"); revalidatePath("/calendar", "layout");
  destination("success", "calendar", "Calendar preference saved.");
}
