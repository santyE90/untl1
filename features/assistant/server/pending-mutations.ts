import "server-only";

import { randomBytes } from "node:crypto";

import type { AssistantMutationName, AssistantMutationPreview } from "../mutations";
import type { AuthenticatedAppContext } from "@/features/shared/server-context";
import type { TaskMutationResult } from "@/features/tasks/mutations";
import { createTask, setTaskStatus, updateTask } from "@/features/tasks/mutations";
import type { ServiceResult } from "@/features/shared/service-result";

export type PendingTaskMutation =
  | { operation: "create_task"; input: unknown }
  | { operation: "update_task"; taskId: string; input: unknown; expectedUpdatedAt: string }
  | { operation: "set_task_status"; taskId: string; status: string; expectedUpdatedAt: string };
type PendingEntry = { userId: string; expiresAt: number; preview: AssistantMutationPreview; mutation: PendingTaskMutation };
const pending = new Map<string, PendingEntry>();
export const assistantConfirmationTtlMs = 10 * 60_000;

function sweep(now: number) { for (const [token, entry] of pending) if (entry.expiresAt <= now) pending.delete(token); }

export function registerPendingTaskMutation(userId: string, mutation: PendingTaskMutation, preview: AssistantMutationPreview, now = Date.now()) {
  sweep(now);
  while (pending.size >= 1_000) pending.delete(pending.keys().next().value!);
  const token = randomBytes(32).toString("base64url");
  const expiresAt = now + assistantConfirmationTtlMs;
  pending.set(token, { userId, mutation, preview, expiresAt });
  return { token, expiresAt: new Date(expiresAt).toISOString(), preview };
}

export function pendingTaskMutationOperation(token: string, userId: string, now = Date.now()) {
  sweep(now);
  const entry = pending.get(token);
  return entry?.userId === userId ? entry.mutation.operation : null;
}

export function cancelPendingTaskMutation(token: string, userId: string, now = Date.now()) {
  sweep(now);
  const entry = pending.get(token);
  if (!entry || entry.userId !== userId) return false;
  pending.delete(token);
  return true;
}

export async function consumePendingTaskMutation(token: string, context: AuthenticatedAppContext, now = Date.now()): Promise<ServiceResult<{ task: TaskMutationResult; operation: AssistantMutationName }>> {
  sweep(now);
  const entry = pending.get(token);
  if (!entry || entry.userId !== context.user.id) return { ok: false, error: { code: "not_found", message: "This confirmation is invalid, expired, or already used." } };
  pending.delete(token);
  let result: ServiceResult<TaskMutationResult>;
  if (entry.mutation.operation === "create_task") result = await createTask(entry.mutation.input, context);
  else if (entry.mutation.operation === "update_task") result = await updateTask(entry.mutation.taskId, entry.mutation.input, context, entry.mutation.expectedUpdatedAt);
  else result = await setTaskStatus(entry.mutation.taskId, entry.mutation.status, context, entry.mutation.expectedUpdatedAt);
  return result.ok ? { ok: true, data: { task: result.data, operation: entry.mutation.operation } } : result;
}

export function resetPendingTaskMutationsForTests() { pending.clear(); }
