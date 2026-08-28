import "server-only";

import type { Database } from "@/types/database";
import type { ServiceResult } from "@/features/shared/service-result";
import { serviceFailure, serviceSuccess } from "@/features/shared/service-result";
import type { AuthenticatedAppContext } from "@/features/shared/server-context";
import { instantToLocalInput, zonedLocalDateTimeToUtc } from "@/features/calendar/dates";
import { assessmentPercentage, exactToString, parseExact } from "./grades";
import { assessmentSchema } from "./schemas";

type AssessmentRow = Pick<Database["public"]["Tables"]["assessments"]["Row"], "id" | "course_id" | "name" | "assessment_type" | "timing_type" | "due_at" | "starts_at" | "ends_at" | "event_date" | "weight_percent" | "score_earned" | "score_max" | "estimated_effort_minutes" | "status" | "location" | "notes" | "archived_at" | "updated_at">;
type AssessmentInsert = Database["public"]["Tables"]["assessments"]["Insert"];
type AssessmentValues = Omit<AssessmentInsert, "id" | "user_id" | "created_at" | "updated_at" | "archived_at">;
export type AssessmentMutationResult = { id: string; title: string; courseId: string; courseCode: string; status: string; scoreEarned: string | null; scoreMax: string | null; timingType: string; dueAt: string | null; startsAt: string | null; endsAt: string | null; eventDate: string | null; updated_at: string };

const rowSelection = "id,course_id,name,assessment_type,timing_type,due_at,starts_at,ends_at,event_date,weight_percent,score_earned,score_max,estimated_effort_minutes,status,location,notes,archived_at,updated_at" as const;
const databaseDecimal = (value: string) => exactToString(parseExact(value)) as unknown as number;
const effortMinutes = (hours: string) => hours ? Number((parseExact(hours) * 60n + 5_000n) / 10_000n) : null;

export function validateAssessmentMutation(input: unknown, timeZone: string): ServiceResult<{ values: AssessmentValues }> {
  const parsed = assessmentSchema.safeParse(input);
  if (!parsed.success) return serviceFailure("validation", parsed.error.issues[0]?.message ?? "Check the assessment details.");
  const data = parsed.data;
  try {
    return serviceSuccess({ values: { course_id: data.courseId, name: data.name, assessment_type: data.assessmentType, timing_type: data.timingType, due_at: data.timingType === "deadline" ? zonedLocalDateTimeToUtc(data.dueLocal, timeZone) : null, starts_at: data.timingType === "scheduled" ? zonedLocalDateTimeToUtc(data.startsLocal, timeZone) : null, ends_at: data.timingType === "scheduled" ? zonedLocalDateTimeToUtc(data.endsLocal, timeZone) : null, event_date: data.timingType === "all_day" ? data.eventDate : null, weight_percent: databaseDecimal(data.weight), score_earned: data.scoreEarned ? databaseDecimal(data.scoreEarned) : null, score_max: data.scoreMax ? databaseDecimal(data.scoreMax) : null, estimated_effort_minutes: effortMinutes(data.effortHours), status: data.status, location: data.location, notes: data.notes } });
  } catch (error) { return serviceFailure("validation", error instanceof Error ? error.message : "Check the assessment details."); }
}

async function ownedCourse(courseId: string, context: AuthenticatedAppContext) {
  return context.supabase.from("courses").select("id,code,archived_at").eq("id", courseId).eq("user_id", context.user.id).maybeSingle();
}

export async function getOwnedAssessmentForMutation(id: string, context: AuthenticatedAppContext): Promise<ServiceResult<{ assessment: AssessmentRow; course: { id: string; code: string; archived_at: string | null } }>> {
  const assessment = await context.supabase.from("assessments").select(rowSelection).eq("id", id).eq("user_id", context.user.id).is("archived_at", null).maybeSingle();
  if (assessment.error) return serviceFailure("unexpected", "The assessment could not be checked.");
  if (!assessment.data) return serviceFailure("not_found", "The assessment is unavailable.");
  const course = await ownedCourse(assessment.data.course_id, context);
  if (course.error) return serviceFailure("unexpected", "The assessment course could not be checked.");
  if (!course.data || course.data.archived_at) return serviceFailure("not_found", "The assessment is unavailable.");
  return serviceSuccess({ assessment: assessment.data, course: course.data });
}

