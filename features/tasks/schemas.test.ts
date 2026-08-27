import { describe, expect, it } from "vitest";

import { taskSchema, taskStatusSchema } from "./schemas";

const base = { title: "Finish reading", description: "", status: "todo", priority: "medium", dueKind: "none", dueDate: "", dueLocal: "", estimatedEffortMinutes: "", assessmentId: "" };

describe("Task validation", () => {
  it("accepts no-date, date-only, and timed tasks", () => {
    expect(taskSchema.safeParse(base).success).toBe(true);
    expect(taskSchema.safeParse({ ...base, dueKind: "date", dueDate: "2026-09-14" }).success).toBe(true);
    expect(taskSchema.safeParse({ ...base, dueKind: "timed", dueLocal: "2026-09-14T23:59" }).success).toBe(true);
  });

  it("rejects malformed dates, effort, assessment IDs, and workflow states", () => {
    expect(taskSchema.safeParse({ ...base, dueKind: "date", dueDate: "tomorrow" }).success).toBe(false);
    expect(taskSchema.safeParse({ ...base, estimatedEffortMinutes: "0" }).success).toBe(false);
    expect(taskSchema.safeParse({ ...base, assessmentId: "another-user" }).success).toBe(false);
    expect(taskStatusSchema.safeParse("blocked").success).toBe(false);
  });
});
