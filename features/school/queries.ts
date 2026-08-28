import "server-only";

import { notFound } from "next/navigation";

import { getAuthenticatedAppContext, type AuthenticatedAppContext } from "../shared/server-context";
import { calculateCourseGrade, calculateCourseTarget, type GradeAssessment } from "./grades";
import { calculateTermProgress, filterUpcomingAssessments, getMajorAssessments, planningRanges, summarizeWorkload } from "./planning";

export function gradeRow(assessment: { id: string; name: string; weight_percent: number; score_earned: number | null; score_max: number | null; status: string }): GradeAssessment {
  return { id: assessment.id, name: assessment.name, weight: String(assessment.weight_percent), scoreEarned: assessment.score_earned === null ? null : String(assessment.score_earned), scoreMax: assessment.score_max === null ? null : String(assessment.score_max), status: assessment.status };
}

export function assessmentDate(assessment: { due_at: string | null; starts_at: string | null; event_date: string | null }) {
  return assessment.event_date ?? assessment.due_at ?? assessment.starts_at ?? "9999";
}

export async function getSchoolOverview(suppliedContext?: AuthenticatedAppContext) {
  const context = suppliedContext ?? await getAuthenticatedAppContext();
  const supabase = context.supabase;
  const [termResult, courseResult, assessmentResult] = await Promise.all([
    supabase.from("academic_terms").select("*").is("archived_at", null).order("start_date", { ascending: false }),
    supabase.from("courses").select("*").is("archived_at", null).order("code"),
    supabase.from("assessments").select("*").is("archived_at", null),
  ]);
  const error = termResult.error ?? courseResult.error ?? assessmentResult.error;
  if (error) throw new Error(error.message);

  const terms = termResult.data ?? [];
  const termIds = new Set(terms.map((term) => term.id));
  const activeCourses = (courseResult.data ?? []).filter((course) => termIds.has(course.term_id));
  const courseIds = new Set(activeCourses.map((course) => course.id));
  const assessments = (assessmentResult.data ?? []).filter((assessment) => courseIds.has(assessment.course_id));
  const timezone = context.timeZone;
  return {
    today: context.today, timezone, terms,
    courses: activeCourses.map((course) => {
      const rows = assessments.filter((assessment) => assessment.course_id === course.id).map(gradeRow);
      return { ...course, grade: calculateCourseGrade(rows), target: calculateCourseTarget(rows, course.target_grade === null ? null : String(course.target_grade)) };
    }),
    assessments,
  };
}

export async function getUpcomingAssessments({ start, end, termId, context }: { start: string; end: string; termId?: string; context?: AuthenticatedAppContext }) {
  const overview = await getSchoolOverview(context);
  const courseIds = new Set(overview.courses.filter((course) => !termId || course.term_id === termId).map((course) => course.id));
  const assessments = filterUpcomingAssessments(overview.assessments.filter((assessment) => courseIds.has(assessment.course_id)), { start, end }, overview.timezone);
  const courses = new Map(overview.courses.map((course) => [course.id, course]));
  return { ...overview, assessments: assessments.map((assessment) => ({ ...assessment, course: courses.get(assessment.course_id)! })) };
}

export async function getSchoolPlanning(termId?: string, context?: AuthenticatedAppContext) {
  const overview = await getSchoolOverview(context);
  const term = overview.terms.find((candidate) => candidate.id === termId) ?? overview.terms.find((candidate) => candidate.start_date <= overview.today && candidate.end_date >= overview.today) ?? overview.terms[0] ?? null;
  const courses = term ? overview.courses.filter((course) => course.term_id === term.id) : [];
  const courseIds = new Set(courses.map((course) => course.id));
  const assessments = overview.assessments.filter((assessment) => courseIds.has(assessment.course_id));
  const ranges = planningRanges(overview.today, term?.end_date ?? null);
  const upcoming = filterUpcomingAssessments(assessments, ranges.term, overview.timezone);
  const thisWeek = filterUpcomingAssessments(assessments, ranges.seven, overview.timezone);
  const nonExempt = assessments.filter((assessment) => assessment.status !== "exempt");
  return {
    ...overview, term, courses, assessments, ranges, upcoming, thisWeek,
    major: getMajorAssessments(assessments, ranges.term, overview.timezone),
    workload: summarizeWorkload(thisWeek),
    termProgress: term ? calculateTermProgress(term, overview.today) : null,
    assessmentProgress: { completed: nonExempt.filter((assessment) => ["submitted", "graded", "missed"].includes(assessment.status)).length, remaining: nonExempt.filter((assessment) => assessment.status === "upcoming").length },
  };
}

export async function getCourseDetail(id: string) {
  const context = await getAuthenticatedAppContext();
  const base = await getSchoolOverview(context);
  const course = base.courses.find((candidate) => candidate.id === id);
  if (!course) notFound();
  const supabase = context.supabase;
  const [meetingResult, resourceResult] = await Promise.all([
    supabase.from("course_meetings").select("*").eq("course_id", id).order("weekday"),
    supabase.from("course_resources").select("*").eq("course_id", id).is("archived_at", null).order("sort_order").order("created_at"),
  ]);
  const error = meetingResult.error ?? resourceResult.error;
  if (error) throw new Error(error.message);
  return { ...base, course, term: base.terms.find((term) => term.id === course.term_id), assessments: base.assessments.filter((assessment) => assessment.course_id === id).sort((a, b) => assessmentDate(a).localeCompare(assessmentDate(b))), meetings: meetingResult.data ?? [], resources: resourceResult.data ?? [] };
}

export async function getSchoolArchives() {
  const { supabase } = await getAuthenticatedAppContext();
  const [termResult, courseResult, assessmentResult, resourceResult] = await Promise.all([
    supabase.from("academic_terms").select("*").order("start_date", { ascending: false }),
    supabase.from("courses").select("*").order("code"),
    supabase.from("assessments").select("*").not("archived_at", "is", null).order("archived_at", { ascending: false }),
    supabase.from("course_resources").select("*").not("archived_at", "is", null).order("archived_at", { ascending: false }),
  ]);
  const error = termResult.error ?? courseResult.error ?? assessmentResult.error ?? resourceResult.error;
  if (error) throw new Error(error.message);
  const terms = termResult.data ?? [];
  const courses = courseResult.data ?? [];
  return { terms: terms.filter((term) => term.archived_at), courses: courses.filter((course) => course.archived_at), assessments: assessmentResult.data ?? [], resources: resourceResult.data ?? [], allTerms: new Map(terms.map((term) => [term.id, term])), allCourses: new Map(courses.map((course) => [course.id, course])) };
}
