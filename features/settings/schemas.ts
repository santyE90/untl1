import { z } from "zod";
import { isValidIanaTimeZone } from "@/features/shared/timezones";

export const generalPreferencesSchema = z.object({
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Enter a three-letter currency code."),
  timeZone: z.string().trim().min(1, "Choose a timezone.").max(100).refine(isValidIanaTimeZone, "Choose a valid IANA timezone."),
  weekStartsOn: z.coerce.number().int().min(0).max(6),
});

export const calendarPreferenceSchema = z.object({ defaultView: z.enum(["month", "week", "day", "agenda"]) });
export const themePreferenceSchema = z.object({ theme: z.enum(["system", "light", "dark"]) });
