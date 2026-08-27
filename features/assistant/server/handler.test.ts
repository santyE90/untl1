import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AssistantStreamEvent } from "../contracts";
import type { AuthenticatedAppContext } from "@/features/shared/server-context";
import { resetAssistantThrottleForTests } from "./throttle";
import { handleAssistantRequest } from "./handler";

const context = { user: { id: "user-a" } } as AuthenticatedAppContext;
const request = () => new Request("http://localhost/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "What is due?" }] }) });
async function* stream(events: AssistantStreamEvent[]) { yield* events; }

describe("Assistant HTTP boundary", () => {
  beforeEach(() => resetAssistantThrottleForTests());

  it("rejects unauthenticated requests before model execution", async () => {
    const run = vi.fn();
    const response = await handleAssistantRequest(request(), { getContext: async () => null, stream: run });
    expect(response.status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it("streams events with a request reference and trusted authenticated context", async () => {
    const run = vi.fn(() => stream([{ type: "delta", text: "No overdue tasks." }, { type: "done", references: [] }]));
    const observe = vi.fn();
    const response = await handleAssistantRequest(request(), { getContext: async () => context, stream: run, observe });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");
    const lines = (await response.text()).trim().split("\n").map((line) => JSON.parse(line));
    expect(lines[0]).toMatchObject({ type: "meta", requestId: expect.any(String) });
    expect(lines.slice(1)).toEqual([{ type: "delta", text: "No overdue tasks." }, { type: "done", references: [] }]);
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ context, messages: [{ role: "user", content: "What is due?" }], signal: expect.any(AbortSignal) }));
    expect(observe).toHaveBeenCalledWith(expect.objectContaining({ outcome: "success", toolCalls: 0 }));
  });

  it("returns a bounded 429 and Retry-After when throttled", async () => {
    const response = await handleAssistantRequest(request(), { getContext: async () => context, throttle: () => ({ allowed: false, retryAfterSeconds: 3 }), observe: vi.fn() });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("3");
    expect(await response.json()).toMatchObject({ ok: false, error: { code: "rate_limited" } });
  });

  it("converts runtime failures into safe stream errors and releases the slot", async () => {
    async function* failed(): AsyncGenerator<AssistantStreamEvent> { throw new Error("private provider detail"); }
    const release = vi.fn();
    const response = await handleAssistantRequest(request(), { getContext: async () => context, stream: failed, throttle: () => ({ allowed: true, release }), observe: vi.fn() });
    const body = await response.text();
    expect(body).toContain('"code":"provider"');
    expect(body).not.toContain("private provider detail");
    expect(release).toHaveBeenCalledOnce();
  });

  it("aborts server work and releases state when the browser cancels the stream", async () => {
    const release = vi.fn();
    const observe = vi.fn();
    async function* waitsForAbort({ signal }: { signal?: AbortSignal }): AsyncGenerator<AssistantStreamEvent> {
      yield { type: "delta", text: "Partial" };
      await new Promise<void>((resolve) => signal?.addEventListener("abort", () => resolve(), { once: true }));
      throw new Error("cancelled downstream");
    }
    const response = await handleAssistantRequest(request(), { getContext: async () => context, stream: waitsForAbort as never, throttle: () => ({ allowed: true, release }), observe });
    const reader = response.body!.getReader();
    await reader.read();
    await reader.cancel();
    await vi.waitFor(() => expect(release).toHaveBeenCalledOnce());
    expect(observe).toHaveBeenCalledWith(expect.objectContaining({ outcome: "aborted" }));
  });

  it("rejects cross-site and malformed requests safely", async () => {
    const crossSite = new Request("http://localhost/api/assistant", { method: "POST", headers: { "sec-fetch-site": "cross-site" } });
    expect((await handleAssistantRequest(crossSite)).status).toBe(403);
    const malformed = new Request("http://localhost/api/assistant", { method: "POST", body: "{" });
    expect((await handleAssistantRequest(malformed, { getContext: async () => context })).status).toBe(400);
  });
});
