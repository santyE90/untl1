import { describe, expect, it } from "vitest";

import { advanceAnchoredDate, expandAnchoredDates } from "./recurrence";

describe("shared anchored recurrence", () => {
  it("advances daily and weekly dates", () => {
    expect(advanceAnchoredDate("2026-09-01", "daily", "2026-09-01")).toBe("2026-09-02");
    expect(advanceAnchoredDate("2026-09-01", "weekly", "2026-09-01")).toBe("2026-09-08");
  });

  it("preserves monthly anchors 29, 30, and 31 without drift", () => {
    const expand = (anchorDate: string) => expandAnchoredDates({ anchorDate, frequency: "monthly", range: { start: anchorDate, end: "2026-05-31" } });
    expect(expand("2026-01-31")).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"]);
    expect(expand("2026-01-30")).toEqual(["2026-01-30", "2026-02-28", "2026-03-30", "2026-04-30", "2026-05-30"]);
    expect(expand("2026-01-29")).toEqual(["2026-01-29", "2026-02-28", "2026-03-29", "2026-04-29", "2026-05-29"]);
  });

  it("clamps leap-day annually and returns to February 29", () => {
    expect(expandAnchoredDates({ anchorDate: "2024-02-29", frequency: "yearly", range: { start: "2024-01-01", end: "2028-12-31" } })).toEqual(["2024-02-29", "2025-02-28", "2026-02-28", "2027-02-28", "2028-02-29"]);
  });

  it("honours inclusive end dates and a defensive bound", () => {
    expect(expandAnchoredDates({ anchorDate: "2026-01-01", frequency: "daily", range: { start: "2026-01-03", end: "2026-01-10" }, until: "2026-01-05" })).toEqual(["2026-01-03", "2026-01-04", "2026-01-05"]);
    expect(() => expandAnchoredDates({ anchorDate: "1900-01-01", frequency: "daily", range: { start: "2026-01-01", end: "2026-01-02" }, maxOccurrences: 10 })).toThrow("safe bound");
  });
});
