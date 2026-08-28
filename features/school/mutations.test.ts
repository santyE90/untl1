import { describe, expect, it } from "vitest";

import { normalizeScoreInput, validateAssessmentMutation } from "./mutations";

const base = { courseId: "68c360bf-04f3-41ac-8377-d09884d77d91", name: "Midterm", assessmentType: "midterm", timingType: "deadline", dueLocal: "2026-11-01T23:59", startsLocal: "", endsLocal: "", eventDate: "", weight: "27.5000", scoreEarned: "", scoreMax: "", effortHours: "2.5", status: "upcoming", location: "", notes: "" };

describe("School assessment mutation domain service", () => {
  it("normalizes raw and percentage scores with exact decimal arithmetic", () => {
    expect(normalizeScoreInput({ mode: "raw", earned: "17.50", maximum: "20.00", percentage: null })).toEqual({ ok: true, data: { earned: "17.5000", maximum: "20.0000", equivalent: "87.5000" } });
    expect(normalizeScoreInput({ mode: "percentage", earned: null, maximum: null, percentage: "84.1250" })).toEqual({ ok: true, data: { earned: "84.1250", maximum: "100.0000", equivalent: "84.1250" } });
  });

  it("rejects missing, negative, over-maximum, and excess-precision scores", () => {
    for (const score of [
      { mode: "raw" as const, earned: null, maximum: "20", percentage: null },
      { mode: "raw" as const, earned: "-1", maximum: "20", percentage: null },
      { mode: "raw" as const, earned: "21", maximum: "20", percentage: null },
      { mode: "percentage" as const, earned: null, maximum: null, percentage: "10.00001" },
    ]) expect(normalizeScoreInput(score)).toMatchObject({ ok: false, error: { code: "validation" } });
  });

  it("preserves date-only values and converts timed deadlines in the user's timezone", () => {
    const timed = validateAssessmentMutation(base, "America/Toronto");
    expect(timed).toMatchObject({ ok: true, data: { values: { due_at: "2026-11-02T04:59:00.000Z", event_date: null, estimated_effort_minutes: 150 } } });
    const allDay = validateAssessmentMutation({ ...base, timingType: "all_day", dueLocal: "", eventDate: "2026-11-01" }, "America/Toronto");
    expect(allDay).toMatchObject({ ok: true, data: { values: { event_date: "2026-11-01", due_at: null } } });
  });
});
