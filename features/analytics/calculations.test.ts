import { describe, expect, it } from "vitest";
import { financeTrend, goalModeSummary, schoolStatusAnalytics, taskAnalytics } from "./calculations";

const range = { start: "2026-08-01", end: "2026-08-07", bucket: "day" as const };

describe("cross-module Analytics calculations", () => {
  it("excludes transfers/pending rows and keeps currencies separate", () => {
    const rows = [
      { id: "1", accountId: "cad", amount: "100", kind: "income", status: "posted", date: "2026-08-01" },
      { id: "2", accountId: "cad", amount: "-25.50", kind: "expense", status: "posted", date: "2026-08-01" },
      { id: "3", accountId: "usd", amount: "-10", kind: "expense", status: "posted", date: "2026-08-01" },
      { id: "4", accountId: "cad", amount: "-500", kind: "transfer", status: "posted", date: "2026-08-01" },
      { id: "5", accountId: "cad", amount: "-99", kind: "expense", status: "pending", date: "2026-08-01" },
    ];
    const trend = financeTrend(rows, new Map([["cad", "CAD"], ["usd", "USD"]]), range);
    expect(trend.find((item) => item.currency === "CAD" && item.date === "2026-08-01")).toMatchObject({ income: "100.0000", expenses: "25.5000" });
    expect(trend.find((item) => item.currency === "USD" && item.date === "2026-08-01")).toMatchObject({ income: "0.0000", expenses: "10.0000" });
  });
  it("returns stable empty Finance buckets", () => {
    expect(financeTrend([], new Map([["a", "CAD"]]), range)).toHaveLength(7);
    expect(financeTrend([], new Map(), range)).toEqual([]);
  });
  it("keeps missed as zero and excludes exempt assessment results", () => {
    const school = schoolStatusAnalytics([
      { status: "missed", localDate: "2026-08-02", grade: { id: "m", name: "Missed", weight: "10", scoreEarned: null, scoreMax: null, status: "missed" } },
      { status: "exempt", localDate: "2026-08-03", grade: { id: "e", name: "Exempt", weight: "10", scoreEarned: null, scoreMax: null, status: "exempt" } },
      { status: "graded", localDate: "2026-08-04", grade: { id: "g", name: "Quiz", weight: "10", scoreEarned: "8", scoreMax: "10", status: "graded" } },
    ], range);
    expect(school.results).toEqual([{ date: "2026-08-02", name: "Missed", percentage: "0.0000", status: "missed" }, { date: "2026-08-04", name: "Quiz", percentage: "80.0000", status: "graded" }]);
    expect(school.statuses.find((item) => item.status === "exempt")?.count).toBe(1);
  });
  it("filters Task lifecycle dates transparently", () => {
    const tasks = taskAnalytics([
      { status: "completed", priority: "high", createdDate: "2026-07-01", completedDate: "2026-08-02", overdue: false, effortMinutes: 30, archived: false },
      { status: "todo", priority: "urgent", createdDate: "2026-08-03", completedDate: null, overdue: true, effortMinutes: 10, archived: false },
      { status: "completed", priority: "low", createdDate: "2026-08-03", completedDate: "2026-08-04", overdue: false, effortMinutes: 99, archived: true },
    ], range);
    expect(tasks).toMatchObject({ created: 1, completed: 1, currentlyOverdue: 1, completedEffortMinutes: 30 });
    expect(tasks.completedByPriority.find((item) => item.priority === "high")?.count).toBe(1);
  });
  it("does not average incompatible Goal modes", () => {
    const goals = goalModeSummary([
      { archived: false, status: "active", completedDate: null, deadline: "2026-08-20", progressMode: "percentage", progressPercent: "50" },
      { archived: false, status: "active", completedDate: null, deadline: null, progressMode: "numeric", progressPercent: "25" },
      { archived: false, status: "completed", completedDate: "2026-08-02", deadline: null, progressMode: "none", progressPercent: null },
    ], range, "2026-08-01", "2026-08-31");
    expect(goals).toEqual({ active: 2, completed: 1, approaching: 1, measured: 2, unmeasured: 1 });
    expect(goals).not.toHaveProperty("average");
  });
  it("returns usable zero summaries for brand-new accounts", () => {
    expect(taskAnalytics([], range)).toMatchObject({ created: 0, completed: 0, currentlyOverdue: 0, completedEffortMinutes: 0 });
    expect(schoolStatusAnalytics([], range)).toMatchObject({ graded: 0, outcomes: 0, results: [] });
    expect(goalModeSummary([], range, "2026-08-01", "2026-08-31")).toEqual({ active: 0, completed: 0, approaching: 0, measured: 0, unmeasured: 0 });
  });
});
