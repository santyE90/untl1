import { describe, expect, it } from "vitest";

import { filterTasks, formatEffort, sortTasks, summarizeTasks, taskBucket, taskDueLocalDate } from "./task-service";
import type { TaskRecord } from "./types";

const task = (overrides: Partial<TaskRecord> = {}): TaskRecord => ({ id: crypto.randomUUID(), title: "Task", description: null, status: "todo", priority: "medium", due_date: null, due_at: null, estimated_effort_minutes: null, assessment_id: null, goal_id: null, completed_at: null, archived_at: null, created_at: "2026-09-01T12:00:00Z", updated_at: "2026-09-01T12:00:00Z", ...overrides });

describe("Task date classification", () => {
  it("keeps date-only tasks on their literal local date", () => {
    const row = task({ due_date: "2026-09-14" });
    expect(taskDueLocalDate(row, "Asia/Tokyo")).toBe("2026-09-14");
    expect(taskBucket(row, "2026-09-14", "Asia/Tokyo")).toBe("today");
  });

  it("classifies timed tasks using the profile timezone", () => {
    const row = task({ due_at: "2026-09-15T02:00:00.000Z" });
    expect(taskDueLocalDate(row, "America/Toronto")).toBe("2026-09-14");
    expect(taskBucket(row, "2026-09-15", "America/Toronto")).toBe("overdue");
  });

  it("keeps completed tasks out of active due buckets", () => {
    expect(taskBucket(task({ status: "completed", due_date: "2026-09-01", completed_at: "2026-09-02T00:00:00Z" }), "2026-09-14", "America/Toronto")).toBe("completed");
  });
});

describe("Task filtering and deterministic sorting", () => {
  const rows = [
    task({ id: "future", due_date: "2026-09-20", priority: "urgent" }),
    task({ id: "today-low", due_date: "2026-09-14", priority: "low" }),
    task({ id: "overdue", due_date: "2026-09-13", priority: "low" }),
    task({ id: "today-urgent", due_date: "2026-09-14", priority: "urgent" }),
    task({ id: "undated", priority: "high" }),
    task({ id: "done", status: "completed", completed_at: "2026-09-12T00:00:00Z" }),
  ];

  it("orders overdue, due-soon, priority, undated, then completed", () => {
    expect(sortTasks(rows, "2026-09-14", "America/Toronto").map((row) => row.id)).toEqual(["overdue", "today-urgent", "today-low", "future", "undated", "done"]);
  });

  it("provides reusable today, overdue, upcoming, completed, and undated filters", () => {
    expect(filterTasks(rows, "today", "2026-09-14", "America/Toronto")).toHaveLength(2);
    expect(filterTasks(rows, "overdue", "2026-09-14", "America/Toronto")[0].id).toBe("overdue");
    expect(filterTasks(rows, "upcoming", "2026-09-14", "America/Toronto")[0].id).toBe("future");
    expect(filterTasks(rows, "completed", "2026-09-14", "America/Toronto")[0].id).toBe("done");
    expect(filterTasks(rows, "no_due_date", "2026-09-14", "America/Toronto")[0].id).toBe("undated");
  });

  it("exposes summary counts without component-local logic", () => {
    expect(summarizeTasks(rows, "2026-09-14", "America/Toronto")).toEqual({ active: 5, dueToday: 2, overdue: 1, upcoming: 1, noDueDate: 1, completed: 1 });
  });

  it("formats user-entered effort compactly", () => {
    expect(formatEffort(30)).toBe("30 min");
    expect(formatEffort(120)).toBe("2h");
    expect(formatEffort(150)).toBe("2h 30m");
  });
});
