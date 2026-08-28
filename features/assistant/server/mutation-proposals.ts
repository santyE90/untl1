import "server-only";

import { instantToLocalInput } from "@/features/calendar/dates";
import type { AuthenticatedAppContext } from "@/features/shared/server-context";
import { validateTaskMutation } from "@/features/tasks/mutations";
import { getTasks } from "@/features/tasks/queries";
import type { TaskWithContext } from "@/features/tasks/types";
import { createTaskProposalSchema, setTaskStatusProposalSchema, updateTaskProposalSchema, type AssistantMutationPreview } from "../mutations";
import { registerPendingTaskMutation } from "./pending-mutations";
import { proposeAssistantCalendarMutation } from "./calendar-mutation-proposals";
import { proposeAssistantGoalMutation } from "./goal-mutation-proposals";
import { proposeAssistantSchoolMutation } from "./school-mutation-proposals";

type ProposalResult = { ok: true; confirmation: ReturnType<typeof registerPendingTaskMutation> } | { ok: false; error: { code: string; message: string } };
const error = (code: string, message: string): ProposalResult => ({ ok: false, error: { code, message } });
const shown = (value: unknown) => value === null || value === "" ? "None" : String(value).replaceAll("_", " ").slice(0, 240);

function existingInput(task: TaskWithContext, timeZone: string) {
  return { title: task.title, description: task.description ?? "", status: task.status, priority: task.priority, dueKind: task.due_date ? "date" : task.due_at ? "timed" : "none", dueDate: task.due_date ?? "", dueLocal: task.due_at ? instantToLocalInput(task.due_at, timeZone) : "", estimatedEffortMinutes: task.estimated_effort_minutes ?? "", assessmentId: task.assessment_id ?? "", goalId: task.goal_id ?? "" };
}

