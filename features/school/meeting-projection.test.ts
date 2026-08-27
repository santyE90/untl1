import { describe, expect, it } from "vitest";

import { projectCourseMeetings, type MeetingSource } from "./meeting-projection";

const source: MeetingSource = { id: "m1", courseId: "c1", courseCode: "CSC101", courseName: "Computing", meetingType: "lecture", weekday: 1, startTime: "09:00:00", endTime: "10:00:00", timezone: "America/Toronto", location: "Room 1", effectiveStart: "2026-03-01", effectiveEnd: "2026-03-31", active: true, colorKey: "plum" };

describe("weekly course meeting projection", () => {
  it("projects stable, read-only occurrences within both query and term boundaries", () => {
    const items = projectCourseMeetings(source, { start: "2026-03-08", end: "2026-03-17" });
    expect(items.map((item) => item.id)).toEqual(["course_meeting:m1:2026-03-09", "course_meeting:m1:2026-03-16"]);
    expect(items[0]).toMatchObject({ sourceType: "course_meeting", isEditable: false, sourceUrl: "/school/courses/c1" });
  });

  it("preserves local wall time across daylight-saving changes", () => {
    const items = projectCourseMeetings(source, { start: "2026-03-01", end: "2026-03-16" });
    expect(items.map((item) => item.start)).toEqual(["2026-03-02T14:00:00.000Z", "2026-03-09T13:00:00.000Z", "2026-03-16T13:00:00.000Z"]);
  });

  it("supports multiple weekdays as independent authoritative schedule rows", () => {
    const tuesday = { ...source, id: "m2", weekday: 2 };
    const items = [source, tuesday].flatMap((meeting) => projectCourseMeetings(meeting, { start: "2026-03-09", end: "2026-03-10" }));
    expect(items.map((item) => item.id)).toEqual(["course_meeting:m1:2026-03-09", "course_meeting:m2:2026-03-10"]);
  });

  it("omits paused or out-of-range schedules", () => {
    expect(projectCourseMeetings({ ...source, active: false }, { start: "2026-03-01", end: "2026-03-31" })).toEqual([]);
    expect(projectCourseMeetings(source, { start: "2026-04-01", end: "2026-04-30" })).toEqual([]);
  });
});
