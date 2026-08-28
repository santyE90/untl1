import { describe, expect, it } from "vitest";
import { calculateCourseGrade, exactToString } from "@/features/school/grades";
import { financeDeepAnalytics, goalDeepAnalytics, schoolDeepAnalytics, serializeBudgetStatus, taskDeepAnalytics } from "./deep-calculations";
import type { AnalyticsRange } from "./date-range";

const range: AnalyticsRange = { key: "custom", label: "Custom", start: "2026-08-01", end: "2026-08-31", bucket: "day" };
const accounts = [{ id: "cad", currency: "CAD", currentBalance: "1000", includeInNetWorth: true, archivedAt: null }, { id: "usd", currency: "USD", currentBalance: "100", includeInNetWorth: true, archivedAt: null }];
const categories = [{ id: "food", name: "Food", color: null }, { id: "rent", name: "Rent", color: null }];

describe("deep Finance analytics", () => {
  const rows = [
    { id: "1", accountId: "cad", categoryId: "food", amount: "-100", kind: "expense", status: "posted", date: "2026-08-01", label: "Store", merchant: "Store" },
    { id: "2", accountId: "cad", categoryId: "rent", amount: "-200", kind: "expense", status: "posted", date: "2026-08-31", label: "Landlord", merchant: "Landlord" },
    { id: "3", accountId: "cad", categoryId: null, amount: "1000", kind: "income", status: "posted", date: "2026-08-15", label: "Pay", merchant: null },
    { id: "4", accountId: "cad", categoryId: "food", amount: "-999", kind: "transfer", status: "posted", date: "2026-08-10", label: "Transfer", merchant: null },
    { id: "5", accountId: "cad", categoryId: "food", amount: "-999", kind: "expense", status: "pending", date: "2026-08-10", label: "Pending", merchant: null },
    { id: "6", accountId: "cad", categoryId: "food", amount: "-999", kind: "expense", status: "void", date: "2026-08-10", label: "Void", merchant: null },
    { id: "7", accountId: "usd", categoryId: "food", amount: "-50", kind: "expense", status: "posted", date: "2026-08-10", label: "US Store", merchant: "US Store" },
    { id: "8", accountId: "cad", categoryId: "food", amount: "-50", kind: "expense", status: "posted", date: "2026-07-31", label: "Previous", merchant: "Store" },
  ];
  it("ranks exact categories and excludes transfers, pending, and void rows while separating currencies", () => {
    const result = financeDeepAnalytics(rows, accounts, categories, range, { start: "2026-07-01", end: "2026-07-31" });
    expect(result.comparisons).toEqual(expect.arrayContaining([expect.objectContaining({ currency: "CAD", expenses: "300.0000" }), expect.objectContaining({ currency: "USD", expenses: "50.0000" })]));
    expect(result.byCategory.map((item) => [item.currency, item.categoryName, item.amount, item.count])).toEqual([["CAD", "Rent", "200.0000", 1], ["CAD", "Food", "100.0000", 1], ["USD", "Food", "50.0000", 1]]);
    expect(result.byCategory.find((item) => item.currency === "CAD" && item.categoryId === "food")).toMatchObject({ sharePercent: 33.33, changePercent: 100 });
  });
  it("does not invent a percentage when the previous value is zero", () => {
    const result = financeDeepAnalytics(rows.filter((row) => row.id !== "8"), accounts, categories, range, { start: "2026-07-01", end: "2026-07-31" });
    expect(result.comparisons.find((item) => item.currency === "CAD")?.expenseChange).toBeNull();
  });
  it("reuses exact monthly budget status including over-budget actuals", () => {
    const period = financeDeepAnalytics(rows, accounts, categories, range, { start: "2026-07-01", end: "2026-07-31" }).current;
    const budget = serializeBudgetStatus({ id: "budget", currency: "CAD", overallLimit: "250" }, [{ categoryId: "food", amount: "80" }], period.byCategory, new Map([["food", "Food"]]));
    expect(budget).toMatchObject({ actual: "300.0000", remaining: "-50.0000", over: "50.0000", utilization: 120 });
    expect(budget.categories[0]).toMatchObject({ actual: "100.0000", over: "20.0000" });
  });
});