export async function proposeAssistantTaskMutation(name: string, rawArguments: string, context: AuthenticatedAppContext): Promise<ProposalResult> {
  let raw: unknown;
  try { raw = JSON.parse(rawArguments || "{}"); } catch { return error("validation", "The proposed Task change was not valid JSON."); }
  if (name === "create_task") {
    const parsed = createTaskProposalSchema.safeParse(raw);
    if (!parsed.success) return error("validation", parsed.error.issues[0].message);
    const data = parsed.data;
    const input = { title: data.title, description: data.description ?? "", status: "todo", priority: data.priority ?? "medium", dueKind: data.dueLocal ? "timed" : data.dueDate ? "date" : "none", dueDate: data.dueDate ?? "", dueLocal: data.dueLocal ?? "", estimatedEffortMinutes: data.estimatedEffortMinutes ?? "", assessmentId: data.assessmentId ?? "", goalId: data.goalId ?? "" };
    const validated = await validateTaskMutation(input, context);
    if (!validated.ok) return validated;
    const preview: AssistantMutationPreview = { operation: "create_task", actionLabel: "Create task", subjectTitle: data.title, changes: [{ label: "Status", after: "Todo" }, { label: "Priority", after: shown(data.priority ?? "medium") }, ...(data.dueDate ? [{ label: "Due", after: data.dueDate }] : data.dueLocal ? [{ label: "Due", after: `${data.dueLocal} (${context.timeZone})` }] : []), ...(data.estimatedEffortMinutes ? [{ label: "Effort", after: `${data.estimatedEffortMinutes} minutes` }] : [])] };
    return { ok: true, confirmation: registerPendingTaskMutation(context.user.id, { operation: "create_task", input }, preview) };
  }

  const tasks = await getTasks({ context });
  if (name === "set_task_status") {
    const parsed = setTaskStatusProposalSchema.safeParse(raw);
    if (!parsed.success) return error("validation", parsed.error.issues[0].message);
    const task = tasks.tasks.find((item) => item.id === parsed.data.taskId);
    if (!task) return error("not_found", "Task was not found or is unavailable.");
    if (task.status === parsed.data.status) return error("conflict", `The Task is already ${shown(task.status)}.`);
    const preview: AssistantMutationPreview = { operation: "set_task_status", actionLabel: parsed.data.status === "completed" ? "Mark complete" : parsed.data.status === "todo" && task.status === "completed" ? "Reopen task" : "Change task status", subjectTitle: task.title, changes: [{ label: "Status", before: shown(task.status), after: shown(parsed.data.status) }] };
    return { ok: true, confirmation: registerPendingTaskMutation(context.user.id, { operation: "set_task_status", taskId: task.id, status: parsed.data.status, expectedUpdatedAt: task.updated_at }, preview) };
  }

  if (name === "update_task") {
    const parsed = updateTaskProposalSchema.safeParse(raw);
    if (!parsed.success) return error("validation", parsed.error.issues[0].message);
    const task = tasks.tasks.find((item) => item.id === parsed.data.taskId);
    if (!task) return error("not_found", "Task was not found or is unavailable.");
    const current = existingInput(task, context.timeZone);
    const changes = parsed.data;
    const input = { ...current, ...(changes.title !== undefined ? { title: changes.title } : {}), ...(changes.description !== undefined ? { description: changes.description ?? "" } : {}), ...(changes.priority !== undefined ? { priority: changes.priority } : {}), ...(changes.estimatedEffortMinutes !== undefined ? { estimatedEffortMinutes: changes.estimatedEffortMinutes ?? "" } : {}), ...(changes.assessmentId !== undefined ? { assessmentId: changes.assessmentId ?? "" } : {}), ...(changes.goalId !== undefined ? { goalId: changes.goalId ?? "" } : {}) };
    if (changes.dueKind !== undefined) { input.dueKind = changes.dueKind; input.dueDate = changes.dueKind === "date" ? changes.dueDate! : ""; input.dueLocal = changes.dueKind === "timed" ? changes.dueLocal! : ""; }
    const validated = await validateTaskMutation(input, context);
    if (!validated.ok) return validated;
    const previewChanges: AssistantMutationPreview["changes"] = [];
    const add = (label: string, before: unknown, after: unknown) => { if (shown(before) !== shown(after)) previewChanges.push({ label, before: shown(before), after: shown(after) }); };
    if (changes.title !== undefined) add("Title", task.title, changes.title);
    if (changes.description !== undefined) add("Description", task.description, changes.description);
    if (changes.priority !== undefined) add("Priority", task.priority, changes.priority);
    if (changes.dueKind !== undefined) add("Due", task.due_date ?? (task.due_at ? `${current.dueLocal} (${context.timeZone})` : null), changes.dueKind === "date" ? changes.dueDate : changes.dueKind === "timed" ? `${changes.dueLocal} (${context.timeZone})` : null);
    if (changes.estimatedEffortMinutes !== undefined) add("Effort", task.estimated_effort_minutes ? `${task.estimated_effort_minutes} minutes` : null, changes.estimatedEffortMinutes ? `${changes.estimatedEffortMinutes} minutes` : null);
    if (changes.assessmentId !== undefined) add("Assessment", task.assessment?.name ?? null, changes.assessmentId ? tasks.assessmentOptions.find((item) => item.id === changes.assessmentId)?.name ?? "Selected assessment" : null);
    if (changes.goalId !== undefined) add("Goal", task.goal?.title ?? null, changes.goalId ? tasks.goalOptions.find((item) => item.id === changes.goalId)?.title ?? "Selected goal" : null);
    if (!previewChanges.length) return error("conflict", "The proposal does not change this Task.");
    const preview: AssistantMutationPreview = { operation: "update_task", actionLabel: "Update task", subjectTitle: task.title, changes: previewChanges };
    return { ok: true, confirmation: registerPendingTaskMutation(context.user.id, { operation: "update_task", taskId: task.id, input, expectedUpdatedAt: task.updated_at }, preview) };
  }
  return error("validation", "Unsupported Assistant mutation.");
}

export async function proposeAssistantMutation(name: string, rawArguments: string, context: AuthenticatedAppContext) {
  if (name === "create_task" || name === "update_task" || name === "set_task_status") return proposeAssistantTaskMutation(name, rawArguments, context);
  if (name === "create_calendar_event" || name === "update_calendar_event") return proposeAssistantCalendarMutation(name, rawArguments, context);
  if (name === "create_goal" || name === "update_goal" || name === "set_goal_status" || name === "update_goal_progress") return proposeAssistantGoalMutation(name, rawArguments, context);
  if (name === "update_assessment" || name === "set_assessment_score" || name === "clear_assessment_score" || name === "set_assessment_status") return proposeAssistantSchoolMutation(name, rawArguments, context);
  return { ok: false as const, error: { code: "validation", message: "Unsupported Assistant mutation." } };
}
