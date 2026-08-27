import { describe, expect, it } from "vitest";

import { buildCashFlowTimeline } from "../finance/cash-flow-planning";
import type { RecurringProjectionSource } from "../finance/recurrence-expansion";

import { combineCalendarItems, financeEntryToCalendarItem, nativeEventToCalendarItem } from "./projection";

const schedules: RecurringProjectionSource[] = [
  { id: "bill-1", sourceType: "bill", name: "Internet", amount: "50.0000", currency: "CAD", frequency: "monthly", anchorDate: "2026-09-21", nextDate: "2026-09-21", accountId: null, active: true },
  { id: "income-1", sourceType: "income", name: "Payday", amount: "900.0000", currency: "USD", frequency: "biweekly", anchorDate: "2026-09-05", nextDate: "2026-09-05", accountId: "account-1", active: true },
  { id: "paused", sourceType: "bill", name: "Paused", amount: "10.0000", currency: "CAD", frequency: "weekly", anchorDate: "2026-09-01", nextDate: "2026-09-01", accountId: null, active: false },
];

describe("Calendar projection", () => {
  it("combines native and bounded Finance items chronologically", () => {
    const range = { start: "2026-09-01", end: "2026-09-30" };
    const finance = buildCashFlowTimeline(schedules, range).map((entry) => financeEntryToCalendarItem(entry, entry.accountId ? "USD Account" : null));
    const native = nativeEventToCalendarItem({ id: "native-1", title: "Appointment", eventType: "appointment", allDay: false, startsAt: "2026-09-14T18:30:00.000Z", endsAt: "2026-09-14T19:15:00.000Z", startDate: null, endDate: null, description: null, location: null, archivedAt: null, recurrenceFrequency: null, recurrenceUntil: null, recurrenceTimezone: null, reminderOffsets: [] });
    const items = combineCalendarItems([...finance, native], range, "America/Toronto");
    expect(items.map((item) => item.title)).toEqual(["Payday", "Appointment", "Payday", "Internet"]);
    expect(items.every((item) => item.start.slice(0, 10) >= range.start && item.start.slice(0, 10) <= range.end)).toBe(true);
  });

  it("preserves source ownership, links, currencies, and unassigned schedules", () => {
    const entries = buildCashFlowTimeline(schedules, { start: "2026-09-01", end: "2026-09-21" });
    const items = entries.map((entry) => financeEntryToCalendarItem(entry, entry.accountId ? "USD Account" : null));
    const bill = items.find((item) => item.sourceType === "bill")!;
    const income = items.find((item) => item.sourceType === "income")!;
    expect(bill).toMatchObject({ amount: "-50.0000", currency: "CAD", isEditable: false, sourceUrl: "/finance#recurring", metadata: { accountName: "Unassigned" } });
    expect(income).toMatchObject({ amount: "+900.0000", currency: "USD", isEditable: false });
    expect(items.some((item) => item.sourceId === "paused")).toBe(false);
  });

  it("uses Finance recorded-occurrence suppression", () => {
    const recorded = new Set(["bill:bill-1:2026-09-21"]);
    expect(buildCashFlowTimeline(schedules, { start: "2026-09-21", end: "2026-09-21" }, recorded)).toEqual([]);
  });

  it("keeps multi-day all-day events visible at range boundaries", () => {
    const item = nativeEventToCalendarItem({ id: "trip", title: "Trip", eventType: null, allDay: true, startsAt: null, endsAt: null, startDate: "2026-08-30", endDate: "2026-09-02", description: null, location: null, archivedAt: null, recurrenceFrequency: null, recurrenceUntil: null, recurrenceTimezone: null, reminderOffsets: [] });
    expect(combineCalendarItems([item], { start: "2026-09-01", end: "2026-09-30" }, "America/Toronto")).toHaveLength(1);
  });
});
