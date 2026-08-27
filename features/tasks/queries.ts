import "server-only";

import { requireAuthenticatedUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { currentDateInTimeZone } from "../finance/date-ranges";
import { getSchoolOverview } from "../school/queries";
import { filterTasks, summarizeTasks } from "./task-service";
import type { TaskWithContext } from "./types";

export async function getTasks() {
  const user = await requireAuthenticatedUser();
  const supabase = await createClient();
  const [profileResult, taskResult, goalResult, school] = await Promise.all([
    supabase.from("profiles").select("timezone").eq("id", user.id).single(),
    supabase.from("tasks").select("*").is("archived_at", null),
    supabase.from("goals").select("id,title,status").is("archived_at", null).order("title"),
    getSchoolOverview(),
  ]);
  const error = profileResult.error ?? taskResult.error ?? goalResult.error;
  if (error) throw new Error(`Unable to load Tasks: ${error.message}`);
  const timezone = profileResult.data?.timezone ?? "America/Toronto";
  const courses = new Map(school.courses.map((course) => [course.id, course]));
  const assessments = new Map(school.assessments.map((assessment) => [assessment.id, assessment]));
  const goals = new Map((goalResult.data ?? []).map((goal) => [goal.id, goal]));
  const tasks: TaskWithContext[] = (taskResult.data ?? []).map((task) => {
    const assessment = task.assessment_id ? assessments.get(task.assessment_id) : null;
    const course = assessment ? courses.get(assessment.course_id) : null;
    const goal = task.goal_id ? goals.get(task.goal_id) : null;
    return { ...task, assessment: assessment && course ? { id: assessment.id, name: assessment.name, courseId: course.id, courseCode: course.code } : null, goal: goal ? { id: goal.id, title: goal.title } : null };
  });
  return { tasks, timezone, today: currentDateInTimeZone(timezone), goalOptions: goalResult.data ?? [], assessmentOptions: school.assessments.map((assessment) => ({ id: assessment.id, name: assessment.name, timingType: assessment.timing_type, dueAt: assessment.due_at, startsAt: assessment.starts_at, eventDate: assessment.event_date, course: courses.get(assessment.course_id) })).filter((option) => option.course) };
}

export async function getTaskSummary() {
  const data = await getTasks();
  return { ...data, summary: summarizeTasks(data.tasks, data.today, data.timezone), dueToday: filterTasks(data.tasks, "today", data.today, data.timezone), overdue: filterTasks(data.tasks, "overdue", data.today, data.timezone), upcoming: filterTasks(data.tasks, "upcoming", data.today, data.timezone) };
}

export async function getTasksDueToday() { const data = await getTasks(); return filterTasks(data.tasks, "today", data.today, data.timezone); }
export async function getOverdueTasks() { const data = await getTasks(); return filterTasks(data.tasks, "overdue", data.today, data.timezone); }
export async function getUpcomingTasks() { const data = await getTasks(); return filterTasks(data.tasks, "upcoming", data.today, data.timezone); }
export async function getCompletedTasks() { const data = await getTasks(); return filterTasks(data.tasks, "completed", data.today, data.timezone); }
