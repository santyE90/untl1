import { describe, expect, it } from "vitest";

import { calendarEventSchema } from "./schemas";

const timed = { title: "Doctor appointment", eventType: "appointment", allDay: false, startDate: "", endDate: "", startsAtLocal: "2026-09-14T14:30", endsAtLocal: "2026-09-14T15:15", description: "", location: "" };

describe("calendarEventSchema", () => {
  it("accepts a valid timed event and normalizes optional text", () => {
    const parsed = calendarEventSchema.parse(timed);
    expect(parsed.description).toBeNull();
  });

  it("rejects missing titles and reversed timed ranges", () => {
    expect(calendarEventSchema.safeParse({ ...timed, title: "" }).success).toBe(false);
    expect(calendarEventSchema.safeParse({ ...timed, endsAtLocal: "2026-09-14T13:00" }).success).toBe(false);
  });

  it("keeps all-day events as inclusive dates and rejects reversed spans", () => {
    expect(calendarEventSchema.safeParse({ ...timed, allDay: true, startDate: "2026-09-14", endDate: "2026-09-16", startsAtLocal: "", endsAtLocal: "" }).success).toBe(true);
    expect(calendarEventSchema.safeParse({ ...timed, allDay: true, startDate: "2026-09-16", endDate: "2026-09-14", startsAtLocal: "", endsAtLocal: "" }).success).toBe(false);
  });

  it("validates recurrence ends and reminder offsets", () => {
    expect(calendarEventSchema.safeParse({ ...timed, recurrenceFrequency: "weekly", recurrenceUntil: "2026-09-01", reminderOffsets: [30] }).success).toBe(false);
    const parsed = calendarEventSchema.parse({ ...timed, recurrenceFrequency: "weekly", recurrenceUntil: "2026-12-31", reminderOffsets: [30, 30, 1440] });
    expect(parsed.reminderOffsets).toEqual([30, 1440]);
    expect(calendarEventSchema.safeParse({ ...timed, reminderOffsets: [10081] }).success).toBe(false);
  });
});
