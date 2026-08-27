import { describe, expect, it } from "vitest";

import { assertCalendarDate, dateForInstant, instantToLocalInput, monthGridRange, zonedLocalDateTimeToUtc } from "./dates";

describe("Calendar timezone handling", () => {
  it("stores a Toronto wall time as an unambiguous UTC instant", () => {
    expect(zonedLocalDateTimeToUtc("2026-09-14T14:30", "America/Toronto")).toBe("2026-09-14T18:30:00.000Z");
    expect(instantToLocalInput("2026-09-14T18:30:00.000Z", "America/Toronto")).toBe("2026-09-14T14:30");
  });

  it("rejects a nonexistent spring-forward wall time", () => {
    expect(() => zonedLocalDateTimeToUtc("2026-03-08T02:30", "America/Toronto")).toThrow("does not exist");
  });

  it("chooses the earlier instant consistently for an ambiguous fall-back time", () => {
    expect(zonedLocalDateTimeToUtc("2026-11-01T01:30", "America/Toronto")).toBe("2026-11-01T05:30:00.000Z");
  });

  it("derives local dates without shifting all-day values", () => {
    expect(dateForInstant("2026-09-15T02:00:00.000Z", "America/Toronto")).toBe("2026-09-14");
    expect(() => assertCalendarDate("2026-02-31")).toThrow("invalid");
  });
});

describe("Calendar month ranges", () => {
  it("bounds a Sunday-first month grid across month and year edges", () => {
    expect(monthGridRange("2027-01", 0)).toEqual({ start: "2026-12-27", end: "2027-02-06" });
  });
});
