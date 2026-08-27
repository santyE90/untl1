import { describe, expect, it } from "vitest";

import { boundAssistantConversation } from "./conversation";
import { assistantLimits } from "./limits";

describe("bounded ephemeral Assistant context", () => {
  it("keeps the newest messages without duplicating them", () => {
    const input = Array.from({ length: 14 }, (_, index) => ({ role: index === 13 ? "user" as const : "assistant" as const, content: `message-${index}` }));
    const result = boundAssistantConversation(input);
    expect(result.trimmed).toBe(true);
    expect(result.messages).toHaveLength(assistantLimits.maxConversationMessages);
    expect(result.messages[0].content).toBe("message-2");
    expect(new Set(result.messages.map((message) => message.content)).size).toBe(result.messages.length);
  });

  it("also enforces the aggregate character ceiling", () => {
    const input = [{ role: "assistant" as const, content: "a".repeat(assistantLimits.maxConversationChars) }, { role: "user" as const, content: "latest" }];
    const result = boundAssistantConversation(input);
    expect(result.messages).toEqual([{ role: "user", content: "latest" }]);
    expect(result.trimmed).toBe(true);
  });
});
