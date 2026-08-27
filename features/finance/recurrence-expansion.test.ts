import { describe, expect, it } from "vitest";

import { advanceAnchoredOccurrence, expandRecurringSchedule } from "./recurrence-expansion";

const range = { start: "2026-09-01", end: "2026-12-31" };
const base = { id: "schedule", sourceType: "bill" as const, name: "Internet", amount: "50", currency: "CAD", anchorDate: "2026-01-21", nextDate: "2026-09-21", accountId: null, active: true };

describe("recurrence expansion", () => {
  it("expands weekly and biweekly schedules", () => {
    expect(expandRecurringSchedule({ ...base, frequency: "weekly" }, { start: "2026-09-21", end: "2026-10-05" }).map((item) => item.date)).toEqual(["2026-09-21", "2026-09-28", "2026-10-05"]);
    expect(expandRecurringSchedule({ ...base, frequency: "biweekly" }, { start: "2026-09-21", end: "2026-10-19" }).map((item) => item.date)).toEqual(["2026-09-21", "2026-10-05", "2026-10-19"]);
  });

  it("expands monthly schedules through a bounded range", () => {
    expect(expandRecurringSchedule({ ...base, frequency: "monthly" }, range).map((item) => item.date)).toEqual(["2026-09-21", "2026-10-21", "2026-11-21", "2026-12-21"]);
  });

  it("uses the anchor day after end-of-month clamping without drift", () => {
    expect(advanceAnchoredOccurrence("2026-01-31", "monthly", "2026-01-31")).toBe("2026-02-28");
    expect(advanceAnchoredOccurrence("2026-02-28", "monthly", "2026-01-31")).toBe("2026-03-31");
  });

  it("restores leap-day yearly schedules in leap years", () => {
    expect(advanceAnchoredOccurrence("2028-02-29", "yearly", "2028-02-29")).toBe("2029-02-28");
    expect(advanceAnchoredOccurrence("2031-02-28", "yearly", "2028-02-29")).toBe("2032-02-29");
  });

  it("keeps account-optional occurrences and omits paused schedules", () => {
    expect(expandRecurringSchedule({ ...base, frequency: "monthly" }, range)[0].accountId).toBeNull();
    expect(expandRecurringSchedule({ ...base, frequency: "monthly", active: false }, range)).toEqual([]);
  });

  it("suppresses an occurrence already recorded as an actual", () => {
    expect(expandRecurringSchedule({ ...base, frequency: "monthly" }, range, new Set(["bill:schedule:2026-10-21"])).map((item) => item.date)).toEqual(["2026-09-21", "2026-11-21", "2026-12-21"]);
  });
});
