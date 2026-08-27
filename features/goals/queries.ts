import "server-only";

import { notFound } from "next/navigation";

import { currentDateInTimeZone } from "@/features/finance/date-ranges";
import { requireAuthenticatedUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

import { sortGoals, summarizeGoals } from "./progress";
import type { GoalMilestoneRecord, GoalRecord, GoalTaskRecord, GoalWithRelations } from "./types";

const goalSelect = "id,title,description,category,status,deadline,progress_mode,current_value_decimal,target_value_decimal,unit_label,completed_at,archived_at,created_at,updated_at" as const;

function goalWithRelations(row: GoalRecord, milestones: GoalMilestoneRecord[], tasks: GoalTaskRecord[]): GoalWithRelations {
  return {
    ...row,
    milestones: milestones.filter((milestone) => milestone.goal_id === row.id).sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)),
    tasks: tasks.filter((task) => task.goal_id === row.id),
  } as GoalWithRelations;
}

async function goalsContext() {
  const user = await requireAuthenticatedUser();
  const supabase = await createClient();
  const { data: profile, error } = await supabase.from("profiles").select("timezone").eq("id", user.id).single();
  if (error) throw new Error(`Unable to load Goal preferences: ${error.message}`);
  return { user, supabase, timezone: profile.timezone, today: currentDateInTimeZone(profile.timezone) };
}

export async function getGoals() {
  const context = await goalsContext();
  const [goalResult, milestoneResult, taskResult] = await Promise.all([
    context.supabase.from("goals").select(goalSelect),
    context.supabase.from("goal_milestones").select("id,goal_id,title,description,target_date,sort_order,is_completed,completed_at,archived_at,created_at,updated_at"),
    context.supabase.from("tasks").select("id,goal_id,title,status,priority,due_date,due_at,archived_at").not("goal_id", "is", null),
  ]);
  const error = goalResult.error ?? milestoneResult.error ?? taskResult.error;
  if (error) throw new Error(`Unable to load Goals: ${error.message}`);
  const milestones = (milestoneResult.data ?? []) as GoalMilestoneRecord[];
  const tasks = (taskResult.data ?? []) as Array<GoalTaskRecord & { goal_id: string }>;
  const goals = sortGoals((goalResult.data ?? []) as GoalRecord[]).map((goal) => goalWithRelations(goal, milestones, tasks));
  return { ...context, goals };
}

export async function getGoal(id: string) {
  const context = await goalsContext();
  const [goalResult, milestoneResult, taskResult] = await Promise.all([
    context.supabase.from("goals").select(goalSelect).eq("id", id).maybeSingle(),
    context.supabase.from("goal_milestones").select("id,goal_id,title,description,target_date,sort_order,is_completed,completed_at,archived_at,created_at,updated_at").eq("goal_id", id),
    context.supabase.from("tasks").select("id,goal_id,title,status,priority,due_date,due_at,archived_at").eq("goal_id", id),
  ]);
  const error = goalResult.error ?? milestoneResult.error ?? taskResult.error;
  if (error) throw new Error(`Unable to load Goal: ${error.message}`);
  if (!goalResult.data) notFound();
  return { ...context, goal: goalWithRelations(goalResult.data as GoalRecord, (milestoneResult.data ?? []) as GoalMilestoneRecord[], (taskResult.data ?? []) as Array<GoalTaskRecord & { goal_id: string }>) };
}

export async function getActiveGoals() {
  const data = await getGoals();
  return data.goals.filter((goal) => !goal.archived_at && goal.status === "active");
}

export async function getUpcomingGoalDeadlines() {
  const data = await getGoals();
  return data.goals.filter((goal) => !goal.archived_at && goal.status === "active" && goal.deadline && goal.deadline >= data.today);
}

export async function getGoalSummary() {
  const data = await getGoals();
  return { ...data, summary: summarizeGoals(data.goals, data.today) };
}

export async function getGoalMilestones(id: string) { return (await getGoal(id)).goal.milestones; }
export async function getTasksForGoal(id: string) { return (await getGoal(id)).goal.tasks; }
