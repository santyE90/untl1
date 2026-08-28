import { describe, expect, it } from "vitest";

import type { AuthenticatedAppContext } from "@/features/shared/server-context";
import { assistantToolDefinitions, executeAssistantTool } from "./tools";
import { assistantInstructions } from "./prompt";

const context = { today: "2026-08-27", timeZone: "America/Toronto" } as AuthenticatedAppContext;

describe("Assistant tool surface", () => {
  it("exposes every approved read tool and no mutation tools", () => {
    const names = assistantToolDefinitions.map((tool) => tool.name);
    expect(names).toEqual(["get_today_overview", "get_upcoming_calendar", "get_finance_summary", "get_upcoming_bills", "get_cash_flow_projection", "get_courses", "get_upcoming_assessments", "get_assessments", "get_course_standing", "get_tasks", "get_tasks_due_today", "get_overdue_tasks", "get_goals", "get_goal_progress", "get_upcoming_goal_deadlines"]);
    expect(JSON.stringify(assistantToolDefinitions)).not.toMatch(/user_?id/i);
    expect(names.some((name) => /create|update|complete|archive|delete|transfer|budget/.test(name))).toBe(false);
    expect(assistantInstructions).toContain("update_goal_progress, update_assessment, set_assessment_score, clear_assessment_score, and set_assessment_status");
    expect(assistantInstructions).toContain("Refuse archive/delete");
  });

  it("rejects invalid and beyond-range inputs before accessing a service", async () => {
    await expect(executeAssistantTool("get_upcoming_calendar", JSON.stringify({ days: 91 }), context)).resolves.toMatchObject({ ok: false, error: { code: "validation" } });
    await expect(executeAssistantTool("get_upcoming_bills", JSON.stringify({ days: 0 }), context)).resolves.toMatchObject({ ok: false, error: { code: "validation" } });
    await expect(executeAssistantTool("get_tasks", JSON.stringify({ filter: "secret" }), context)).resolves.toMatchObject({ ok: false, error: { code: "validation" } });
    await expect(executeAssistantTool("get_cash_flow_projection", JSON.stringify({ horizon: "365" }), context)).resolves.toMatchObject({ ok: false, error: { code: "validation" } });
  });
});
