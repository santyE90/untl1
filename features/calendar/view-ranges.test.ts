import { describe, expect, it } from "vitest";

import { navigateCalendarDate, rangeForCalendarView, weekRange } from "./view-ranges";

describe("Calendar view ranges", () => {
  it("calculates Sunday-first week boundaries across a year", () => expect(weekRange("2027-01-01", 0)).toEqual({ start: "2026-12-27", end: "2027-01-02" }));
  it("bounds day and 90-day agenda views", () => {
    expect(rangeForCalendarView("day", "2026-09-14")).toEqual({ start: "2026-09-14", end: "2026-09-14" });
    expect(rangeForCalendarView("agenda", "2026-12-15")).toEqual({ start: "2026-12-15", end: "2027-03-14" });
  });
  it("retains selected-date context while switching and navigating", () => {
    expect(navigateCalendarDate("day", "2026-09-14", 1)).toBe("2026-09-15");
    expect(navigateCalendarDate("week", "2026-09-14", -1)).toBe("2026-09-07");
    expect(navigateCalendarDate("month", "2026-12-14", 1)).toBe("2027-01-01");
  });
});
