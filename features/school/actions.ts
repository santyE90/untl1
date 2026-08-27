"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { zonedLocalDateTimeToUtc } from "../calendar/dates";
import { exactToString, parseExact } from "./grades";
import { assessmentSchema, courseSchema, meetingSchema, resourceSchema, termSchema } from "./schemas";

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");
const databaseDecimal = (value: string) => exactToString(parseExact(value)) as unknown as number;
const effortMinutes = (hours: string) => hours ? Number((parseExact(hours) * 60n + 5_000n) / 10_000n) : null;

function fail(path: string, message: string): never { redirect(`${path}?error=${encodeURIComponent(message)}`); }
function done(path: string, message: string): never {
  revalidatePath("/school", "layout");
  revalidatePath("/calendar", "layout");
  revalidatePath("/dashboard");
  redirect(`${path}?success=${encodeURIComponent(message)}`);
}

async function context() {
  const user = await requireAuthenticatedUser();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("timezone").eq("id", user.id).single();
  return { user, supabase, timezone: data?.timezone ?? "America/Toronto" };
}

export async function saveTerm(formData: FormData) {
  const id = text(formData, "id");
  const parsed = termSchema.safeParse({ name: text(formData, "name"), academicYear: text(formData, "academicYear"), startDate: text(formData, "startDate"), endDate: text(formData, "endDate") });
  if (!parsed.success) fail("/school", parsed.error.issues[0].message);
  const { user, supabase } = await context();
  const row = { name: parsed.data.name, academic_year: parsed.data.academicYear, start_date: parsed.data.startDate, end_date: parsed.data.endDate };
  const result = id ? await supabase.from("academic_terms").update(row).eq("id", id).eq("user_id", user.id) : await supabase.from("academic_terms").insert({ user_id: user.id, ...row });
  if (result.error) fail("/school", result.error.message);
  done("/school", "Term saved.");
}

export async function saveCourse(formData: FormData) {
  const id = text(formData, "id");
  const destination = id ? `/school/courses/${id}` : "/school";
  const parsed = courseSchema.safeParse({ termId: text(formData, "termId"), code: text(formData, "code"), name: text(formData, "name"), instructor: text(formData, "instructor"), section: text(formData, "section"), location: text(formData, "location"), courseUrl: text(formData, "courseUrl"), notes: text(formData, "notes"), colorKey: text(formData, "colorKey"), targetGrade: text(formData, "targetGrade") });
  if (!parsed.success) fail(destination, parsed.error.issues[0].message);
  const { user, supabase } = await context();
  const data = parsed.data;
  const row = { term_id: data.termId, code: data.code, name: data.name, instructor: data.instructor, section: data.section, location: data.location, course_url: data.courseUrl, notes: data.notes, color_key: data.colorKey, target_grade: data.targetGrade ? databaseDecimal(data.targetGrade) : null };
  const result = id ? await supabase.from("courses").update(row).eq("id", id).eq("user_id", user.id).select("id").single() : await supabase.from("courses").insert({ user_id: user.id, ...row }).select("id").single();
  if (result.error) fail(destination, result.error.message);
  done(`/school/courses/${result.data.id}`, "Course saved.");
}

export async function addMeetings(formData: FormData) {
  const courseId = text(formData, "courseId");
  const destination = `/school/courses/${courseId}`;
  const parsed = meetingSchema.safeParse({ courseId, meetingType: text(formData, "meetingType"), weekdays: formData.getAll("weekdays"), startTime: text(formData, "startTime"), endTime: text(formData, "endTime"), location: text(formData, "location"), effectiveStart: text(formData, "effectiveStart"), effectiveEnd: text(formData, "effectiveEnd") });
  if (!parsed.success) fail(destination, parsed.error.issues[0].message);
  const { user, supabase, timezone } = await context();
  const data = parsed.data;
  const { error } = await supabase.from("course_meetings").insert(data.weekdays.map((weekday) => ({ user_id: user.id, course_id: courseId, meeting_type: data.meetingType, weekday, start_time: data.startTime, end_time: data.endTime, timezone, location: data.location, effective_start_date: data.effectiveStart, effective_end_date: data.effectiveEnd })));
  if (error) fail(destination, error.message);
  done(destination, "Meeting schedule added.");
}

export async function setMeetingActive(formData: FormData) {
  const courseId = text(formData, "courseId");
  const { user, supabase } = await context();
  const { error } = await supabase.from("course_meetings").update({ is_active: text(formData, "active") === "true" }).eq("id", text(formData, "id")).eq("user_id", user.id);
  if (error) fail(`/school/courses/${courseId}`, error.message);
  done(`/school/courses/${courseId}`, "Meeting updated.");
}

