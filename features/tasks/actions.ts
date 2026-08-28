"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAuthenticatedAppContext } from "../shared/server-context";
import { createTask, setTaskStatus as changeTaskStatus, updateTask } from "./mutations";
import { taskSchema, taskStatusSchema } from "./schemas";

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");
function fail(message: string): never { redirect(`/tasks?error=${encodeURIComponent(message)}`); }
function done(message: string): never { revalidatePath("/tasks", "layout"); revalidatePath("/goals", "layout"); revalidatePath("/calendar", "layout"); revalidatePath("/dashboard"); redirect(`/tasks?success=${encodeURIComponent(message)}`); }

export async function saveTask(formData: FormData) {
  const id = text(formData, "id");
  const parsed = taskSchema.safeParse({ title: text(formData, "title"), description: text(formData, "description"), status: text(formData, "status") || "todo", priority: text(formData, "priority") || "medium", dueKind: text(formData, "dueKind") || "none", dueDate: text(formData, "dueDate"), dueLocal: text(formData, "dueLocal"), estimatedEffortMinutes: text(formData, "estimatedEffortMinutes"), assessmentId: text(formData, "assessmentId"), goalId: text(formData, "goalId") });
  if (!parsed.success) fail(parsed.error.issues[0].message);
  const context = await getAuthenticatedAppContext();
  const result = id ? await updateTask(id, parsed.data, context) : await createTask(parsed.data, context);
  if (!result.ok) fail(result.error.message);
  done(id ? "Task updated." : "Task created.");
}

export async function setTaskStatus(formData: FormData) {
  const parsed = taskStatusSchema.safeParse(text(formData, "status"));
  if (!parsed.success) fail("Task status is invalid.");
  const result = await changeTaskStatus(text(formData, "id"), parsed.data, await getAuthenticatedAppContext());
  if (!result.ok) fail(result.error.message);
  done(parsed.data === "completed" ? "Task completed." : parsed.data === "todo" ? "Task reopened." : "Task started.");
}

export async function archiveTask(formData: FormData) {
  const context = await getAuthenticatedAppContext();
  const { data, error } = await context.supabase.from("tasks").update({ archived_at: new Date().toISOString() }).eq("id", text(formData, "id")).eq("user_id", context.user.id).select("id").maybeSingle();
  if (error) fail(error.message);
  if (!data) fail("Task is unavailable.");
  done("Task archived.");
}
