import "server-only";

import { zonedLocalDateTimeToUtc } from "@/features/calendar/dates";
import type { CalendarProviderContext, CalendarSourceProvider } from "@/features/calendar/provider";
import type { CalendarItem } from "@/features/calendar/types";
import { addCalendarDays, type DateRange } from "@/features/shared/date-ranges";

import { projectCourseMeetings } from "./meeting-projection";

export async function getSchoolCalendarItems(range: DateRange, context: CalendarProviderContext) {
  const start = zonedLocalDateTimeToUtc(`${range.start}T00:00`, context.timeZone);
  const end = zonedLocalDateTimeToUtc(`${addCalendarDays(range.end, 1)}T00:00`, context.timeZone);
  const [termResult, courseResult, meetingResult, deadlineResult, scheduledResult, allDayResult] = await Promise.all([
    context.supabase.from("academic_terms").select("id").is("archived_at", null),
    context.supabase.from("courses").select("id,term_id,code,name,color_key").is("archived_at", null),
    context.supabase.from("course_meetings").select("*").eq("is_active", true).lte("effective_start_date", range.end).gte("effective_end_date", range.start),
    context.supabase.from("assessments").select("*").is("archived_at", null).eq("timing_type", "deadline").gte("due_at", start).lt("due_at", end),
    context.supabase.from("assessments").select("*").is("archived_at", null).eq("timing_type", "scheduled").lt("starts_at", end).gt("ends_at", start),
    context.supabase.from("assessments").select("*").is("archived_at", null).eq("timing_type", "all_day").gte("event_date", range.start).lte("event_date", range.end),
  ]);
  const error = termResult.error ?? courseResult.error ?? meetingResult.error ?? deadlineResult.error ?? scheduledResult.error ?? allDayResult.error;
  if (error) throw new Error(`Unable to load School Calendar items: ${error.message}`);
  const termIds = new Set((termResult.data ?? []).map((term) => term.id));
  const courses = new Map((courseResult.data ?? []).filter((course) => termIds.has(course.term_id)).map((course) => [course.id, course]));
  const meetings = (meetingResult.data ?? []).flatMap((meeting) => {
    const course = courses.get(meeting.course_id);
    return course ? projectCourseMeetings({ id: meeting.id, courseId: course.id, courseCode: course.code, courseName: course.name, meetingType: meeting.meeting_type, weekday: meeting.weekday, startTime: meeting.start_time, endTime: meeting.end_time, timezone: meeting.timezone, location: meeting.location, effectiveStart: meeting.effective_start_date, effectiveEnd: meeting.effective_end_date, active: meeting.is_active, colorKey: course.color_key }, range) : [];
  });
  const assessments = [...(deadlineResult.data ?? []), ...(scheduledResult.data ?? []), ...(allDayResult.data ?? [])].flatMap((assessment) => {
    const course = courses.get(assessment.course_id);
    return course ? [assessmentToCalendarItem(assessment, course)] : [];
  });
  return [...meetings, ...assessments];
}

function assessmentToCalendarItem(assessment: { id: string; name: string; assessment_type: string; timing_type: string; due_at: string | null; starts_at: string | null; ends_at: string | null; event_date: string | null; weight_percent: number; status: string; location: string | null; notes: string | null }, course: { id: string; code: string; color_key: string }): CalendarItem {
  const allDay = assessment.timing_type === "all_day";
  const start = allDay ? assessment.event_date! : assessment.timing_type === "deadline" ? assessment.due_at! : assessment.starts_at!;
  return { id: `assessment:${assessment.id}`, sourceType: "assessment", sourceId: assessment.id, title: `${course.code} · ${assessment.name}`, start, end: allDay ? assessment.event_date : assessment.timing_type === "scheduled" ? assessment.ends_at : assessment.due_at, allDay, category: "School", type: assessment.assessment_type.replaceAll("_", " "), description: `${assessment.weight_percent}% · ${assessment.status}${assessment.notes ? ` · ${assessment.notes}` : ""}`, location: assessment.location, amount: null, currency: null, isEditable: false, sourceUrl: `/school/courses/${course.id}#assessment-${assessment.id}`, recurrence: null, reminderOffsets: [], metadata: { courseCode: course.code, colorKey: course.color_key, assessmentStatus: assessment.status, academic: true } };
}

export const schoolCalendarProvider: CalendarSourceProvider = { id: "school", getItems: getSchoolCalendarItems };
