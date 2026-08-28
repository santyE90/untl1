import { describe, expect, it } from "vitest";
import { assistantMutationToolDefinitions } from "./mutation-tools";

describe("Assistant mutation proposal registry", () => {
  it("contains only the three confirmation-gated Task capabilities", () => {
    expect(assistantMutationToolDefinitions.map((tool) => tool.name)).toEqual(["create_task", "update_task", "set_task_status"]);
    const serialized = JSON.stringify(assistantMutationToolDefinitions);
    expect(serialized).not.toMatch(/user_?id|archive|delete|calendar_event|transaction|goal_mutation/i);
    expect(assistantMutationToolDefinitions.every((tool) => String(tool.description).includes("PROPOSAL ONLY"))).toBe(true);
  });
});
