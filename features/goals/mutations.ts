import "server-only";

import type { Database } from "@/types/database";
import { assertCalendarDate } from "@/features/calendar/dates";
import type { AuthenticatedAppContext } from "@/features/shared/server-context";
import type { ServiceResult } from "@/features/shared/service-result";
import { serviceFailure, serviceSuccess } from "@/features/shared/service-result";

import { goalSchema, goalStatusSchema } from "./schemas";

type GoalInsert = Database["public"]["Tables"]["goals"]["Insert"];
type GoalValues = Pick<GoalInsert, "title" | "description" | "category" | "status" | "deadline" | "progress_mode" | "current_value" | "target_value" | "unit_label">;
export type GoalMutationResult = Pick<Database["public"]["Tables"]["goals"]["Row"], "id" | "title" | "description" | "category" | "status" | "deadline" | "progress_mode" | "current_value_decimal" | "target_value_decimal" | "unit_label" | "completed_at" | "archived_at" | "updated_at">;

const selection = "id,title,description,category,status,deadline,progress_mode,current_value_decimal,target_value_decimal,unit_label,completed_at,archived_at,updated_at" as const;

export function validateGoalMutation(input: unknown): ServiceResult<{ values: GoalValues }> {
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) return serviceFailure("validation", parsed.error.issues[0]?.message ?? "Check the Goal details.");
  const data = parsed.data;
  let deadline: string | null = null;
  try { deadline = data.deadline ? assertCalendarDate(data.deadline) : null; }
  catch (error) { return serviceFailure("validation", error instanceof Error ? error.message : "Deadline is invalid."); }
  return serviceSuccess({ values: {
    title: data.title,
    description: data.description,
    category: data.category,
    status: data.status,
    deadline,
    progress_mode: data.progressMode,
    current_value: (data.progressMode === "none" ? null : data.currentValue) as unknown as number | null,
    target_value: (data.progressMode === "numeric" ? data.targetValue : null) as unknown as number | null,
    unit_label: data.progressMode === "numeric" ? data.unitLabel || null : null,
  } });
}

export async function createGoal(input: unknown, context: AuthenticatedAppContext): Promise<ServiceResult<GoalMutationResult>> {
  const parsed = validateGoalMutation(input);
  if (!parsed.ok) return parsed;
  const result = await context.supabase.from("goals").insert({ user_id: context.user.id, ...parsed.data.values }).select(selection).single();
  return result.error ? serviceFailure("unexpected", "The Goal could not be created.") : serviceSuccess(result.data);
}

export async function updateGoal(id: string, input: unknown, context: AuthenticatedAppContext, expectedUpdatedAt?: string): Promise<ServiceResult<GoalMutationResult>> {
  const existing = await context.supabase.from("goals").select("id,archived_at,updated_at").eq("id", id).eq("user_id", context.user.id).maybeSingle();
  if (existing.error) return serviceFailure("unexpected", "The Goal could not be checked.");
  if (!existing.data) return serviceFailure("not_found", "The Goal is unavailable.");
  if (expectedUpdatedAt && existing.data.archived_at) return serviceFailure("not_found", "The Goal is unavailable.");
  if (expectedUpdatedAt && existing.data.updated_at !== expectedUpdatedAt) return serviceFailure("conflict", "The Goal changed after this proposal. Please review it again.");
  const parsed = validateGoalMutation(input);
  if (!parsed.ok) return parsed;
  let query = context.supabase.from("goals").update(parsed.data.values).eq("id", id).eq("user_id", context.user.id);
  if (expectedUpdatedAt) query = query.is("archived_at", null).eq("updated_at", expectedUpdatedAt);
  const result = await query.select(selection).maybeSingle();
  if (result.error) return serviceFailure("unexpected", "The Goal could not be updated.");
  if (!result.data) return serviceFailure(expectedUpdatedAt ? "conflict" : "not_found", expectedUpdatedAt ? "The Goal changed after this proposal. Please review it again." : "The Goal is unavailable.");
  return serviceSuccess(result.data);
}

export async function setGoalLifecycleStatus(id: string, status: unknown, context: AuthenticatedAppContext, expectedUpdatedAt?: string): Promise<ServiceResult<GoalMutationResult>> {
  const parsedStatus = goalStatusSchema.safeParse(status);
  if (!parsedStatus.success) return serviceFailure("validation", "Choose Active or Completed.");
  const existing = await context.supabase.from("goals").select("id,status,archived_at,updated_at").eq("id", id).eq("user_id", context.user.id).maybeSingle();
  if (existing.error) return serviceFailure("unexpected", "The Goal could not be checked.");
  if (!existing.data) return serviceFailure("not_found", "The Goal is unavailable.");
  if (expectedUpdatedAt && existing.data.archived_at) return serviceFailure("not_found", "The Goal is unavailable.");
  if (expectedUpdatedAt && existing.data.updated_at !== expectedUpdatedAt) return serviceFailure("conflict", "The Goal changed after this proposal. Please review it again.");
  if (existing.data.status === parsedStatus.data) return serviceFailure("conflict", `The Goal is already ${parsedStatus.data}.`);
  let query = context.supabase.from("goals").update({ status: parsedStatus.data }).eq("id", id).eq("user_id", context.user.id);
  if (expectedUpdatedAt) query = query.is("archived_at", null).eq("updated_at", expectedUpdatedAt);
  const result = await query.select(selection).maybeSingle();
  if (result.error) return serviceFailure("unexpected", "The Goal status could not be updated.");
  if (!result.data) return serviceFailure(expectedUpdatedAt ? "conflict" : "not_found", expectedUpdatedAt ? "The Goal changed after this proposal. Please review it again." : "The Goal is unavailable.");
  return serviceSuccess(result.data);
}