export function assessmentInputFromRecord(row: AssessmentRow, timeZone: string) {
  const hours = row.estimated_effort_minutes === null ? "" : exactToString((BigInt(row.estimated_effort_minutes) * 10_000n) / 60n).replace(/\.?0+$/, "");
  return { courseId: row.course_id, name: row.name, assessmentType: row.assessment_type, timingType: row.timing_type, dueLocal: row.due_at ? instantToLocalInput(row.due_at, timeZone) : "", startsLocal: row.starts_at ? instantToLocalInput(row.starts_at, timeZone) : "", endsLocal: row.ends_at ? instantToLocalInput(row.ends_at, timeZone) : "", eventDate: row.event_date ?? "", weight: exactToString(parseExact(String(row.weight_percent))), scoreEarned: row.score_earned === null ? "" : exactToString(parseExact(String(row.score_earned))), scoreMax: row.score_max === null ? "" : exactToString(parseExact(String(row.score_max))), effortHours: hours, status: row.status, location: row.location ?? "", notes: row.notes ?? "" };
}

async function assessmentResult(row: AssessmentRow, context: AuthenticatedAppContext): Promise<ServiceResult<AssessmentMutationResult>> {
  const course = await ownedCourse(row.course_id, context);
  if (course.error || !course.data) return serviceFailure("unexpected", "The assessment course could not be loaded.");
  const decimal = (value: number | null) => value === null ? null : exactToString(parseExact(String(value)));
  return serviceSuccess({ id: row.id, title: row.name, courseId: row.course_id, courseCode: course.data.code, status: row.status, scoreEarned: decimal(row.score_earned), scoreMax: decimal(row.score_max), timingType: row.timing_type, dueAt: row.due_at, startsAt: row.starts_at, endsAt: row.ends_at, eventDate: row.event_date, updated_at: row.updated_at });
}

export async function createAssessment(input: unknown, context: AuthenticatedAppContext): Promise<ServiceResult<AssessmentMutationResult>> {
  const parsed = validateAssessmentMutation(input, context.timeZone); if (!parsed.ok) return parsed;
  const course = await ownedCourse(parsed.data.values.course_id, context);
  if (course.error || !course.data || course.data.archived_at) return serviceFailure("not_found", "The assessment course is unavailable.");
  const result = await context.supabase.from("assessments").insert({ user_id: context.user.id, ...parsed.data.values }).select(rowSelection).single();
  return result.error ? serviceFailure("unexpected", "The assessment could not be created.") : assessmentResult(result.data, context);
}

export async function updateAssessment(id: string, input: unknown, context: AuthenticatedAppContext, expectedUpdatedAt?: string): Promise<ServiceResult<AssessmentMutationResult>> {
  const existing = await context.supabase.from("assessments").select(rowSelection).eq("id", id).eq("user_id", context.user.id).maybeSingle();
  if (existing.error) return serviceFailure("unexpected", "The assessment could not be checked.");
  if (!existing.data || (expectedUpdatedAt && existing.data.archived_at)) return serviceFailure("not_found", "The assessment is unavailable.");
  if (expectedUpdatedAt && existing.data.updated_at !== expectedUpdatedAt) return serviceFailure("conflict", "The assessment changed after this proposal. Please review it again.");
  const parsed = validateAssessmentMutation(input, context.timeZone); if (!parsed.ok) return parsed;
  if (parsed.data.values.course_id !== existing.data.course_id) return serviceFailure("validation", "Assistant assessment updates cannot change courses.");
  let query = context.supabase.from("assessments").update(parsed.data.values).eq("id", id).eq("user_id", context.user.id);
  if (expectedUpdatedAt) query = query.is("archived_at", null).eq("updated_at", expectedUpdatedAt);
  const result = await query.select(rowSelection).maybeSingle();
  if (result.error) return serviceFailure("unexpected", "The assessment could not be updated.");
  if (!result.data) return serviceFailure(expectedUpdatedAt ? "conflict" : "not_found", expectedUpdatedAt ? "The assessment changed after this proposal. Please review it again." : "The assessment is unavailable.");
  return assessmentResult(result.data, context);
}

