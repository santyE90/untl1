import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedAppContext } from "@/features/shared/server-context";
import { getCalendarContext } from "@/features/calendar/queries";
import { updateCalendarPreference, updateProfilePreferences } from "./service";

function contextWith(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn(async () => result); const select = vi.fn(() => ({ maybeSingle })); const eq = vi.fn(() => ({ select })); const update = vi.fn(() => ({ eq })); const from = vi.fn(() => ({ update }));
  const context = { user: { id: "user-a", email: "a@example.com", displayName: null }, profile: { currency: "CAD", timezone: "America/Toronto", week_starts_on: 0, calendar_default_view: "month" }, timeZone: "America/Toronto", today: "2026-08-28", supabase: { from } } as unknown as AuthenticatedAppContext;
  return { context, from, update, eq };
}

describe("Settings preference services", () => {
  it("normalizes and atomically updates valid profile preferences as the authenticated user", async () => {
    const mock = contextWith({ data: { currency: "USD", timezone: "America/Vancouver", week_starts_on: 1, calendar_default_view: "month" }, error: null });
    const result = await updateProfilePreferences({ currency: " usd ", timeZone: "America/Vancouver", weekStartsOn: "1", userId: "user-b" }, mock.context);
    expect(result).toEqual({ ok: true, data: { currency: "USD", timeZone: "America/Vancouver", weekStartsOn: 1, calendarDefaultView: "month" } });
    expect(mock.from).toHaveBeenCalledTimes(1); expect(mock.from).toHaveBeenCalledWith("profiles");
    expect(mock.update).toHaveBeenCalledWith({ currency: "USD", timezone: "America/Vancouver", week_starts_on: 1 });
    expect(mock.eq).toHaveBeenCalledWith("id", "user-a");
  });
  it("rejects invalid currency, timezone, and week start before querying", async () => {
    for (const input of [
      { currency: "US", timeZone: "America/Toronto", weekStartsOn: 0 },
      { currency: "USD", timeZone: "Not/A_Real_Zone", weekStartsOn: 0 },
      { currency: "USD", timeZone: "America/Toronto", weekStartsOn: 7 },
    ]) {
      const mock = contextWith({ data: null, error: null }); const result = await updateProfilePreferences(input, mock.context);
      expect(result).toMatchObject({ ok: false, error: { code: "validation" } }); expect(mock.from).not.toHaveBeenCalled();
    }
  });
  it("updates Calendar default view through the same owned profile boundary", async () => {
    const mock = contextWith({ data: { calendar_default_view: "agenda" }, error: null });
    expect(await updateCalendarPreference({ defaultView: "agenda", userId: "user-b" }, mock.context)).toEqual({ ok: true, data: { defaultView: "agenda" } });
    expect(mock.update).toHaveBeenCalledWith({ calendar_default_view: "agenda" }); expect(mock.eq).toHaveBeenCalledWith("id", "user-a");
    expect(await updateCalendarPreference({ defaultView: "timeline" }, mock.context)).toMatchObject({ ok: false, error: { code: "validation" } });
  });
  it("returns a structured safe failure for database errors", async () => {
    const mock = contextWith({ data: null, error: { message: "raw database detail" } });
    expect(await updateProfilePreferences({ currency: "CAD", timeZone: "Asia/Tokyo", weekStartsOn: 2 }, mock.context)).toEqual({ ok: false, error: { code: "unexpected", message: "LifeStack could not save these preferences. Try again." } });
  });
  it("does not rewrite domain records and Calendar resolves updated profile values", async () => {
    const mock = contextWith({ data: { currency: "JPY", timezone: "Asia/Tokyo", week_starts_on: 1, calendar_default_view: "week" }, error: null });
    await updateProfilePreferences({ currency: "JPY", timeZone: "Asia/Tokyo", weekStartsOn: 1 }, mock.context);
    expect(mock.from.mock.calls.flat()).toEqual(["profiles"]);
    const updated = { ...mock.context, profile: { currency: "JPY", timezone: "Asia/Tokyo", week_starts_on: 1, calendar_default_view: "week" }, timeZone: "Asia/Tokyo", today: "2026-08-29" } as AuthenticatedAppContext;
    await expect(getCalendarContext(updated)).resolves.toMatchObject({ timeZone: "Asia/Tokyo", weekStartsOn: 1, defaultView: "week" });
  });
});
