import { assistantStreamEventSchema, type AssistantApiResponse, type AssistantStreamEvent } from "./contracts";

export class AssistantClientError extends Error {
  constructor(message: string, public readonly code = "network", public readonly requestId?: string) { super(message); }
}

export async function consumeAssistantStream(response: Response, onEvent: (event: AssistantStreamEvent) => void) {
  const requestId = response.headers.get("X-Assistant-Request-ID") ?? undefined;
  if (!response.ok) {
    let result: AssistantApiResponse | null = null;
    try { result = await response.json() as AssistantApiResponse; } catch { /* safe fallback below */ }
    throw new AssistantClientError(result && !result.ok ? result.error.message : "The Assistant request failed. Your LifeStack data was not changed.", result && !result.ok ? result.error.code : "server", requestId);
  }
  if (!response.body) throw new AssistantClientError("The Assistant response stream was unavailable. Your LifeStack data was not changed.", "network", requestId);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      let parsed: unknown;
      try { parsed = JSON.parse(line); } catch { throw new AssistantClientError("The Assistant returned an invalid stream.", "malformed", requestId); }
      const event = assistantStreamEventSchema.safeParse(parsed);
      if (!event.success) throw new AssistantClientError("The Assistant returned an invalid stream event.", "malformed", requestId);
      if (event.data.type === "error") throw new AssistantClientError(event.data.message, event.data.code, event.data.requestId);
      if (event.data.type === "done") completed = true;
      onEvent(event.data);
    }
    if (done) break;
  }
  if (buffer.trim()) throw new AssistantClientError("The Assistant stream ended unexpectedly.", "malformed", requestId);
  if (!completed) throw new AssistantClientError("The Assistant stream ended before completion.", "network", requestId);
}
