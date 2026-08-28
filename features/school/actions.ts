"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAuthenticatedAppContext } from "../shared/server-context";
import { exactToString, parseExact } from "./grades";
import { createAssessment, updateAssessment } from "./mutations";
import { courseSchema, meetingScheduleSchema, meetingSchema, resourceSchema, termSchema } from "./schemas";

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");
const databaseDecimal = (value: string) => exactToString(parseExact(value)) as unknown as number;

function fail(path: string, message: string): never { redirect(`${path}?error=${encodeURIComponent(message)}`); }
function safeFailure(fallback: string) { return fallback; }
function done(path: string, message: string): never {
  revalidatePath("/school", "layout");
  revalidatePath("/calendar", "layout");
  revalidatePath("/dashboard");
  redirect(`${path}?success=${encodeURIComponent(message)}`);
}

async function context() {
  const app = await getAuthenticatedAppContext();
  return { ...app, timezone: app.timeZone };
}

export async function saveTerm(formData: FormData) {
  const id = text(formData, "id");
  const parsed = termSchema.safeParse({ name: text(formData, "name"), academicYear: text(formData, "academicYear"), startDate: text(formData, "startDate"), endDate: text(formData, "endDate") });
  if (!parsed.success) fail("/school", parsed.error.issues[0].message);
  const { user, supabase } = await context();
  const row = { name: parsed.data.name, academic_year: parsed.data.academicYear, start_date: parsed.data.startDate, end_date: parsed.data.endDate };
  const result = id ? await supabase.from("academic_terms").update(row).eq("id", id).eq("user_id", user.id) : await supabase.from("academic_terms").insert({ user_id: user.id, ...row });
  if (result.error) fail("/school", safeFailure("The term could not be saved. Check that its details are valid."));
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
  if (result.error) fail(destination, safeFailure("The course could not be saved. Check the selected term and details."));
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
  if (error) fail(destination, "The meeting rows could not be added. Check their dates and times.");
  done(destination, "Meeting schedule added.");
}

export async function saveMeetingSchedule(formData: FormData) {
  const courseId = text(formData, "courseId");
  const destination = `/school/courses/${courseId}`;
  let decoded: unknown;
  try { decoded = JSON.parse(text(formData, "meetings")); }
  catch { fail(destination, "The meeting schedule could not be read."); }
  const parsed = meetingScheduleSchema.safeParse(decoded);
  if (!parsed.success) fail(destination, parsed.error.issues[0]?.message ?? "Check every meeting row.");
  const { supabase, timezone } = await context();
  const rows = parsed.data.map((row) => ({ meeting_type: row.meetingType, weekday: row.weekday, start_time: row.startTime, end_time: row.endTime, location: row.location, effective_start_date: row.effectiveStart, effective_end_date: row.effectiveEnd, timezone, is_active: row.active }));
  const { error } = await supabase.rpc("replace_course_meetings", { owned_course_id: courseId, meeting_rows: rows });
  if (error) fail(destination, "The meeting schedule could not be saved. No schedule changes were applied.");
  done(destination, rows.length ? "Meeting schedule saved." : "Meeting schedule cleared.");
}

export async function deleteSchoolEntity(formData: FormData) {
  const type = text(formData, "type");
  const id = text(formData, "id");
  const destination = type === "course" ? `/school/courses/${id}` : "/school";
  const { supabase } = await context();
  const result = type === "term"
    ? await supabase.rpc("delete_empty_school_term", { owned_term_id: id })
    : type === "course"
      ? await supabase.rpc("delete_empty_school_course", { owned_course_id: id })
      : null;
  if (!result) fail(destination, "This School record cannot be permanently deleted here.");
  if (result.error) fail(destination, type === "term" ? "This term still contains courses. Archive it instead, or remove the courses first." : "This course still contains assessments, meetings, or resources. Archive it instead, or remove those records first.");
  done("/school", type === "term" ? "Empty term permanently deleted." : "Empty course permanently deleted.");
}

export async function setMeetingActive(formData: FormData) {
  const courseId = text(formData, "courseId");
  const { user, supabase } = await context();
  const { error } = await supabase.from("course_meetings").update({ is_active: text(formData, "active") === "true" }).eq("id", text(formData, "id")).eq("user_id", user.id);
  if (error) fail(`/school/courses/${courseId}`, "The meeting could not be updated.");
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
  const input = { courseId, name: text(formData, "name"), assessmentType: text(formData, "assessmentType"), timingType: text(formData, "timingType"), dueLocal: text(formData, "dueLocal"), startsLocal: text(formData, "startsLocal"), endsLocal: text(formData, "endsLocal"), eventDate: text(formData, "eventDate"), weight: text(formData, "weight"), scoreEarned: status === "missed" ? "" : scoreEarned, scoreMax: status === "missed" ? "" : scoreMax, effortHours: text(formData, "effortHours"), status, location: text(formData, "location"), notes: text(formData, "notes") };
  const appContext = await getAuthenticatedAppContext();
  const result = id ? await updateAssessment(id, input, appContext) : await createAssessment(input, appContext);
  if (!result.ok) fail(destination, result.error.message);
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
  if (result.error) fail(destination, "The course resource could not be saved.");
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
  if (error) fail(destination, "The record could not be archived.");
  done(destination, "Archived.");
}

export async function restoreSchoolEntity(formData: FormData) {
  const type = text(formData, "type");
  const id = text(formData, "id");
  const { user, supabase } = await context();
  let error;
  if (type === "course") {
    const { data: course } = await supabase.from("courses").select("term_id").eq("id", id).eq("user_id", user.id).maybeSingle();
    const { data: term } = course ? await supabase.from("academic_terms").select("id").eq("id", course.term_id).eq("user_id", user.id).is("archived_at", null).maybeSingle() : { data: null };
    if (!term) fail("/school/archive", "Restore the course’s term first.");
  }
  if (type === "assessment" || type === "resource") {
    const source = type === "assessment"
      ? await supabase.from("assessments").select("course_id").eq("id", id).eq("user_id", user.id).maybeSingle()
      : await supabase.from("course_resources").select("course_id").eq("id", id).eq("user_id", user.id).maybeSingle();
    const { data: course } = source.data ? await supabase.from("courses").select("term_id").eq("id", source.data.course_id).eq("user_id", user.id).is("archived_at", null).maybeSingle() : { data: null };
    const { data: term } = course ? await supabase.from("academic_terms").select("id").eq("id", course.term_id).eq("user_id", user.id).is("archived_at", null).maybeSingle() : { data: null };
    if (!course || !term) fail("/school/archive", "Restore the parent term and course first.");
  }
  if (type === "term") ({ error } = await supabase.from("academic_terms").update({ archived_at: null }).eq("id", id).eq("user_id", user.id));
  else if (type === "course") ({ error } = await supabase.from("courses").update({ archived_at: null }).eq("id", id).eq("user_id", user.id));
  else if (type === "assessment") ({ error } = await supabase.from("assessments").update({ archived_at: null }).eq("id", id).eq("user_id", user.id));
  else if (type === "resource") ({ error } = await supabase.from("course_resources").update({ archived_at: null }).eq("id", id).eq("user_id", user.id));
  else fail("/school/archive", "Unknown archive type.");
  if (error) fail("/school/archive", "The record could not be restored. Restore its parent first if needed.");
  done("/school/archive", "Restored.");
}
