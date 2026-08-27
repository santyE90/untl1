import { describe, expect, it, vi } from "vitest";

import { AssistantClientError, consumeAssistantStream } from "./stream-client";

function chunkedResponse(chunks: string[], status = 200) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(encoder.encode(chunk)); controller.close(); } }), {
    status,
    headers: { "Content-Type": "application/x-ndjson", "X-Assistant-Request-ID": "02c682b2-c324-4a49-913d-085d028768cd" },
  });
}

describe("Assistant stream client", () => {
  it("parses events split across arbitrary network chunks exactly once", async () => {
    const onEvent = vi.fn();
    await consumeAssistantStream(chunkedResponse(['{"type":"meta","requestId":"02c682b2-c324-4a49-913d-085d028768cd"}\n{"type":"del', 'ta","text":"Hel"}\n{"type":"delta","text":"lo"}\n', '{"type":"done","references":[]}\n']), onEvent);
    expect(onEvent.mock.calls.map(([event]) => event)).toEqual([
      { type: "meta", requestId: "02c682b2-c324-4a49-913d-085d028768cd" },
      { type: "delta", text: "Hel" },
      { type: "delta", text: "lo" },
      { type: "done", references: [] },
    ]);
  });

  it("surfaces safe structured stream errors with their request reference", async () => {
    const response = chunkedResponse(['{"type":"error","code":"rate_limit","message":"The AI service is temporarily unavailable.","requestId":"02c682b2-c324-4a49-913d-085d028768cd"}\n']);
    await expect(consumeAssistantStream(response, vi.fn())).rejects.toMatchObject({ code: "rate_limit", requestId: "02c682b2-c324-4a49-913d-085d028768cd" } satisfies Partial<AssistantClientError>);
  });

  it("rejects malformed and incomplete streams", async () => {
    await expect(consumeAssistantStream(chunkedResponse(['not-json\n']), vi.fn())).rejects.toMatchObject({ code: "malformed" });
    await expect(consumeAssistantStream(chunkedResponse(['{"type":"delta","text":"partial"}\n']), vi.fn())).rejects.toMatchObject({ code: "network" });
  });

  it("preserves a safe non-stream authentication failure", async () => {
    const response = new Response(JSON.stringify({ ok: false, error: { code: "unauthenticated", message: "Sign in to use the LifeStack Assistant." } }), { status: 401, headers: { "Content-Type": "application/json" } });
    await expect(consumeAssistantStream(response, vi.fn())).rejects.toMatchObject({ code: "unauthenticated", message: "Sign in to use the LifeStack Assistant." });
  });
});
