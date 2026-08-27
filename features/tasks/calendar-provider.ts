import "server-only";

import type { CalendarProviderContext, CalendarSourceProvider } from "../calendar/provider";
import { addCalendarDays, type DateRange } from "../shared/date-ranges";
import { zonedLocalDateTimeToUtc } from "../calendar/dates";
import { taskToCalendarItem } from "./projection";
import type { TaskWithContext } from "./types";

export async function getTaskCalendarItems(range: DateRange, context: CalendarProviderContext) {
  const supabase = context.supabase;
  const timezone = context.timeZone;
  const startInstant = zonedLocalDateTimeToUtc(`${range.start}T00:00`, timezone);
  const endInstant = zonedLocalDateTimeToUtc(`${addCalendarDays(range.end, 1)}T00:00`, timezone);
  const [dateResult, timedResult] = await Promise.all([
    supabase.from("tasks").select("*").is("archived_at", null).neq("status", "completed").gte("due_date", range.start).lte("due_date", range.end),
    supabase.from("tasks").select("*").is("archived_at", null).neq("status", "completed").gte("due_at", startInstant).lt("due_at", endInstant),
  ]);
  const error = dateResult.error ?? timedResult.error;
  if (error) throw new Error(`Unable to load Task Calendar: ${error.message}`);
  const rows = [...(dateResult.data ?? []), ...(timedResult.data ?? [])];
  const assessmentIds = rows.flatMap((task) => task.assessment_id ? [task.assessment_id] : []);
  const goalIds = rows.flatMap((task) => task.goal_id ? [task.goal_id] : []);
  const assessmentResult = assessmentIds.length ? await supabase.from("assessments").select("id,name,course_id").in("id", assessmentIds) : { data: [], error: null };
  if (assessmentResult.error) throw new Error(`Unable to load Task assessment context: ${assessmentResult.error.message}`);
  const courseIds = [...new Set((assessmentResult.data ?? []).map((assessment) => assessment.course_id))];
  const courseResult = courseIds.length ? await supabase.from("courses").select("id,code").in("id", courseIds) : { data: [], error: null };
  if (courseResult.error) throw new Error(`Unable to load Task course context: ${courseResult.error.message}`);
  const goalResult = goalIds.length ? await supabase.from("goals").select("id,title").in("id", goalIds) : { data: [], error: null };
  if (goalResult.error) throw new Error(`Unable to load Task goal context: ${goalResult.error.message}`);
  const courses = new Map((courseResult.data ?? []).map((course) => [course.id, course]));
  const assessments = new Map((assessmentResult.data ?? []).map((assessment) => [assessment.id, assessment]));
  const goals = new Map((goalResult.data ?? []).map((goal) => [goal.id, goal]));
  return rows.flatMap((task) => {
    const assessment = task.assessment_id ? assessments.get(task.assessment_id) : null;
    const course = assessment ? courses.get(assessment.course_id) : null;
    const goal = task.goal_id ? goals.get(task.goal_id) : null;
    const contextual: TaskWithContext = { ...task, assessment: assessment && course ? { id: assessment.id, name: assessment.name, courseId: course.id, courseCode: course.code } : null, goal: goal ? { id: goal.id, title: goal.title } : null };
    const item = taskToCalendarItem(contextual);
    return item ? [item] : [];
  });
}

export const taskCalendarProvider: CalendarSourceProvider = { id: "tasks", getItems: getTaskCalendarItems };
