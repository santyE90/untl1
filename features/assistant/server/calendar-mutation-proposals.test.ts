import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedAppContext } from "@/features/shared/server-context";

const mocks = vi.hoisted(() => ({ register: vi.fn() }));
vi.mock("./pending-mutations", () => ({ registerPendingMutation: mocks.register }));
import { proposeAssistantCalendarMutation } from "./calendar-mutation-proposals";

const id = "02c682b2-c324-4a49-913d-085d028768cd";
const baseEvent = {
  id,
  title: "Dentist",
  event_type: "appointment",
  all_day: false,
  starts_at: "2026-08-28T18:00:00.000Z",
  ends_at: "2026-08-28T19:00:00.000Z",
  start_date: null,
  end_date: null,
  description: null,
  location: "Downtown Dental",
  recurrence_frequency: null as string | null,
  updated_at: "2026-08-27T10:00:00.000Z",
};

function contextWith(data: typeof baseEvent | null = baseEvent) {
  const filters: [string, unknown][] = [];
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockImplementation((key: string, value: unknown) => { filters.push([key, value]); return chain; });
  chain.is.mockReturnValue(chain);
  return {
    context: {
      user: { id: "user-a" },
      timeZone: "America/Toronto",
      supabase: { from: vi.fn(() => chain) },
    } as unknown as AuthenticatedAppContext,
    filters,
  };
}

const createArguments = (overrides: Record<string, unknown> = {}) => JSON.stringify({
  title: "Dentist",
  eventType: "appointment",
  description: null,
  location: "Downtown Dental",
  allDay: false,
  startDate: null,
  endDate: null,
  startsAtLocal: "2026-08-28T14:00",
  endsAtLocal: "2026-08-28T15:00",
  ...overrides,
});

describe("Assistant Calendar mutation proposals", () => {
  beforeEach(() => {
    mocks.register.mockReset().mockReturnValue({ token: "x".repeat(43), expiresAt: "2026-08-27T10:10:00.000Z", preview: {} });
  });

  it("prepares timed and inclusive multi-day all-day creates without writing", async () => {
    const timed = contextWith();
    expect(await proposeAssistantCalendarMutation("create_calendar_event", createArguments(), timed.context)).toMatchObject({ ok: true });
    expect(timed.context.supabase.from).not.toHaveBeenCalled();
    expect(mocks.register.mock.calls[0][1]).toMatchObject({ operation: "create_calendar_event", input: { startsAtLocal: "2026-08-28T14:00", endsAtLocal: "2026-08-28T15:00", recurrenceFrequency: "", reminderOffsets: [] } });
    expect(mocks.register.mock.calls[0][2].changes[0].after).toContain("America/Toronto");

    expect(await proposeAssistantCalendarMutation("create_calendar_event", createArguments({ title: "Reading Week", allDay: true, startDate: "2026-10-12", endDate: "2026-10-16", startsAtLocal: null, endsAtLocal: null }), timed.context)).toMatchObject({ ok: true });
    expect(mocks.register.mock.calls[1][2].changes[0].after).toContain("inclusive");
  });

  it("requires an explicit timed end and rejects unknown or ownership-like fields", async () => {
    const { context } = contextWith();
    expect(await proposeAssistantCalendarMutation("create_calendar_event", createArguments({ endsAtLocal: null }), context)).toMatchObject({ ok: false, error: { code: "validation" } });
    expect(await proposeAssistantCalendarMutation("create_calendar_event", createArguments({ userId: "user-b" }), context)).toMatchObject({ ok: false, error: { code: "validation" } });
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("loads an exact owned native event and stores a stale-safe update", async () => {
    const owned = contextWith();
    expect(await proposeAssistantCalendarMutation("update_calendar_event", JSON.stringify({ eventId: id, startsAtLocal: "2026-08-28T16:00", endsAtLocal: "2026-08-28T17:00" }), owned.context)).toMatchObject({ ok: true });
    expect(owned.filters).toContainEqual(["id", id]);
    expect(owned.filters).toContainEqual(["user_id", "user-a"]);
    expect(mocks.register.mock.calls[0][1]).toMatchObject({ operation: "update_calendar_event", eventId: id, expectedUpdatedAt: baseEvent.updated_at, input: { startsAtLocal: "2026-08-28T16:00", endsAtLocal: "2026-08-28T17:00" } });
  });

  it("rejects foreign, projected, and recurring event IDs safely", async () => {
    const hidden = contextWith(null);
    expect(await proposeAssistantCalendarMutation("update_calendar_event", JSON.stringify({ eventId: id, title: "Moved" }), hidden.context)).toMatchObject({ ok: false, error: { code: "not_found" } });
    const recurring = contextWith({ ...baseEvent, recurrence_frequency: "weekly" });
    expect(await proposeAssistantCalendarMutation("update_calendar_event", JSON.stringify({ eventId: id, title: "Moved" }), recurring.context)).toMatchObject({ ok: false, error: { code: "validation", message: expect.stringContaining("Recurring") } });
    expect(mocks.register).not.toHaveBeenCalled();
  });
});
