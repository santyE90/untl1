import { describe, expect, it } from "vitest";

import type { CalendarItemFor } from "../calendar/types";
import { summarizeCalendarOverview } from "./summary";

const native = (overrides: Partial<CalendarItemFor<"native">> = {}): CalendarItemFor<"native"> => ({ id: "native:n", sourceType: "native", sourceId: "n", title: "Event", start: "2026-09-15T02:00:00Z", end: "2026-09-15T03:00:00Z", allDay: false, category: null, type: "event", description: null, location: null, amount: null, currency: null, isEditable: true, sourceUrl: "/calendar/events/n", recurrence: null, reminderOffsets: [], metadata: {}, ...overrides });

describe("cross-module Today and Upcoming summaries", () => {
  it("classifies timed instants using the profile timezone", () => {
    const result = summarizeCalendarOverview([native()], { start: "2026-09-14", end: "2026-09-20" }, "2026-09-14", "America/Toronto");
    expect(result.todayItems.map((item) => item.id)).toEqual(["native:n"]);
  });

  it("includes all-day spans for every covered local date and counts sources", () => {
    const goal: CalendarItemFor<"goal"> = { ...native({ id: "goal:g", sourceId: "g", start: "2026-09-13", end: "2026-09-15", allDay: true, isEditable: false, sourceUrl: "/goals/g" }), sourceType: "goal", metadata: {} };
    const result = summarizeCalendarOverview([goal], { start: "2026-09-14", end: "2026-09-20" }, "2026-09-14", "Asia/Tokyo");
    expect(result.todayItems).toHaveLength(1);
    expect(result.countsBySource).toEqual({ goal: 1 });
  });
});
