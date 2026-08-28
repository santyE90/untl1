import "server-only";

import { validateGoalMutation } from "@/features/goals/mutations";
import { formatGoalCategory, goalExactToDecimal, parseGoalExact } from "@/features/goals/progress";
import { getGoals } from "@/features/goals/queries";
import type { GoalRecord } from "@/features/goals/types";
import type { AuthenticatedAppContext } from "@/features/shared/server-context";
import { createGoalProposalSchema, setGoalStatusProposalSchema, updateGoalProgressProposalSchema, updateGoalProposalSchema, type AssistantMutationPreview } from "../mutations";
import { registerPendingMutation } from "./pending-mutations";

type ProposalResult = { ok: true; confirmation: ReturnType<typeof registerPendingMutation> } | { ok: false; error: { code: string; message: string } };
type GoalInput = { title: string; description: string; category: string; status: string; deadline: string; progressMode: string; currentValue: string; targetValue: string; unitLabel: string };
const failure = (code: string, message: string): ProposalResult => ({ ok: false, error: { code, message } });
const shown = (value: unknown) => value === null || value === "" ? "None" : String(value).slice(0, 240);
const exact = (value: string | null | undefined) => value ? goalExactToDecimal(parseGoalExact(value)) : "0";

function inputFromGoal(goal: GoalRecord): GoalInput {
  return { title: goal.title, description: goal.description ?? "", category: goal.category, status: goal.status, deadline: goal.deadline ?? "", progressMode: goal.progress_mode, currentValue: goal.current_value_decimal ?? "", targetValue: goal.target_value_decimal ?? "", unitLabel: goal.unit_label ?? "" };
}

function progressText(input: Pick<GoalInput, "progressMode" | "currentValue" | "targetValue" | "unitLabel">) {
  if (input.progressMode === "none") return "None";
  if (input.progressMode === "percentage") return `${exact(input.currentValue)}%`;
  const unit = input.unitLabel ? ` ${input.unitLabel}` : "";
  return `${exact(input.currentValue)} / ${exact(input.targetValue)}${unit}`;
}

async function ownedActiveGoal(goalId: string, context: AuthenticatedAppContext) {
  const result = await getGoals(context);
  return result.goals.find((goal) => goal.id === goalId && !goal.archived_at) ?? null;
}

