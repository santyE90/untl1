import { describe, expect, it, vi } from "vitest";

import { observeAssistantMutation, observeAssistantTurn, userCorrelation } from "./observability";

describe("Assistant privacy-safe observability", () => {
  it("uses a stable non-reversible-looking correlation instead of the user ID", () => {
    expect(userCorrelation("private-user-id")).toBe(userCorrelation("private-user-id"));
    expect(userCorrelation("private-user-id")).not.toContain("private-user-id");
    expect(userCorrelation("private-user-id")).toHaveLength(12);
  });

  it("logs only the bounded execution summary supplied by the boundary", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    observeAssistantTurn({ requestId: "request", userCorrelation: "abcdef123456", toolNames: ["get_tasks_due_today"], toolCalls: 1, durationMs: 25, outcome: "success" });
    const serialized = info.mock.calls.flat().join(" ");
    expect(serialized).toContain("get_tasks_due_today");
    expect(serialized).not.toContain("private-user-id");
    expect(serialized).not.toMatch(/message|toolResult|apiKey|token/i);
    info.mockRestore();
  });

  it("records mutation lifecycle metadata without Task content", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    observeAssistantMutation({ requestId: "request", userCorrelation: "abcdef123456", operation: "create_task", state: "succeeded", durationMs: 20 });
    const serialized = info.mock.calls.flat().join(" ");
    expect(serialized).toContain("create_task");
    expect(serialized).toContain("succeeded");
    expect(serialized).not.toMatch(/title|description|arguments|message|Buy groceries/i);
    info.mockRestore();
  });
});
