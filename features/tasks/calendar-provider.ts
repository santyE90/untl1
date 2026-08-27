import "server-only";

import { requireAuthenticatedUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { addCalendarDays } from "../finance/date-ranges";
import { zonedLocalDateTimeToUtc } from "../calendar/dates";
import { taskToCalendarItem } from "./projection";
import type { TaskWithContext } from "./types";

export async function getTaskCalendarItems(range: { start: string; end: string }) {
  const user = await requireAuthenticatedUser();
  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase.from("profiles").select("timezone").eq("id", user.id).single();
  if (profileError) throw new Error(`Unable to load Task Calendar timezone: ${profileError.message}`);
  const timezone = profile.timezone;
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
  const assessmentResult = assessmentIds.length ? await supabase.from("assessments").select("id,name,course_id").in("id", assessmentIds) : { data: [], error: null };
  if (assessmentResult.error) throw new Error(`Unable to load Task assessment context: ${assessmentResult.error.message}`);
  const courseIds = [...new Set((assessmentResult.data ?? []).map((assessment) => assessment.course_id))];
  const courseResult = courseIds.length ? await supabase.from("courses").select("id,code").in("id", courseIds) : { data: [], error: null };
  if (courseResult.error) throw new Error(`Unable to load Task course context: ${courseResult.error.message}`);
  const courses = new Map((courseResult.data ?? []).map((course) => [course.id, course]));
  const assessments = new Map((assessmentResult.data ?? []).map((assessment) => [assessment.id, assessment]));
  return rows.flatMap((task) => {
    const assessment = task.assessment_id ? assessments.get(task.assessment_id) : null;
    const course = assessment ? courses.get(assessment.course_id) : null;
    const contextual: TaskWithContext = { ...task, assessment: assessment && course ? { id: assessment.id, name: assessment.name, courseId: course.id, courseCode: course.code } : null };
    const item = taskToCalendarItem(contextual);
    return item ? [item] : [];
  });
}
