import { describe, expect, it } from "vitest";
import { assistantMutationToolDefinitions } from "./mutation-tools";

describe("Assistant mutation proposal registry", () => {
  it("contains only the confirmation-gated Task, native Calendar, Goal, and assessment capabilities", () => {
    expect(assistantMutationToolDefinitions.map((tool) => tool.name)).toEqual(["create_task", "update_task", "set_task_status", "create_calendar_event", "update_calendar_event", "create_goal", "update_goal", "set_goal_status", "update_goal_progress", "update_assessment", "set_assessment_score", "clear_assessment_score", "set_assessment_status"]);
    const serialized = JSON.stringify(assistantMutationToolDefinitions);
    expect(serialized).not.toMatch(/user_?id|delete|recurrence|reminder|transaction|milestone/i);
    const updateAssessment = assistantMutationToolDefinitions.find((tool) => tool.name === "update_assessment");
    expect(JSON.stringify(updateAssessment?.parameters)).not.toMatch(/weight|courseId|status|score|archive/i);
    expect(assistantMutationToolDefinitions.every((tool) => String(tool.description).includes("PROPOSAL ONLY"))).toBe(true);
  });
});
