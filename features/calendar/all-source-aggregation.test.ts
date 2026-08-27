import { describe, expect, it } from "vitest";

import { goalToCalendarItem } from "../goals/projection";
import type { GoalRecord } from "../goals/types";
import { projectCourseMeetings } from "../school/meeting-projection";
import { taskToCalendarItem } from "../tasks/projection";
import type { TaskWithContext } from "../tasks/types";
import { combineCalendarItems, financeEntryToCalendarItem, nativeEventToCalendarItem } from "./projection";

describe("all-source Calendar aggregation", () => {
  it("normalizes and deterministically orders Native + Finance + School + Tasks + Goals in one bounded range", () => {
    const range = { start: "2026-09-14", end: "2026-09-14" };
    const native = nativeEventToCalendarItem({ id: "native-1", title: "Appointment", eventType: null, allDay: true, startsAt: null, endsAt: null, startDate: range.start, endDate: range.end, description: null, location: null, archivedAt: null, recurrenceFrequency: null, recurrenceUntil: null, recurrenceTimezone: null, reminderOffsets: [] });
    const finance = financeEntryToCalendarItem({ occurrenceId: "bill:bill-1:2026-09-14", sourceId: "bill-1", sourceType: "recurring_bill", type: "bill", name: "Internet", amount: -500000n, currency: "CAD", date: range.start, accountId: null }, null);
    const school = projectCourseMeetings({ id: "meeting-1", courseId: "course-1", courseCode: "CSC101", courseName: "Computing", meetingType: "lecture", weekday: 1, startTime: "09:00", endTime: "10:00", timezone: "America/Toronto", location: null, effectiveStart: "2026-09-01", effectiveEnd: "2026-12-01", active: true, colorKey: "plum" }, range);
    const task: TaskWithContext = { id: "task-1", title: "Submit work", description: null, status: "todo", priority: "high", due_date: range.start, due_at: null, estimated_effort_minutes: 30, assessment_id: null, goal_id: null, completed_at: null, archived_at: null, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z", assessment: null, goal: null };
    const goal: GoalRecord = { id: "goal-1", title: "Launch portfolio", description: null, category: "career", status: "active", deadline: range.start, progress_mode: "none", current_value_decimal: null, target_value_decimal: null, unit_label: null, completed_at: null, archived_at: null, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z" };
    const items = combineCalendarItems([native, finance, ...school, taskToCalendarItem(task)!, goalToCalendarItem(goal)!], range, "America/Toronto");

    expect(new Set(items.map((item) => item.sourceType))).toEqual(new Set(["native", "bill", "course_meeting", "task", "goal"]));
    expect(items.map((item) => item.id)).toEqual(["native:native-1", "bill:bill-1:2026-09-14", "goal:goal-1", "task:task-1", "course_meeting:meeting-1:2026-09-14"]);
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
  });
});
