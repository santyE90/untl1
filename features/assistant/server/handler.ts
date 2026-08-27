import "server-only";

import { randomUUID } from "node:crypto";

import { assistantRequestSchema, type AssistantApiResponse, type AssistantStreamEvent } from "../contracts";
import { getOptionalAuthenticatedAppContext, type AuthenticatedAppContext } from "@/features/shared/server-context";
import { observeAssistantTurn, userCorrelation, type AssistantObservation } from "./observability";
import { AssistantRuntimeError, streamAssistant } from "./runner";
import { acquireAssistantRequest, type ThrottleDecision } from "./throttle";

type Dependencies = {
  getContext?: () => Promise<AuthenticatedAppContext | null>;
  stream?: typeof streamAssistant;
  throttle?: (userId: string) => ThrottleDecision;
  observe?: (observation: Omit<AssistantObservation, "model">) => void;
};

function json(body: AssistantApiResponse, status: number, requestId: string, headers?: HeadersInit) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Assistant-Request-ID": requestId, ...headers } });
}

function runtimeOutcome(error: unknown): AssistantObservation["outcome"] {
  if (!(error instanceof AssistantRuntimeError)) return "unexpected";
  if (error.code === "aborted") return "aborted";
  if (error.code === "configuration") return "configuration";
  if (error.code === "tool_limit") return "tool_limit";
  return "provider";
}

export async function handleAssistantRequest(request: Request, dependencies: Dependencies = {}) {
  const requestId = randomUUID();
  if (request.headers.get("sec-fetch-site") === "cross-site") return json({ ok: false, error: { code: "forbidden", message: "Cross-site Assistant requests are not allowed." } }, 403, requestId);
  const context = await (dependencies.getContext ?? getOptionalAuthenticatedAppContext)();
  if (!context) return json({ ok: false, error: { code: "unauthenticated", message: "Sign in to use the LifeStack Assistant." } }, 401, requestId);
  let body: unknown;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: { code: "validation", message: "The Assistant request was not valid JSON." } }, 400, requestId); }
  const parsed = assistantRequestSchema.safeParse(body);
  if (!parsed.success) return json({ ok: false, error: { code: "validation", message: "Send a valid bounded conversation with a final user message." } }, 400, requestId);

  const throttle = (dependencies.throttle ?? acquireAssistantRequest)(context.user.id);
  const observe = dependencies.observe ?? observeAssistantTurn;
  const correlation = userCorrelation(context.user.id);
  if (!throttle.allowed) {
    observe({ requestId, userCorrelation: correlation, toolNames: [], toolCalls: 0, durationMs: 0, outcome: "rate_limited" });
    return json({ ok: false, error: { code: "rate_limited", message: "Please wait a moment before sending another Assistant request. Your LifeStack data was not changed." } }, 429, requestId, { "Retry-After": String(throttle.retryAfterSeconds) });
  }

  const started = Date.now();
  const toolNames: string[] = [];
  const encoder = new TextEncoder();
  const abortController = new AbortController();
  const abort = () => abortController.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  const encode = (event: AssistantStreamEvent) => encoder.encode(`${JSON.stringify(event)}\n`);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let outcome: AssistantObservation["outcome"] = "success";
      try {
        controller.enqueue(encode({ type: "meta", requestId }));
        const run = dependencies.stream ?? streamAssistant;
        for await (const event of run({ messages: parsed.data.messages, context, signal: abortController.signal, onTool: (name) => toolNames.push(name) })) controller.enqueue(encode(event));
      } catch (error) {
        outcome = abortController.signal.aborted ? "aborted" : runtimeOutcome(error);
        if (!abortController.signal.aborted) {
          const runtime = error instanceof AssistantRuntimeError ? error : new AssistantRuntimeError("provider", "The Assistant could not complete the request. Your LifeStack data was not changed.");
          try { controller.enqueue(encode({ type: "error", code: runtime.code, message: runtime.message, requestId })); } catch { /* browser disconnected */ }
        }
      } finally {
        throttle.release();
        request.signal.removeEventListener("abort", abort);
        observe({ requestId, userCorrelation: correlation, toolNames: [...new Set(toolNames)], toolCalls: toolNames.length, durationMs: Date.now() - started, outcome });
        try { controller.close(); } catch { /* browser disconnected */ }
      }
    },
    cancel() { abortController.abort(); },
  });

  return new Response(stream, { status: 200, headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Assistant-Request-ID": requestId } });
}