export async function saveAssessment(formData: FormData) {
  const id = text(formData, "id");
  const courseId = text(formData, "courseId");
  const destination = `/school/courses/${courseId}`;
  const scoreEarned = text(formData, "scoreEarned");
  const scoreMax = text(formData, "scoreMax");
  const requestedStatus = text(formData, "status");
  const status = scoreEarned && scoreMax ? "graded" : requestedStatus === "graded" ? "upcoming" : requestedStatus;
  const parsed = assessmentSchema.safeParse({ courseId, name: text(formData, "name"), assessmentType: text(formData, "assessmentType"), timingType: text(formData, "timingType"), dueLocal: text(formData, "dueLocal"), startsLocal: text(formData, "startsLocal"), endsLocal: text(formData, "endsLocal"), eventDate: text(formData, "eventDate"), weight: text(formData, "weight"), scoreEarned: status === "missed" ? "" : scoreEarned, scoreMax: status === "missed" ? "" : scoreMax, effortHours: text(formData, "effortHours"), status, location: text(formData, "location"), notes: text(formData, "notes") });
  if (!parsed.success) fail(destination, parsed.error.issues[0].message);
  const { user, supabase, timezone } = await context();
  const data = parsed.data;
  const row = { course_id: courseId, name: data.name, assessment_type: data.assessmentType, timing_type: data.timingType, due_at: data.timingType === "deadline" ? zonedLocalDateTimeToUtc(data.dueLocal, timezone) : null, starts_at: data.timingType === "scheduled" ? zonedLocalDateTimeToUtc(data.startsLocal, timezone) : null, ends_at: data.timingType === "scheduled" ? zonedLocalDateTimeToUtc(data.endsLocal, timezone) : null, event_date: data.timingType === "all_day" ? data.eventDate : null, weight_percent: databaseDecimal(data.weight), score_earned: data.scoreEarned ? databaseDecimal(data.scoreEarned) : null, score_max: data.scoreMax ? databaseDecimal(data.scoreMax) : null, estimated_effort_minutes: effortMinutes(data.effortHours), status: data.status, location: data.location, notes: data.notes };
  const result = id ? await supabase.from("assessments").update(row).eq("id", id).eq("user_id", user.id) : await supabase.from("assessments").insert({ user_id: user.id, ...row });
  if (result.error) fail(destination, result.error.message);
  done(destination, scoreEarned && scoreMax ? "Assessment saved and marked graded." : "Assessment saved.");
}

export async function saveCourseResource(formData: FormData) {
  const id = text(formData, "id");
  const courseId = text(formData, "courseId");
  const destination = `/school/courses/${courseId}`;
  const parsed = resourceSchema.safeParse({ courseId, label: text(formData, "label"), url: text(formData, "url"), resourceType: text(formData, "resourceType"), sortOrder: text(formData, "sortOrder") || "0" });
  if (!parsed.success) fail(destination, parsed.error.issues[0].message);
  const { user, supabase } = await context();
  const data = parsed.data;
  const row = { label: data.label, url: data.url, resource_type: data.resourceType, sort_order: data.sortOrder };
  const result = id ? await supabase.from("course_resources").update(row).eq("id", id).eq("user_id", user.id).eq("course_id", courseId) : await supabase.from("course_resources").insert({ user_id: user.id, course_id: courseId, ...row });
  if (result.error) fail(destination, result.error.message);
  done(destination, "Course resource saved.");
}

export async function archiveSchoolEntity(formData: FormData) {
  const type = text(formData, "type");
  const id = text(formData, "id");
  const courseId = text(formData, "courseId");
  const { user, supabase } = await context();
  let error;
  if (type === "term") ({ error } = await supabase.from("academic_terms").update({ archived_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id));
  else if (type === "course") ({ error } = await supabase.from("courses").update({ archived_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id));
  else if (type === "resource") ({ error } = await supabase.from("course_resources").update({ archived_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id));
  else ({ error } = await supabase.from("assessments").update({ archived_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id));
  const destination = courseId ? `/school/courses/${courseId}` : "/school";
  if (error) fail(destination, error.message);
  done(destination, "Archived.");
}

export async function restoreSchoolEntity(formData: FormData) {
  const type = text(formData, "type");
  const id = text(formData, "id");
  const { user, supabase } = await context();
  let error;
  if (type === "term") ({ error } = await supabase.from("academic_terms").update({ archived_at: null }).eq("id", id).eq("user_id", user.id));
  else if (type === "course") ({ error } = await supabase.from("courses").update({ archived_at: null }).eq("id", id).eq("user_id", user.id));
  else if (type === "assessment") ({ error } = await supabase.from("assessments").update({ archived_at: null }).eq("id", id).eq("user_id", user.id));
  else fail("/school/archive", "Unknown archive type.");
  if (error) fail("/school/archive", error.message);
  done("/school/archive", "Restored.");
}
