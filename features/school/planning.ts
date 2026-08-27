import { dateForInstant } from "../calendar/dates";
import { addCalendarDays } from "../shared/date-ranges";
import { parseExact } from "./grades";

export type PlanningAssessment = {
  id: string;
  course_id: string;
  name: string;
  assessment_type: string;
  timing_type: string;
  due_at: string | null;
  starts_at: string | null;
  event_date: string | null;
  weight_percent: number;
  status: string;
  location: string | null;
  estimated_effort_minutes: number | null;
  archived_at?: string | null;
};

export function assessmentLocalDate(assessment: Pick<PlanningAssessment, "timing_type" | "due_at" | "starts_at" | "event_date">, timezone: string) {
  if (assessment.timing_type === "all_day") return assessment.event_date!;
  return dateForInstant(assessment.timing_type === "deadline" ? assessment.due_at! : assessment.starts_at!, timezone);
}

export function calendarDayDifference(from: string, to: string) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

export function daysUntilLabel(today: string, date: string, noun = "Due") {
  const days = calendarDayDifference(today, date);
  if (days === 0) return `${noun} today`;
  if (days === 1) return `${noun} tomorrow`;
  if (days > 1) return `${noun} in ${days} days`;
  return `${noun} ${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} ago`;
}

export function isOpenAssessment(assessment: Pick<PlanningAssessment, "status" | "archived_at">) {
  return !assessment.archived_at && assessment.status === "upcoming";
}

export function filterUpcomingAssessments(assessments: PlanningAssessment[], range: { start: string; end: string }, timezone: string) {
  return assessments.filter((assessment) => {
    if (!isOpenAssessment(assessment)) return false;
    const date = assessmentLocalDate(assessment, timezone);
    return date >= range.start && date <= range.end;
  }).sort((a, b) => assessmentLocalDate(a, timezone).localeCompare(assessmentLocalDate(b, timezone)) || a.name.localeCompare(b.name));
}

const MAJOR_TYPES = new Set(["midterm", "final_exam", "project", "presentation"]);
export function getMajorAssessments(assessments: PlanningAssessment[], range: { start: string; end: string }, timezone: string) {
  return filterUpcomingAssessments(assessments, range, timezone).filter((assessment) => MAJOR_TYPES.has(assessment.assessment_type));
}

export function summarizeWorkload(assessments: PlanningAssessment[]) {
  const combinedWeight = assessments.reduce((sum, assessment) => sum + parseExact(String(assessment.weight_percent)), 0n);
  const estimates = assessments.filter((assessment) => assessment.estimated_effort_minutes !== null);
  return { assessmentCount: assessments.length, combinedWeight, estimatedMinutes: estimates.reduce((sum, assessment) => sum + assessment.estimated_effort_minutes!, 0), estimatedCount: estimates.length };
}

export function planningRanges(today: string, termEnd: string | null) {
  return {
    seven: { start: today, end: addCalendarDays(today, 6) },
    fourteen: { start: today, end: addCalendarDays(today, 13) },
    thirty: { start: today, end: addCalendarDays(today, 29) },
    term: { start: today, end: termEnd && termEnd >= today ? termEnd : addCalendarDays(today, 89) },
  };
}

export function calculateTermProgress(term: { start_date: string; end_date: string }, today: string) {
  const totalDays = Math.max(1, calendarDayDifference(term.start_date, term.end_date) + 1);
  const elapsedDays = today < term.start_date ? 0 : today > term.end_date ? totalDays : calendarDayDifference(term.start_date, today) + 1;
  return { totalDays, elapsedDays, remainingDays: totalDays - elapsedDays, percentElapsed: Math.round((elapsedDays / totalDays) * 100) };
}

export function groupMeetingPatterns<T extends { id: string; meeting_type: string; start_time: string; end_time: string; location: string | null; effective_start_date: string; effective_end_date: string; is_active: boolean; weekday: number }>(meetings: T[]) {
  const groups = new Map<string, { meetingType: string; startTime: string; endTime: string; location: string | null; effectiveStart: string; effectiveEnd: string; active: boolean; weekdays: number[]; ids: string[] }>();
  for (const meeting of meetings) {
    const key = [meeting.meeting_type, meeting.start_time, meeting.end_time, meeting.location ?? "", meeting.effective_start_date, meeting.effective_end_date, meeting.is_active].join("|");
    const group = groups.get(key) ?? { meetingType: meeting.meeting_type, startTime: meeting.start_time, endTime: meeting.end_time, location: meeting.location, effectiveStart: meeting.effective_start_date, effectiveEnd: meeting.effective_end_date, active: meeting.is_active, weekdays: [], ids: [] };
    group.weekdays.push(meeting.weekday);
    group.ids.push(meeting.id);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({ ...group, weekdays: group.weekdays.sort((a, b) => a - b) }));
}
