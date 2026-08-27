import { describe, expect, it } from "vitest";

import { addCalendarDays, currentDateInTimeZone, currentMonthKey, daysRemainingInPeriod, monthRange, previousMonthKey } from "./date-ranges";

describe("finance date ranges", () => {
  it("builds exact month boundaries including leap years", () => {
    expect(monthRange("2028-02")).toEqual({ start: "2028-02-01", end: "2028-02-29" });
    expect(previousMonthKey("2026-01")).toBe("2025-12");
  });

  it("uses the user's timezone at UTC month boundaries", () => {
    expect(currentMonthKey("America/Toronto", new Date("2026-09-01T02:00:00Z"))).toBe("2026-08");
    expect(currentDateInTimeZone("America/Toronto", new Date("2026-09-01T02:00:00Z"))).toBe("2026-08-31");
  });

  it("counts the current day in days remaining", () => {
    expect(daysRemainingInPeriod("2026-08-27", monthRange("2026-08"))).toBe(5);
  });

  it("adds days without local-time or daylight-saving drift", () => {
    expect(addCalendarDays("2026-03-07", 2)).toBe("2026-03-09");
  });
});
