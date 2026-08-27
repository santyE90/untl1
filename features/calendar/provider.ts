import type { AuthenticatedAppContext } from "@/features/shared/server-context";
import type { DateRange } from "@/features/shared/date-ranges";

import type { CalendarItem } from "./types";

export type CalendarProviderId = "native" | "finance" | "school" | "tasks" | "goals";
export type CalendarProviderContext = Pick<AuthenticatedAppContext, "supabase" | "user" | "timeZone" | "today">;

export type CalendarSourceProvider = {
  id: CalendarProviderId;
  getItems: (range: DateRange, context: CalendarProviderContext) => Promise<CalendarItem[]>;
};
