import { describe, expect, it } from "vitest";

import type { NativeCalendarEvent } from "./types";
import { expandNativeEvent } from "./native-recurrence";
import { combineCalendarItems, financeEntryToCalendarItem } from "./projection";
import { buildCashFlowTimeline } from "../finance/cash-flow-planning";

const timed: NativeCalendarEvent = { id: "gym", title: "Gym", eventType: "health", allDay: false, startsAt: "2026-02-23T00:00:00.000Z", endsAt: "2026-02-23T01:00:00.000Z", startDate: null, endDate: null, description: null, location: null, archivedAt: null, recurrenceFrequency: "weekly", recurrenceUntil: null, recurrenceTimezone: "America/Toronto", reminderOffsets: [30] };

describe("native recurrence projection", () => {
  it("preserves a timed local wall clock across DST", () => {
    const items = expandNativeEvent(timed, { start: "2026-03-01", end: "2026-03-31" });
    expect(items.map((item) => item.start)).toEqual(["2026-03-02T00:00:00.000Z", "2026-03-08T23:00:00.000Z", "2026-03-15T23:00:00.000Z", "2026-03-22T23:00:00.000Z", "2026-03-29T23:00:00.000Z"]);
    expect(items.every((item) => item.reminderOffsets[0] === 30 && item.recurrence?.frequency === "weekly")).toBe(true);
  });

  it("keeps recurring all-day spans date based", () => {
    const event: NativeCalendarEvent = { ...timed, id: "retreat", title: "Retreat", allDay: true, startsAt: null, endsAt: null, startDate: "2026-01-31", endDate: "2026-02-02", recurrenceFrequency: "monthly", recurrenceTimezone: null };
    const items = expandNativeEvent(event, { start: "2026-02-01", end: "2026-03-31" });
    expect(items.map((item) => [item.start, item.end])).toEqual([["2026-01-31", "2026-02-02"], ["2026-02-28", "2026-03-02"], ["2026-03-31", "2026-04-02"]]);
  });

  it("excludes archived series and respects series end", () => {
    expect(expandNativeEvent({ ...timed, archivedAt: "2026-03-01T00:00:00Z" }, { start: "2026-03-01", end: "2026-03-31" })).toEqual([]);
    expect(expandNativeEvent({ ...timed, recurrenceUntil: "2026-03-09" }, { start: "2026-03-01", end: "2026-03-31" })).toHaveLength(2);
  });

  it("shifts a nonexistent recurring wall time to the first valid minute", () => {
    const gap: NativeCalendarEvent = { ...timed, startsAt: "2026-03-07T07:30:00.000Z", endsAt: "2026-03-07T08:30:00.000Z", recurrenceFrequency: "daily" };
    const item = expandNativeEvent(gap, { start: "2026-03-08", end: "2026-03-08" })[0];
    expect(item.start).toBe("2026-03-08T07:00:00.000Z");
  });

  it("aggregates recurring native, single native, and Finance items", () => {
    const recurring = expandNativeEvent(timed, { start: "2026-03-01", end: "2026-03-02" });
    const single = expandNativeEvent({ ...timed, id: "single", recurrenceFrequency: null, recurrenceTimezone: null, startsAt: "2026-03-01T15:00:00Z", endsAt: "2026-03-01T16:00:00Z" }, { start: "2026-03-01", end: "2026-03-02" });
    const finance = buildCashFlowTimeline([{ id: "bill", sourceType: "bill", name: "Bill", amount: "10", currency: "CAD", frequency: "monthly", anchorDate: "2026-03-01", nextDate: "2026-03-01", accountId: null, active: true }], { start: "2026-03-01", end: "2026-03-02" }).map((entry) => financeEntryToCalendarItem(entry, null));
    const combined = combineCalendarItems([...recurring, ...single, ...finance], { start: "2026-03-01", end: "2026-03-02" }, "America/Toronto");
    expect(combined.map((item) => item.sourceType)).toEqual(["bill", "native", "native"]);
  });
});
