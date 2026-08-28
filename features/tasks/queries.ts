import "server-only";

import { getSchoolOverview } from "../school/queries";
import { getAuthenticatedAppContext, type AuthenticatedAppContext } from "../shared/server-context";
import { filterTasks, summarizeTasks } from "./task-service";
import type { TaskWithContext } from "./types";

type SchoolOverview = Awaited<ReturnType<typeof getSchoolOverview>>;

export async function getTasks(options: { context?: AuthenticatedAppContext; school?: SchoolOverview } = {}) {
  const context = options.context ?? await getAuthenticatedAppContext();
  const supabase = context.supabase;
  const [taskResult, goalResult, school] = await Promise.all([
    supabase.from("tasks").select("*"),
    supabase.from("goals").select("id,title,status").is("archived_at", null).order("title"),
    options.school ?? getSchoolOverview(context),
  ]);
  const error = taskResult.error ?? goalResult.error;
  if (error) throw new Error(`Unable to load Tasks: ${error.message}`);
  const timezone = context.timeZone;
  const courses = new Map(school.courses.map((course) => [course.id, course]));
  const assessments = new Map(school.assessments.map((assessment) => [assessment.id, assessment]));
  const goals = new Map((goalResult.data ?? []).map((goal) => [goal.id, goal]));
  const tasks: TaskWithContext[] = (taskResult.data ?? []).map((task) => {
    const assessment = task.assessment_id ? assessments.get(task.assessment_id) : null;
    const course = assessment ? courses.get(assessment.course_id) : null;
    const goal = task.goal_id ? goals.get(task.goal_id) : null;
    return { ...task, assessment: assessment && course ? { id: assessment.id, name: assessment.name, courseId: course.id, courseCode: course.code } : null, goal: goal ? { id: goal.id, title: goal.title } : null };
  });
  return { tasks: tasks.filter((task) => !task.archived_at), archivedTasks: tasks.filter((task) => task.archived_at), timezone, today: context.today, goalOptions: goalResult.data ?? [], assessmentOptions: school.assessments.map((assessment) => ({ id: assessment.id, name: assessment.name, timingType: assessment.timing_type, dueAt: assessment.due_at, startsAt: assessment.starts_at, eventDate: assessment.event_date, course: courses.get(assessment.course_id) })).filter((option) => option.course) };
}

export async function getTaskSummary(options: { context?: AuthenticatedAppContext; school?: SchoolOverview } = {}) {
  const data = await getTasks(options);
  return { ...data, summary: summarizeTasks(data.tasks, data.today, data.timezone), dueToday: filterTasks(data.tasks, "today", data.today, data.timezone), overdue: filterTasks(data.tasks, "overdue", data.today, data.timezone), upcoming: filterTasks(data.tasks, "upcoming", data.today, data.timezone) };
}

export async function getTasksDueToday() { const data = await getTasks(); return filterTasks(data.tasks, "today", data.today, data.timezone); }
export async function getOverdueTasks() { const data = await getTasks(); return filterTasks(data.tasks, "overdue", data.today, data.timezone); }
export async function getUpcomingTasks() { const data = await getTasks(); return filterTasks(data.tasks, "upcoming", data.today, data.timezone); }
export async function getCompletedTasks() { const data = await getTasks(); return filterTasks(data.tasks, "completed", data.today, data.timezone); }
