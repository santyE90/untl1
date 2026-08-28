import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedAppContext } from "../shared/server-context";
import { createNativeCalendarEvent, parseCalendarEventMutation, updateNativeCalendarEvent } from "./mutations";

const allDay = { title: "Reading Week", eventType: "school", allDay: true, startDate: "2026-10-12", endDate: "2026-10-16", startsAtLocal: "", endsAtLocal: "", description: "", location: "", recurrenceFrequency: "", recurrenceUntil: "", reminderOffsets: [] };
const timed = { ...allDay, title: "Dentist", allDay: false, startDate: "", endDate: "", startsAtLocal: "2026-08-28T14:00", endsAtLocal: "2026-08-28T15:00" };

function contextWith(results: { data: unknown; error: unknown }[]) {
  const filters: [string, unknown][] = []; let index = 0;
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "is", "not"]) chain[method] = vi.fn(() => chain);
  chain.eq = vi.fn((key: string, value: unknown) => { filters.push([key, value]); return chain; });
  chain.maybeSingle = vi.fn(async () => results[Math.min(index++, results.length - 1)]);
  chain.single = vi.fn(async () => results[Math.min(index++, results.length - 1)]);
  const insert = vi.fn(() => chain); const update = vi.fn(() => chain); const rpc = vi.fn(async () => ({ error: null }));
  return { context: { user: { id: "user-a" }, timeZone: "America/Toronto", supabase: { from: vi.fn(() => ({ insert, update, select: chain.select })), rpc } } as unknown as AuthenticatedAppContext, filters, insert, update, rpc };
}

describe("native Calendar mutation services", () => {
  it("preserves inclusive all-day dates and converts Toronto wall time", () => {
    expect(parseCalendarEventMutation(allDay, "America/Toronto")).toMatchObject({ ok: true, data: { values: { all_day: true, start_date: "2026-10-12", end_date: "2026-10-16", starts_at: null } } });
    expect(parseCalendarEventMutation(timed, "America/Toronto")).toMatchObject({ ok: true, data: { values: { starts_at: "2026-08-28T18:00:00.000Z", ends_at: "2026-08-28T19:00:00.000Z", start_date: null } } });
  });
  it("rejects ordering errors and Toronto spring-forward gaps", () => {
    expect(parseCalendarEventMutation({ ...timed, endsAtLocal: timed.startsAtLocal }, "America/Toronto")).toMatchObject({ ok: false, error: { code: "validation" } });
    expect(parseCalendarEventMutation({ ...timed, startsAtLocal: "2026-03-08T02:30", endsAtLocal: "2026-03-08T03:30" }, "America/Toronto")).toMatchObject({ ok: false, error: { message: expect.stringContaining("does not exist") } });
  });
  it("creates as the authenticated user and cannot update an ownership-hidden event", async () => {
    const row = { id: "02c682b2-c324-4a49-913d-085d028768cd", title: "Dentist", updated_at: "v1" };
    const created = contextWith([{ data: row, error: null }]);
    expect(await createNativeCalendarEvent(timed, created.context)).toMatchObject({ ok: true });
    expect(created.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "user-a", title: "Dentist" }));
    const hidden = contextWith([{ data: null, error: null }]);
    expect(await updateNativeCalendarEvent(row.id, timed, hidden.context)).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(hidden.filters).toContainEqual(["user_id", "user-a"]);
  });
  it("rejects stale updates and preserves reminders for Assistant updates", async () => {
    const id = "02c682b2-c324-4a49-913d-085d028768cd";
    const stale = contextWith([{ data: { id, recurrence_timezone: null, updated_at: "new" }, error: null }]);
    expect(await updateNativeCalendarEvent(id, timed, stale.context, { expectedUpdatedAt: "old", preserveReminders: true })).toMatchObject({ ok: false, error: { code: "conflict" } });
    const row = { id, title: "Dentist", event_type: null, all_day: false, starts_at: "2026-08-28T18:00:00Z", ends_at: "2026-08-28T19:00:00Z", start_date: null, end_date: null, description: null, location: null, recurrence_frequency: null, recurrence_until: null, recurrence_timezone: null, updated_at: "new" };
    const valid = contextWith([{ data: { id, recurrence_timezone: null, updated_at: "old" }, error: null }, { data: row, error: null }]);
    expect(await updateNativeCalendarEvent(id, timed, valid.context, { expectedUpdatedAt: "old", preserveReminders: true })).toMatchObject({ ok: true });
    expect(valid.rpc).not.toHaveBeenCalled();
  });
});
