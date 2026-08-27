"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertCalendarDate } from "@/features/calendar/dates";
import { requireAuthenticatedUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

import { goalEntityIdSchema, goalSchema, goalStatusSchema, milestoneSchema } from "./schemas";

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");
function goalsFail(message: string): never { redirect(`/goals?error=${encodeURIComponent(message)}`); }
function goalFail(id: string, message: string): never { redirect(`/goals/${id}?error=${encodeURIComponent(message)}`); }
function refreshGoals() { revalidatePath("/goals", "layout"); revalidatePath("/tasks", "layout"); revalidatePath("/calendar", "layout"); revalidatePath("/dashboard"); }

async function context() {
  const user = await requireAuthenticatedUser();
  const supabase = await createClient();
  return { user, supabase };
}

export async function saveGoal(formData: FormData) {
  const id = text(formData, "id");
  if (id && !goalEntityIdSchema.safeParse(id).success) goalsFail("Goal identifier is invalid.");
  const parsed = goalSchema.safeParse({
    title: text(formData, "title"), description: text(formData, "description"), category: text(formData, "category") || "personal",
    status: text(formData, "status") || "active", deadline: text(formData, "deadline"), progressMode: text(formData, "progressMode") || "none",
    currentValue: text(formData, "currentValue"), targetValue: text(formData, "targetValue"), unitLabel: text(formData, "unitLabel"),
  });
  if (!parsed.success) goalsFail(parsed.error.issues[0].message);
  let deadline: string | null = null;
  try { deadline = parsed.data.deadline ? assertCalendarDate(parsed.data.deadline) : null; }
  catch (error) { goalsFail(error instanceof Error ? error.message : "Deadline is invalid."); }
  const { user, supabase } = await context();
  const data = parsed.data;
  const row = {
    title: data.title, description: data.description, category: data.category, status: data.status, deadline,
    progress_mode: data.progressMode,
    current_value: (data.progressMode === "none" ? null : data.currentValue) as unknown as number | null,
    target_value: (data.progressMode === "numeric" ? data.targetValue : null) as unknown as number | null,
    unit_label: data.progressMode === "numeric" ? data.unitLabel || null : null,
  };
  const result = id
    ? await supabase.from("goals").update(row).eq("id", id).eq("user_id", user.id).select("id").single()
    : await supabase.from("goals").insert({ user_id: user.id, ...row }).select("id").single();
  if (result.error) goalsFail(result.error.message);
  refreshGoals();
  redirect(`/goals/${result.data.id}?success=${encodeURIComponent(id ? "Goal updated." : "Goal created.")}`);
}

export async function setGoalStatus(formData: FormData) {
  const id = text(formData, "id");
  const status = goalStatusSchema.safeParse(text(formData, "status"));
  if (!goalEntityIdSchema.safeParse(id).success || !status.success) goalsFail("Goal lifecycle request is invalid.");
  const { user, supabase } = await context();
  const { data, error } = await supabase.from("goals").update({ status: status.data }).eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
  if (error) goalFail(id, error.message);
  if (!data) goalFail(id, "Goal is unavailable.");
  refreshGoals();
  redirect(`/goals/${id}?success=${encodeURIComponent(status.data === "completed" ? "Goal completed." : "Goal reopened.")}`);
}

export async function archiveGoal(formData: FormData) {
  const id = text(formData, "id");
  if (!goalEntityIdSchema.safeParse(id).success) goalsFail("Goal identifier is invalid.");
  const { user, supabase } = await context();
  const { data, error } = await supabase.from("goals").update({ archived_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
  if (error) goalFail(id, error.message);
  if (!data) goalFail(id, "Goal is unavailable.");
  refreshGoals();
  redirect(`/goals?filter=archived&success=${encodeURIComponent("Goal archived.")}`);
}

export async function saveMilestone(formData: FormData) {
  const id = text(formData, "id");
  const goalId = text(formData, "goalId");
  if ((id && !goalEntityIdSchema.safeParse(id).success) || !goalEntityIdSchema.safeParse(goalId).success) goalsFail("Milestone request is invalid.");
  const parsed = milestoneSchema.safeParse({ title: text(formData, "title"), description: text(formData, "description"), targetDate: text(formData, "targetDate"), sortOrder: text(formData, "sortOrder") || "0" });
  if (!parsed.success) goalFail(goalId, parsed.error.issues[0].message);
  let targetDate: string | null = null;
  try { targetDate = parsed.data.targetDate ? assertCalendarDate(parsed.data.targetDate) : null; }
  catch (error) { goalFail(goalId, error instanceof Error ? error.message : "Milestone date is invalid."); }
  const { user, supabase } = await context();
  const { data: goal, error: goalError } = await supabase.from("goals").select("id").eq("id", goalId).eq("user_id", user.id).is("archived_at", null).maybeSingle();
  if (goalError || !goal) goalFail(goalId, "Goal is unavailable.");
  const row = { title: parsed.data.title, description: parsed.data.description, target_date: targetDate, sort_order: parsed.data.sortOrder };
  const result = id
    ? await supabase.from("goal_milestones").update(row).eq("id", id).eq("goal_id", goalId).eq("user_id", user.id).select("id").single()
    : await supabase.from("goal_milestones").insert({ user_id: user.id, goal_id: goalId, ...row }).select("id").single();
  if (result.error) goalFail(goalId, result.error.message);
  refreshGoals();
  redirect(`/goals/${goalId}?success=${encodeURIComponent(id ? "Milestone updated." : "Milestone added.")}`);
}

export async function setMilestoneCompletion(formData: FormData) {
  const id = text(formData, "id");
  const goalId = text(formData, "goalId");
  if (!goalEntityIdSchema.safeParse(id).success || !goalEntityIdSchema.safeParse(goalId).success) goalsFail("Milestone request is invalid.");
  const { user, supabase } = await context();
  const completed = text(formData, "completed") === "true";
  const { data, error } = await supabase.from("goal_milestones").update({ is_completed: completed }).eq("id", id).eq("goal_id", goalId).eq("user_id", user.id).select("id").maybeSingle();
  if (error) goalFail(goalId, error.message);
  if (!data) goalFail(goalId, "Milestone is unavailable.");
  refreshGoals();
  redirect(`/goals/${goalId}?success=${encodeURIComponent(completed ? "Milestone completed." : "Milestone reopened.")}`);
}

export async function archiveMilestone(formData: FormData) {
  const id = text(formData, "id");
  const goalId = text(formData, "goalId");
  if (!goalEntityIdSchema.safeParse(id).success || !goalEntityIdSchema.safeParse(goalId).success) goalsFail("Milestone request is invalid.");
  const { user, supabase } = await context();
  const { data, error } = await supabase.from("goal_milestones").update({ archived_at: new Date().toISOString() }).eq("id", id).eq("goal_id", goalId).eq("user_id", user.id).select("id").maybeSingle();
  if (error) goalFail(goalId, error.message);
  if (!data) goalFail(goalId, "Milestone is unavailable.");
  refreshGoals();
  redirect(`/goals/${goalId}?success=${encodeURIComponent("Milestone archived.")}`);
}