export function normalizeScoreInput(input: { mode: "raw" | "percentage"; earned: string | null; maximum: string | null; percentage: string | null }): ServiceResult<{ earned: string; maximum: string; equivalent: string }> {
  try {
    const earned = input.mode === "percentage" ? input.percentage ?? "" : input.earned ?? "";
    const maximum = input.mode === "percentage" ? "100" : input.maximum ?? "";
    if (!earned || !maximum) return serviceFailure("validation", input.mode === "percentage" ? "An exact percentage is required." : "Both earned and maximum scores are required.");
    const earnedExact = parseExact(earned); const maximumExact = parseExact(maximum);
    if (earnedExact < 0n || maximumExact <= 0n || earnedExact > maximumExact) return serviceFailure("validation", "The score must be between zero and its maximum.");
    const normalizedEarned = exactToString(earnedExact); const normalizedMaximum = exactToString(maximumExact);
    const equivalent = exactToString(assessmentPercentage({ id: "preview", name: "Preview", weight: "1", scoreEarned: normalizedEarned, scoreMax: normalizedMaximum, status: "graded" })!);
    return serviceSuccess({ earned: normalizedEarned, maximum: normalizedMaximum, equivalent });
  } catch (error) { return serviceFailure("validation", error instanceof Error ? error.message : "The score is invalid."); }
}

export async function setAssessmentScore(id: string, score: { mode: "raw" | "percentage"; earned: string | null; maximum: string | null; percentage: string | null }, context: AuthenticatedAppContext, expectedUpdatedAt: string): Promise<ServiceResult<AssessmentMutationResult>> {
  const normalized = normalizeScoreInput(score); if (!normalized.ok) return normalized;
  const current = await getOwnedAssessmentForMutation(id, context); if (!current.ok) return current;
  const input = { ...assessmentInputFromRecord(current.data.assessment, context.timeZone), scoreEarned: normalized.data.earned, scoreMax: normalized.data.maximum, status: "graded" };
  return updateAssessment(id, input, context, expectedUpdatedAt);
}

export async function clearAssessmentScore(id: string, context: AuthenticatedAppContext, expectedUpdatedAt: string): Promise<ServiceResult<AssessmentMutationResult>> {
  const current = await getOwnedAssessmentForMutation(id, context); if (!current.ok) return current;
  if (current.data.assessment.score_earned === null) return serviceFailure("conflict", "This assessment does not have a recorded score.");
  const input = { ...assessmentInputFromRecord(current.data.assessment, context.timeZone), scoreEarned: "", scoreMax: "", status: current.data.assessment.status === "graded" ? "upcoming" : current.data.assessment.status };
  return updateAssessment(id, input, context, expectedUpdatedAt);
}

export async function setAssessmentStatus(id: string, status: unknown, context: AuthenticatedAppContext, expectedUpdatedAt: string): Promise<ServiceResult<AssessmentMutationResult>> {
  if (!["upcoming", "submitted", "missed", "exempt"].includes(String(status))) return serviceFailure("validation", "Choose Upcoming, Submitted, Missed, or Exempt.");
  const current = await getOwnedAssessmentForMutation(id, context); if (!current.ok) return current;
  if (current.data.assessment.status === status) return serviceFailure("conflict", `The assessment is already ${status}.`);
  if (current.data.assessment.score_earned !== null && (status === "upcoming" || status === "submitted")) return serviceFailure("validation", "Clear the recorded score before changing this assessment to Upcoming or Submitted.");
  const input = { ...assessmentInputFromRecord(current.data.assessment, context.timeZone), status: String(status), ...((status === "missed" || status === "exempt") ? { scoreEarned: "", scoreMax: "" } : {}) };
  return updateAssessment(id, input, context, expectedUpdatedAt);
}
