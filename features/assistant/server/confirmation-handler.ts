import "server-only";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { assistantConfirmationRequestSchema } from "../mutations";
import { getOptionalAuthenticatedAppContext, type AuthenticatedAppContext } from "@/features/shared/server-context";
import { cancelPendingTaskMutation, consumePendingTaskMutation, pendingTaskMutationOperation } from "./pending-mutations";
import { observeAssistantMutation, userCorrelation } from "./observability";
import { trustedReference } from "./references";

type Dependencies = { getContext?: () => Promise<AuthenticatedAppContext | null>; consume?: typeof consumePendingTaskMutation; cancel?: typeof cancelPendingTaskMutation; observe?: typeof observeAssistantMutation };
const response = (body: unknown, status: number, requestId: string) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Assistant-Request-ID": requestId } });

type BoundaryResult = { ok: false; response: Response } | { ok: true; requestId: string; context: AuthenticatedAppContext; token: string; observe: typeof observeAssistantMutation };
async function boundary(request: Request, dependencies: Dependencies): Promise<BoundaryResult> {
  const requestId = randomUUID();
  if (request.headers.get("sec-fetch-site") === "cross-site") return { ok: false, response: response({ ok: false, error: { code: "forbidden", message: "Cross-site Assistant requests are not allowed." } }, 403, requestId) };
  const context = await (dependencies.getContext ?? getOptionalAuthenticatedAppContext)();
  if (!context) return { ok: false, response: response({ ok: false, error: { code: "unauthenticated", message: "Sign in to confirm this Task change." } }, 401, requestId) };
  let body: unknown;
  try { body = await request.json(); } catch { return { ok: false, response: response({ ok: false, error: { code: "validation", message: "The confirmation request was invalid." } }, 400, requestId) }; }
  const parsed = assistantConfirmationRequestSchema.safeParse(body);
  if (!parsed.success) return { ok: false, response: response({ ok: false, error: { code: "validation", message: "The confirmation token was invalid." } }, 400, requestId) };
  return { ok: true, requestId, context, token: parsed.data.token, observe: dependencies.observe ?? observeAssistantMutation };
}

export async function handleAssistantConfirmation(request: Request, dependencies: Dependencies = {}): Promise<Response> {
  const started = Date.now();
  const checked = await boundary(request, dependencies);
  if (!checked.ok) return checked.response;
  const proposedOperation = pendingTaskMutationOperation(checked.token, checked.context.user.id) ?? "task_mutation";
  checked.observe({ requestId: checked.requestId, userCorrelation: userCorrelation(checked.context.user.id), operation: proposedOperation, state: "confirmed", durationMs: Date.now() - started });
  const result = await (dependencies.consume ?? consumePendingTaskMutation)(checked.token, checked.context);
  const operation = result.ok ? result.data.operation : "task_mutation";
  checked.observe({ requestId: checked.requestId, userCorrelation: userCorrelation(checked.context.user.id), operation, state: result.ok ? "succeeded" : "failed", durationMs: Date.now() - started, ...(!result.ok ? { errorCode: result.error.code } : {}) });
  if (!result.ok) return response({ ok: false, error: result.error }, result.error.code === "conflict" ? 409 : result.error.code === "not_found" ? 404 : result.error.code === "validation" ? 400 : 500, checked.requestId);
  revalidatePath("/tasks", "layout"); revalidatePath("/goals", "layout"); revalidatePath("/calendar", "layout"); revalidatePath("/dashboard");
  const task = result.data.task;
  const reference = trustedReference({ type: "task", id: task.id, label: task.title, href: `/tasks?task=${task.id}#task-${task.id}` });
  return response({ ok: true, operation: result.data.operation, task, references: reference ? [reference] : [] }, 200, checked.requestId);
}

export async function handleAssistantCancellation(request: Request, dependencies: Dependencies = {}): Promise<Response> {
  const checked = await boundary(request, dependencies);
  if (!checked.ok) return checked.response;
  const cancelled = (dependencies.cancel ?? cancelPendingTaskMutation)(checked.token, checked.context.user.id);
  checked.observe({ requestId: checked.requestId, userCorrelation: userCorrelation(checked.context.user.id), operation: "task_mutation", state: "cancelled", durationMs: 0, ...(!cancelled ? { errorCode: "not_found" } : {}) });
  return cancelled ? response({ ok: true }, 200, checked.requestId) : response({ ok: false, error: { code: "not_found", message: "This confirmation is invalid, expired, or already used." } }, 404, checked.requestId);
}