export async function proposeAssistantGoalMutation(name: string, rawArguments: string, context: AuthenticatedAppContext): Promise<ProposalResult> {
  let raw: unknown;
  try { raw = JSON.parse(rawArguments || "{}"); } catch { return failure("validation", "The proposed Goal change was not valid JSON."); }

  if (name === "create_goal") {
    const parsed = createGoalProposalSchema.safeParse(raw);
    if (!parsed.success) return failure("validation", parsed.error.issues[0].message);
    const data = parsed.data;
    const input: GoalInput = { title: data.title, description: data.description ?? "", category: data.category, status: "active", deadline: data.deadline ?? "", progressMode: data.progressMode, currentValue: data.currentValue ?? "", targetValue: data.targetValue ?? "", unitLabel: data.unitLabel ?? "" };
    const validated = validateGoalMutation(input);
    if (!validated.ok) return validated;
    const preview: AssistantMutationPreview = { operation: "create_goal", actionLabel: "Create Goal", subjectTitle: input.title, changes: [{ label: "Category", after: formatGoalCategory(input.category) }, ...(input.deadline ? [{ label: "Deadline", after: input.deadline }] : []), { label: "Progress", after: progressText(input) }] };
    return { ok: true, confirmation: registerPendingMutation(context.user.id, { operation: "create_goal", input }, preview) };
  }

  if (name === "set_goal_status") {
    const parsed = setGoalStatusProposalSchema.safeParse(raw);
    if (!parsed.success) return failure("validation", parsed.error.issues[0].message);
    const goal = await ownedActiveGoal(parsed.data.goalId, context);
    if (!goal) return failure("not_found", "Goal was not found or is unavailable.");
    if (goal.status === parsed.data.status) return failure("conflict", `The Goal is already ${parsed.data.status}.`);
    const preview: AssistantMutationPreview = { operation: "set_goal_status", actionLabel: parsed.data.status === "completed" ? "Mark Goal complete" : "Reopen Goal", subjectTitle: goal.title, changes: [{ label: "Status", before: shown(goal.status), after: shown(parsed.data.status) }] };
    return { ok: true, confirmation: registerPendingMutation(context.user.id, { operation: "set_goal_status", goalId: goal.id, status: parsed.data.status, expectedUpdatedAt: goal.updated_at }, preview) };
  }

  if (name === "update_goal_progress") {
    const parsed = updateGoalProgressProposalSchema.safeParse(raw);
    if (!parsed.success) return failure("validation", parsed.error.issues[0].message);
    const goal = await ownedActiveGoal(parsed.data.goalId, context);
    if (!goal) return failure("not_found", "Goal was not found or is unavailable.");
    if (goal.progress_mode === "none") return failure("validation", "This Goal does not have measured progress.");
    const input = { ...inputFromGoal(goal), currentValue: parsed.data.currentValue };
    const validated = validateGoalMutation(input);
    if (!validated.ok) return validated;
    if (exact(goal.current_value_decimal) === exact(input.currentValue)) return failure("conflict", "The proposal does not change this Goal's progress.");
    const preview: AssistantMutationPreview = { operation: "update_goal_progress", actionLabel: "Update Goal progress", subjectTitle: goal.title, changes: [{ label: "Progress", before: progressText(inputFromGoal(goal)), after: progressText(input) }] };
    return { ok: true, confirmation: registerPendingMutation(context.user.id, { operation: "update_goal_progress", goalId: goal.id, input, expectedUpdatedAt: goal.updated_at }, preview) };
  }

  if (name !== "update_goal") return failure("validation", "Unsupported Goal mutation.");
  const parsed = updateGoalProposalSchema.safeParse(raw);
  if (!parsed.success) return failure("validation", parsed.error.issues[0].message);
  const goal = await ownedActiveGoal(parsed.data.goalId, context);
  if (!goal) return failure("not_found", "Goal was not found or is unavailable.");
  const current = inputFromGoal(goal);
  const changes = parsed.data;
  const input: GoalInput = { ...current };
  if (changes.title !== undefined) input.title = changes.title;
  if (changes.description !== undefined) input.description = changes.description ?? "";
  if (changes.category !== undefined) input.category = changes.category;
  if (changes.deadline !== undefined) input.deadline = changes.deadline ?? "";
  if (changes.progressMode !== undefined) {
    input.progressMode = changes.progressMode;
    input.currentValue = changes.currentValue ?? "";
    input.targetValue = changes.targetValue ?? "";
    input.unitLabel = changes.unitLabel ?? "";
  }
  const validated = validateGoalMutation(input);
  if (!validated.ok) return validated;
  const previewChanges: AssistantMutationPreview["changes"] = [];
  const add = (label: string, before: unknown, after: unknown) => { if (shown(before) !== shown(after)) previewChanges.push({ label, before: shown(before), after: shown(after) }); };
  if (changes.title !== undefined) add("Title", goal.title, input.title);
  if (changes.description !== undefined) add("Description", goal.description, input.description);
  if (changes.category !== undefined) add("Category", formatGoalCategory(goal.category), formatGoalCategory(input.category));
  if (changes.deadline !== undefined) add("Deadline", goal.deadline, input.deadline);
  if (changes.progressMode !== undefined) add("Progress", progressText(current), progressText(input));
  if (!previewChanges.length) return failure("conflict", "The proposal does not change this Goal.");
  const preview: AssistantMutationPreview = { operation: "update_goal", actionLabel: "Update Goal", subjectTitle: goal.title, changes: previewChanges };
  return { ok: true, confirmation: registerPendingMutation(context.user.id, { operation: "update_goal", goalId: goal.id, input, expectedUpdatedAt: goal.updated_at }, preview) };
}
