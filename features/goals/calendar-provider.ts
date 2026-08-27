import "server-only";

import { requireAuthenticatedUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

import { goalToCalendarItem } from "./projection";
import type { GoalRecord } from "./types";

const goalSelect = "id,title,description,category,status,deadline,progress_mode,current_value_decimal,target_value_decimal,unit_label,completed_at,archived_at,created_at,updated_at" as const;

export async function getGoalCalendarItems(range: { start: string; end: string }) {
  await requireAuthenticatedUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("goals").select(goalSelect).eq("status", "active").is("archived_at", null).gte("deadline", range.start).lte("deadline", range.end);
  if (error) throw new Error(`Unable to load Goal Calendar items: ${error.message}`);
  return ((data ?? []) as GoalRecord[]).flatMap((goal) => {
    const item = goalToCalendarItem(goal);
    return item ? [item] : [];
  });
}
