import { describe, expect, it } from "vitest";

import { combineCalendarItems, nativeEventToCalendarItem } from "../calendar/projection";
import { projectCourseMeetings } from "../school/meeting-projection";
import { taskToCalendarItem } from "./projection";
import type { TaskWithContext } from "./types";

const task = (overrides: Partial<TaskWithContext> = {}): TaskWithContext => ({ id: "task-1", title: "Finish assignment", description: null, status: "todo", priority: "high", due_date: "2026-09-14", due_at: null, estimated_effort_minutes: 120, assessment_id: null, completed_at: null, archived_at: null, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z", assessment: null, ...overrides });

describe("Task Calendar projection", () => {
  it("projects date-only and timed due shapes without creating native events", () => {
    expect(taskToCalendarItem(task())).toMatchObject({ id: "task:task-1", sourceType: "task", allDay: true, start: "2026-09-14", isEditable: false });
    expect(taskToCalendarItem(task({ due_date: null, due_at: "2026-09-14T18:00:00Z" }))).toMatchObject({ allDay: false, start: "2026-09-14T18:00:00Z" });
  });

  it("excludes no-date, completed, and archived tasks", () => {
    expect(taskToCalendarItem(task({ due_date: null }))).toBeNull();
    expect(taskToCalendarItem(task({ status: "completed", completed_at: "2026-09-10T00:00:00Z" }))).toBeNull();
    expect(taskToCalendarItem(task({ archived_at: "2026-09-10T00:00:00Z" }))).toBeNull();
  });

  it("includes priority, status, and optional School context", () => {
    const item = taskToCalendarItem(task({ assessment_id: "a1", assessment: { id: "a1", name: "Essay", courseId: "c1", courseCode: "ENG101" } }))!;
    expect(item).toMatchObject({ type: "high priority task", sourceUrl: "/tasks?task=task-1#task-task-1", metadata: { priority: "high", status: "todo", assessmentId: "a1" } });
    expect(item.description).toContain("ENG101");
  });

  it("combines Native, School, and Tasks in the shared source-aware collection", () => {
    const native = nativeEventToCalendarItem({ id: "n", title: "Appointment", eventType: null, allDay: true, startsAt: null, endsAt: null, startDate: "2026-09-14", endDate: "2026-09-14", description: null, location: null, archivedAt: null, recurrenceFrequency: null, recurrenceUntil: null, recurrenceTimezone: null, reminderOffsets: [] });
    const meeting = projectCourseMeetings({ id: "m", courseId: "c", courseCode: "CSC101", courseName: "Computing", meetingType: "lecture", weekday: 1, startTime: "09:00", endTime: "10:00", timezone: "America/Toronto", location: null, effectiveStart: "2026-09-01", effectiveEnd: "2026-12-01", active: true, colorKey: "plum" }, { start: "2026-09-14", end: "2026-09-14" });
    const items = combineCalendarItems([native, ...meeting, taskToCalendarItem(task())!], { start: "2026-09-14", end: "2026-09-14" }, "America/Toronto");
    expect(items.map((item) => item.sourceType)).toEqual(["native", "task", "course_meeting"]);
  });
});
