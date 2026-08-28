import "server-only";

import { assertCalendarDate, zonedLocalDateTimeToUtc } from "../calendar/dates";
import { serviceFailure, serviceSuccess, type ServiceResult } from "../shared/service-result";
import type { AuthenticatedAppContext } from "../shared/server-context";
import { taskSchema, taskStatusSchema } from "./schemas";
import type { TaskRecord } from "./types";
import type { Database } from "@/types/database";

export type TaskInput = Parameters<typeof taskSchema.parse>[0];
export type TaskMutationResult = Pick<TaskRecord, "id" | "title" | "status" | "priority" | "due_date" | "due_at" | "estimated_effort_minutes" | "assessment_id" | "goal_id" | "updated_at">;
type TaskWritableRow = Pick<Database["public"]["Tables"]["tasks"]["Insert"], "title" | "description" | "status" | "priority" | "due_date" | "due_at" | "estimated_effort_minutes" | "assessment_id" | "goal_id">;

async function taskRow(input: unknown, context: AuthenticatedAppContext): Promise<ServiceResult<TaskWritableRow>> {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return serviceFailure("validation", parsed.error.issues[0].message);
  const data = parsed.data;
  if (data.assessmentId) {
    const result = await context.supabase.from("assessments").select("id").eq("id", data.assessmentId).eq("user_id", context.user.id).is("archived_at", null).maybeSingle();
    if (result.error) return serviceFailure("unexpected", "The related assessment could not be checked.");
    if (!result.data) return serviceFailure("not_found", "The related assessment is unavailable.");
  }
  if (data.goalId) {
    const result = await context.supabase.from("goals").select("id").eq("id", data.goalId).eq("user_id", context.user.id).is("archived_at", null).maybeSingle();
    if (result.error) return serviceFailure("unexpected", "The related goal could not be checked.");
    if (!result.data) return serviceFailure("not_found", "The related goal is unavailable.");
  }
  let dueDate: string | null = null;
  let dueAt: string | null = null;
  try {
    if (data.dueKind === "date") dueDate = assertCalendarDate(data.dueDate);
    if (data.dueKind === "timed") dueAt = zonedLocalDateTimeToUtc(data.dueLocal, context.timeZone);
  } catch (error) { return serviceFailure("validation", error instanceof Error ? error.message : "Due date is invalid."); }
  return serviceSuccess({ title: data.title, description: data.description, status: data.status, priority: data.priority, due_date: dueDate, due_at: dueAt, estimated_effort_minutes: data.estimatedEffortMinutes || null, assessment_id: data.assessmentId || null, goal_id: data.goalId || null });
}

export async function validateTaskMutation(input: unknown, context: AuthenticatedAppContext) { return taskRow(input, context); }

export async function createTask(input: unknown, context: AuthenticatedAppContext): Promise<ServiceResult<TaskMutationResult>> {
  const row = await taskRow(input, context);
  if (!row.ok) return row;
  const result = await context.supabase.from("tasks").insert({ user_id: context.user.id, ...row.data }).select("id,title,status,priority,due_date,due_at,estimated_effort_minutes,assessment_id,goal_id,updated_at").single();
  if (result.error) return serviceFailure("unexpected", "The task could not be created.");
  return serviceSuccess(result.data);
}

export async function updateTask(id: string, input: unknown, context: AuthenticatedAppContext, expectedUpdatedAt?: string): Promise<ServiceResult<TaskMutationResult>> {
  const row = await taskRow(input, context);
  if (!row.ok) return row;
  let query = context.supabase.from("tasks").update(row.data).eq("id", id).eq("user_id", context.user.id).is("archived_at", null);
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
  const result = await query.select("id,title,status,priority,due_date,due_at,estimated_effort_minutes,assessment_id,goal_id,updated_at").maybeSingle();
  if (result.error) return serviceFailure("unexpected", "The task could not be updated.");
  if (!result.data) return serviceFailure(expectedUpdatedAt ? "conflict" : "not_found", expectedUpdatedAt ? "The task changed after this proposal. Please review it again." : "The task is unavailable.");
  return serviceSuccess(result.data);
}

export async function setTaskStatus(id: string, status: unknown, context: AuthenticatedAppContext, expectedUpdatedAt?: string): Promise<ServiceResult<TaskMutationResult>> {
  const parsed = taskStatusSchema.safeParse(status);
  if (!parsed.success) return serviceFailure("validation", "Task status is invalid.");
  let query = context.supabase.from("tasks").update({ status: parsed.data }).eq("id", id).eq("user_id", context.user.id).is("archived_at", null);
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
  const result = await query.select("id,title,status,priority,due_date,due_at,estimated_effort_minutes,assessment_id,goal_id,updated_at").maybeSingle();
  if (result.error) return serviceFailure("unexpected", "The task status could not be changed.");
  if (!result.data) return serviceFailure(expectedUpdatedAt ? "conflict" : "not_found", expectedUpdatedAt ? "The task changed after this proposal. Please review it again." : "The task is unavailable.");
  return serviceSuccess(result.data);
}