describe("deep School analytics", () => {
  const grade = (id: string, status: string, earned: string | null, max: string | null, weight = "20") => ({ id, name: id, weight, scoreEarned: earned, scoreMax: max, status });
  it("uses exact percentages, missed-zero, exempt exclusion, types, and workload coverage", () => {
    const items = [
      { id: "a", courseId: "c", courseCode: "CISC", name: "A", type: "assignment", status: "graded", localDate: "2026-08-01", weight: "20", effortMinutes: 60, grade: grade("a", "graded", "42", "50") },
      { id: "m", courseId: "c", courseCode: "CISC", name: "M", type: "quiz", status: "missed", localDate: "2026-08-31", weight: "10", effortMinutes: null, grade: grade("m", "missed", null, null, "10") },
      { id: "e", courseId: "c", courseCode: "CISC", name: "E", type: "quiz", status: "exempt", localDate: "2026-08-15", weight: "10", effortMinutes: 99, grade: grade("e", "exempt", null, null, "10") },
    ];
    const result = schoolDeepAnalytics(items, range);
    expect(result).toMatchObject({ due: 3, missed: 1, exempt: 1, effortMinutes: 60, effortCount: 1, configuredWeight: "30.0000" });
    expect(result.timeline.map((item) => item.percentage)).toEqual(["84.0000", "0.0000"]);
    expect(result.byType.find((item) => item.type === "quiz")).toMatchObject({ sampleCount: 1, averagePercent: "0.0000", assessments: 1 });
    expect(exactToString(calculateCourseGrade(items.map((item) => item.grade)).completedWorkGrade!)).toBe("56.0000");
  });
  it("handles an empty course/range", () => expect(schoolDeepAnalytics([], range)).toMatchObject({ due: 0, timeline: [], byType: [] }));
});

describe("deep Task analytics", () => {
  it("separates lifecycle, deadline, priority, effort, and duration semantics", () => {
    const result = taskDeepAnalytics([
      { id: "on", status: "completed", priority: "high", createdAt: "2026-08-01T10:00:00Z", completedAt: "2026-08-01T12:00:00Z", createdDate: "2026-08-01", completedDate: "2026-08-01", dueDate: "2026-08-01", dueAt: null, effortMinutes: 90, archived: false },
      { id: "late", status: "completed", priority: "urgent", createdAt: "2026-08-02T10:00:00Z", completedAt: "2026-08-02T15:00:00Z", createdDate: "2026-08-02", completedDate: "2026-08-02", dueDate: null, dueAt: "2026-08-02T14:00:00Z", effortMinutes: null, archived: false },
      { id: "over", status: "todo", priority: "medium", createdAt: "2026-07-01T10:00:00Z", completedAt: null, createdDate: "2026-07-01", completedDate: null, dueDate: "2026-08-30", dueAt: null, effortMinutes: 30, archived: false },
      { id: "none", status: "todo", priority: "low", createdAt: "2026-08-03T10:00:00Z", completedAt: null, createdDate: "2026-08-03", completedDate: null, dueDate: null, dueAt: null, effortMinutes: null, archived: false },
    ], range, "2026-08-31", "2026-08-31T12:00:00Z");
    expect(result).toMatchObject({ created: 3, completed: 2, currentlyOverdue: 1, activeNoDueDate: 1, deadline: { eligible: 2, onTime: 1, late: 1 }, medianCompletionMinutes: 210, completionDurationSamples: 2, completedEffortMinutes: 90, effortCoverage: { estimated: 1, completed: 2 } });
    expect(result.priorities.find((item) => item.priority === "urgent")).toMatchObject({ completed: 1 });
    expect(result.trend.find((item) => item.date === "2026-08-01")).toMatchObject({ created: 1, completed: 1 });
  });
});

describe("deep Goal analytics", () => {
  it("preserves modes, over-target values, deadlines, completion range, and categories", () => {
    const base = { description: null, unit_label: null, archived_at: null, created_at: "2026-07-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z" };
    const result = goalDeepAnalytics([
      { ...base, id: "p", title: "Percent", category: "personal", status: "active", deadline: "2026-08-01", progress_mode: "percentage", current_value_decimal: "120", target_value_decimal: null, completed_at: null },
      { ...base, id: "n", title: "Numeric", category: "school", status: "active", deadline: "2026-09-10", progress_mode: "numeric", current_value_decimal: "12", target_value_decimal: "20", completed_at: null },
      { ...base, id: "u", title: "None", category: "school", status: "completed", deadline: null, progress_mode: "none", current_value_decimal: null, target_value_decimal: null, completed_at: "2026-09-01T02:00:00Z" },
    ], range, "2026-08-28", "2026-09-27", "America/Toronto");
    expect(result).toMatchObject({ active: 2, completedTotal: 1, completedInRange: 1, overdue: 1, upcoming: 1, measured: 2, unmeasured: 1 });
    expect(result.items.find((item) => item.id === "p")).toMatchObject({ progressPercent: "120", overTarget: true });
    expect(result.items.find((item) => item.id === "n")).toMatchObject({ progressPercent: "60", overTarget: false });
    expect(result.categories.find((item) => item.category === "school")).toMatchObject({ active: 1, completed: 1, upcoming: 1 });
  });
});
