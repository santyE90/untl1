"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { assertCalendarDate, zonedLocalDateTimeToUtc } from "../calendar/dates";
import { taskSchema, taskStatusSchema } from "./schemas";

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");
function fail(message: string): never { redirect(`/tasks?error=${encodeURIComponent(message)}`); }
function done(message: string): never { revalidatePath("/tasks", "layout"); revalidatePath("/calendar", "layout"); revalidatePath("/dashboard"); redirect(`/tasks?success=${encodeURIComponent(message)}`); }

async function context() {
  const user = await requireAuthenticatedUser();
  const supabase = await createClient();
  const { data: profile, error } = await supabase.from("profiles").select("timezone").eq("id", user.id).single();
  if (error) throw new Error(error.message);
  return { user, supabase, timezone: profile.timezone };
}

export async function saveTask(formData: FormData) {
  const id = text(formData, "id");
  const parsed = taskSchema.safeParse({ title: text(formData, "title"), description: text(formData, "description"), status: text(formData, "status") || "todo", priority: text(formData, "priority") || "medium", dueKind: text(formData, "dueKind") || "none", dueDate: text(formData, "dueDate"), dueLocal: text(formData, "dueLocal"), estimatedEffortMinutes: text(formData, "estimatedEffortMinutes"), assessmentId: text(formData, "assessmentId") });
  if (!parsed.success) fail(parsed.error.issues[0].message);
  const { user, supabase, timezone } = await context();
  const data = parsed.data;
  if (data.assessmentId) {
    const { data: assessment, error } = await supabase.from("assessments").select("id").eq("id", data.assessmentId).eq("user_id", user.id).is("archived_at", null).maybeSingle();
    if (error || !assessment) fail("The related assessment is unavailable.");
  }
  let dueDate: string | null = null;
  let dueAt: string | null = null;
  try {
    if (data.dueKind === "date") dueDate = assertCalendarDate(data.dueDate);
    if (data.dueKind === "timed") dueAt = zonedLocalDateTimeToUtc(data.dueLocal, timezone);
  } catch (error) { fail(error instanceof Error ? error.message : "Due date is invalid."); }
  const row = { title: data.title, description: data.description, status: data.status, priority: data.priority, due_date: dueDate, due_at: dueAt, estimated_effort_minutes: data.estimatedEffortMinutes || null, assessment_id: data.assessmentId || null };
  const result = id ? await supabase.from("tasks").update(row).eq("id", id).eq("user_id", user.id).select("id").single() : await supabase.from("tasks").insert({ user_id: user.id, ...row }).select("id").single();
  if (result.error) fail(result.error.message);
  done(id ? "Task updated." : "Task created.");
}

export async function setTaskStatus(formData: FormData) {
  const parsed = taskStatusSchema.safeParse(text(formData, "status"));
  if (!parsed.success) fail("Task status is invalid.");
  const { user, supabase } = await context();
  const { error } = await supabase.from("tasks").update({ status: parsed.data }).eq("id", text(formData, "id")).eq("user_id", user.id);
  if (error) fail(error.message);
  done(parsed.data === "completed" ? "Task completed." : parsed.data === "todo" ? "Task reopened." : "Task started.");
}

export async function archiveTask(formData: FormData) {
  const { user, supabase } = await context();
  const { error } = await supabase.from("tasks").update({ archived_at: new Date().toISOString() }).eq("id", text(formData, "id")).eq("user_id", user.id);
  if (error) fail(error.message);
  done("Task archived.");
}
