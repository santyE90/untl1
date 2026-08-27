import { describe, expect, it } from "vitest";

import { formatGoalPercent, goalExactToDecimal, goalProgress, goalProgressSummary, parseGoalExact, summarizeGoal, summarizeGoals } from "./progress";
import type { GoalWithRelations } from "./types";

const goal = (overrides: Partial<GoalWithRelations> = {}): GoalWithRelations => ({ id: "goal-1", title: "Goal", description: null, category: "personal", status: "active", deadline: null, progress_mode: "none", current_value_decimal: null, target_value_decimal: null, unit_label: null, completed_at: null, archived_at: null, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z", milestones: [], tasks: [], ...overrides });

describe("exact Goal progress", () => {
  it("keeps no-progress goals explicitly unmeasured", () => {
    expect(goalProgress(goal())).toBeNull();
    expect(goalProgressSummary(goal())).toBeNull();
  });

  it("calculates numeric target percentages with four-decimal exact arithmetic", () => {
    const result = goalProgress(goal({ progress_mode: "numeric", current_value_decimal: "3250.0000", target_value_decimal: "5000.0000", unit_label: "CAD" }))!;
    expect(result.percent).toBe(parseGoalExact("65"));
    expect(formatGoalPercent(result.percent)).toBe("65.0%");
  });

  it("preserves progress above target instead of clamping the actual value", () => {
    const row = goal({ progress_mode: "numeric", current_value_decimal: "5250.0000", target_value_decimal: "5000.0000", unit_label: "CAD" });
    expect(goalProgress(row)).toMatchObject({ exceeded: true, percent: parseGoalExact("105") });
    expect(goalProgressSummary(row)).toContain("105.0%");
  });

  it("supports manual percentage and exact decimal formatting", () => {
    expect(formatGoalPercent(goalProgress(goal({ progress_mode: "percentage", current_value_decimal: "70.1250" }))!.percent)).toBe("70.1%");
    expect(goalExactToDecimal(parseGoalExact("18.2500"))).toBe("18.25");
    expect(() => parseGoalExact("0.00001")).toThrow();
  });
});

describe("Goal summaries remain independent", () => {
  it("reports milestone and Task completion without auto-completing the Goal", () => {
    const row = goal({ milestones: [{ id: "m", goal_id: "goal-1", title: "Done", description: null, target_date: null, sort_order: 0, is_completed: true, completed_at: "2026-09-02T00:00:00Z", archived_at: null, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-02T00:00:00Z" }], tasks: [{ id: "t", goal_id: "goal-1", title: "Done task", status: "completed", priority: "medium", due_date: null, due_at: null, archived_at: null }] });
    expect(summarizeGoal(row)).toMatchObject({ milestonesCompleted: 1, milestoneTotal: 1, tasksCompleted: 1, taskTotal: 1, openTasks: 0 });
    expect(row.status).toBe("active");
  });

  it("provides active, completed, overdue, and upcoming deadline summaries", () => {
    const rows = [goal({ id: "overdue", deadline: "2026-09-01" }), goal({ id: "upcoming", deadline: "2026-10-01" }), goal({ id: "done", status: "completed", completed_at: "2026-09-01T00:00:00Z" })];
    expect(summarizeGoals(rows, "2026-09-14")).toMatchObject({ active: 2, completed: 1, overdue: 1 });
    expect(summarizeGoals(rows, "2026-09-14").upcomingDeadlines.map((item) => item.id)).toEqual(["upcoming"]);
  });
});
