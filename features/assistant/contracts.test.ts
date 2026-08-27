import { describe, expect, it } from "vitest";

import { assistantRequestSchema } from "./contracts";
import { assistantLimits } from "./limits";

describe("Assistant request boundary", () => {
  it("accepts a bounded conversation ending with a user message", () => {
    expect(assistantRequestSchema.safeParse({ messages: [{ role: "user", content: "What is due today?" }] }).success).toBe(true);
  });

  it("rejects ownership fields and invalid conversation shapes", () => {
    expect(assistantRequestSchema.safeParse({ userId: "someone-else", messages: [{ role: "user", content: "Hello" }] }).success).toBe(false);
    expect(assistantRequestSchema.safeParse({ messages: [{ role: "assistant", content: "Hello" }] }).success).toBe(false);
  });

  it("enforces centralized message-count, message-size, and total-context caps", () => {
    expect(assistantRequestSchema.safeParse({ messages: [{ role: "user", content: "x".repeat(assistantLimits.maxUserMessageChars + 1) }] }).success).toBe(false);
    expect(assistantRequestSchema.safeParse({ messages: Array.from({ length: assistantLimits.maxConversationMessages + 1 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", content: "x" })) }).success).toBe(false);
    const oversized = Array.from({ length: assistantLimits.maxConversationMessages }, (_, index) => ({ role: index === assistantLimits.maxConversationMessages - 1 ? "user" : "assistant", content: "x".repeat(Math.floor(assistantLimits.maxConversationChars / assistantLimits.maxConversationMessages) + 1) }));
    expect(assistantRequestSchema.safeParse({ messages: oversized }).success).toBe(false);
  });
});
