import { describe, expect, it } from "vitest";

import { assessmentLocalDate, calculateTermProgress, daysUntilLabel, filterUpcomingAssessments, getMajorAssessments, groupMeetingPatterns, planningRanges, summarizeWorkload, type PlanningAssessment } from "./planning";

const assessment = (overrides: Partial<PlanningAssessment> = {}): PlanningAssessment => ({ id: crypto.randomUUID(), course_id: "course", name: "Assignment", assessment_type: "assignment", timing_type: "deadline", due_at: "2026-09-15T02:00:00.000Z", starts_at: null, event_date: null, weight_percent: 10, status: "upcoming", location: null, estimated_effort_minutes: null, archived_at: null, ...overrides });

describe("School planning", () => {
  it("uses the profile timezone for assessment date boundaries", () => {
    expect(assessmentLocalDate(assessment(), "America/Toronto")).toBe("2026-09-14");
  });

  it("filters inclusive cross-course ranges and excludes handled or archived work", () => {
    const rows = [assessment({ course_id: "a" }), assessment({ course_id: "b", due_at: "2026-09-21T16:00:00Z" }), assessment({ status: "submitted" }), assessment({ archived_at: "2026-01-01T00:00:00Z" })];
    expect(filterUpcomingAssessments(rows, { start: "2026-09-14", end: "2026-09-20" }, "America/Toronto").map((row) => row.course_id)).toEqual(["a"]);
  });

  it("builds exact 7, 14, and 30 day inclusive windows", () => {
    const ranges = planningRanges("2026-09-14", "2026-12-20");
    expect(ranges.seven.end).toBe("2026-09-20");
    expect(ranges.fourteen.end).toBe("2026-09-27");
    expect(ranges.thirty.end).toBe("2026-10-13");
  });

  it("classifies major work by explicit assessment type rather than weight", () => {
    const rows = [assessment({ assessment_type: "quiz", weight_percent: 50 }), assessment({ assessment_type: "midterm", weight_percent: 5 })];
    expect(getMajorAssessments(rows, { start: "2026-09-01", end: "2026-09-30" }, "America/Toronto").map((row) => row.assessment_type)).toEqual(["midterm"]);
  });

  it("summarizes entered effort without implying missing estimates", () => {
    const summary = summarizeWorkload([assessment({ estimated_effort_minutes: 120 }), assessment({ estimated_effort_minutes: null, weight_percent: 12.5 })]);
    expect(summary).toMatchObject({ assessmentCount: 2, estimatedMinutes: 120, estimatedCount: 1 });
    expect(summary.combinedWeight).toBe(225000n);
  });

  it("clamps semester progress before, during, and after a term", () => {
    const term = { start_date: "2026-09-01", end_date: "2026-09-10" };
    expect(calculateTermProgress(term, "2026-08-20").percentElapsed).toBe(0);
    expect(calculateTermProgress(term, "2026-09-05")).toMatchObject({ elapsedDays: 5, remainingDays: 5, percentElapsed: 50 });
    expect(calculateTermProgress(term, "2026-12-01").percentElapsed).toBe(100);
  });

  it("groups matching weekday rows into one readable meeting pattern", () => {
    const base = { meeting_type: "lecture", start_time: "10:30:00", end_time: "11:30:00", location: "Room", effective_start_date: "2026-09-01", effective_end_date: "2026-12-01", is_active: true };
    expect(groupMeetingPatterns([{ ...base, id: "m", weekday: 1 }, { ...base, id: "w", weekday: 3 }, { ...base, id: "f", weekday: 5 }])[0].weekdays).toEqual([1, 3, 5]);
  });

  it("formats days-until labels from calendar dates, not UTC durations", () => {
    expect(daysUntilLabel("2026-09-14", "2026-09-15")).toBe("Due tomorrow");
    expect(daysUntilLabel("2026-09-14", "2026-09-17", "Exam")).toBe("Exam in 3 days");
  });
});
