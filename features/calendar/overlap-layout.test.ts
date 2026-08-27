import { describe, expect, it } from "vitest";

import type { CalendarItem } from "./types";
import { layoutTimedItems } from "./overlap-layout";

function item(id: string, start: string, end: string): CalendarItem { return { id, sourceId: id, sourceType: "native", title: id, start, end, allDay: false, category: null, type: "event", description: null, location: null, amount: null, currency: null, isEditable: true, sourceUrl: `/calendar/events/${id}`, recurrence: null, reminderOffsets: [], metadata: {} }; }

describe("timed overlap layout", () => {
  it("places overlapping events in separate deterministic columns", () => {
    const result = layoutTimedItems([item("meeting", "2026-09-14T18:00:00Z", "2026-09-14T19:00:00Z"), item("appointment", "2026-09-14T18:30:00Z", "2026-09-14T19:30:00Z")], "2026-09-14", "America/Toronto");
    expect(result.map(({ column, columnCount }) => [column, columnCount])).toEqual([[0,2],[1,2]]);
  });
  it("reuses a column for non-overlapping events", () => {
    const result = layoutTimedItems([item("a", "2026-09-14T14:00:00Z", "2026-09-14T15:00:00Z"), item("b", "2026-09-14T15:00:00Z", "2026-09-14T16:00:00Z")], "2026-09-14", "America/Toronto");
    expect(result.map(({ columnCount }) => columnCount)).toEqual([1,1]);
  });
});
