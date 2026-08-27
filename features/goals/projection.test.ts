import { describe, expect, it } from "vitest";

import { combineCalendarItems } from "../calendar/projection";
import type { CalendarItem, CalendarSourceType } from "../calendar/types";
import { goalToCalendarItem } from "./projection";
import type { GoalRecord } from "./types";

const goal = (overrides: Partial<GoalRecord> = {}): GoalRecord => ({ id: "g1", title: "Launch portfolio", description: null, category: "career", status: "active", deadline: "2026-10-01", progress_mode: "percentage", current_value_decimal: "70.0000", target_value_decimal: null, unit_label: null, completed_at: null, archived_at: null, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z", ...overrides });
const item = (sourceType: CalendarSourceType, id: string, date = "2026-10-01"): CalendarItem => ({ id, sourceType, sourceId: id, title: id, start: date, end: date, allDay: true, category: null, type: "test", description: null, location: null, amount: null, currency: null, isEditable: false, sourceUrl: "/", recurrence: null, reminderOffsets: [], metadata: {} });

describe("Goal Calendar projection", () => {
  it("projects active dated Goals as read-only source items", () => {
    expect(goalToCalendarItem(goal())).toMatchObject({ id: "goal:g1", sourceType: "goal", start: "2026-10-01", allDay: true, isEditable: false, sourceUrl: "/goals/g1" });
    expect(goalToCalendarItem(goal())?.description).toContain("70.0%");
  });

  it("excludes undated, completed, and archived Goals", () => {
    expect(goalToCalendarItem(goal({ deadline: null }))).toBeNull();
    expect(goalToCalendarItem(goal({ status: "completed", completed_at: "2026-09-20T00:00:00Z" }))).toBeNull();
    expect(goalToCalendarItem(goal({ archived_at: "2026-09-20T00:00:00Z" }))).toBeNull();
  });

  it("bounds Goals and aggregates Native + Finance + School + Tasks + Goals", () => {
    const sources: CalendarSourceType[] = ["native", "bill", "course_meeting", "task", "goal"];
    const items = combineCalendarItems([...sources.map((source) => item(source, source)), item("goal", "outside", "2026-11-01")], { start: "2026-10-01", end: "2026-10-01" }, "America/Toronto");
    expect(new Set(items.map((entry) => entry.sourceType))).toEqual(new Set(sources));
    expect(items.some((entry) => entry.id === "outside")).toBe(false);
  });
});
