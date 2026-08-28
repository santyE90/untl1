import "server-only";

import { exactToString, parseExact } from "@/features/school/grades";
import { assessmentInputFromRecord, getOwnedAssessmentForMutation, normalizeScoreInput, validateAssessmentMutation } from "@/features/school/mutations";
import type { AuthenticatedAppContext } from "@/features/shared/server-context";
import { clearAssessmentScoreProposalSchema, setAssessmentScoreProposalSchema, setAssessmentStatusProposalSchema, updateAssessmentProposalSchema, type AssistantMutationPreview } from "../mutations";
import { registerPendingMutation } from "./pending-mutations";

type ProposalResult = { ok: true; confirmation: ReturnType<typeof registerPendingMutation> } | { ok: false; error: { code: string; message: string } };
const failure = (code: string, message: string): ProposalResult => ({ ok: false, error: { code, message } });
const shown = (value: unknown) => value === null || value === "" ? "None" : String(value).replaceAll("_", " ").slice(0, 240);
const subject = (course: string, title: string) => `${course} — ${title}`;

function when(input: ReturnType<typeof assessmentInputFromRecord>, timeZone: string) {
  if (input.timingType === "all_day") return input.eventDate;
  if (input.timingType === "deadline") return `${input.dueLocal} (${timeZone})`;
  return `${input.startsLocal} – ${input.endsLocal} (${timeZone})`;
}

export async function proposeAssistantSchoolMutation(name: string, rawArguments: string, context: AuthenticatedAppContext): Promise<ProposalResult> {
  let raw: unknown; try { raw = JSON.parse(rawArguments || "{}"); } catch { return failure("validation", "The proposed School change was not valid JSON."); }

  if (name === "set_assessment_score") {
    const parsed = setAssessmentScoreProposalSchema.safeParse(raw); if (!parsed.success) return failure("validation", parsed.error.issues[0].message);
    const owned = await getOwnedAssessmentForMutation(parsed.data.assessmentId, context); if (!owned.ok) return owned;
    const score = normalizeScoreInput(parsed.data); if (!score.ok) return score;
    const row = owned.data.assessment;
    const before = row.score_earned === null ? "None" : `${exactToString(parseExact(String(row.score_earned)))} / ${exactToString(parseExact(String(row.score_max!)))}`;
    const preview: AssistantMutationPreview = { operation: "set_assessment_score", actionLabel: "Record assessment score", subjectTitle: subject(owned.data.course.code, row.name), changes: [{ label: "Score", before, after: `${score.data.earned} / ${score.data.maximum}` }, { label: "Equivalent", after: `${score.data.equivalent}%` }, { label: "Course weight", after: `${row.weight_percent}%` }, { label: "Status", before: shown(row.status), after: "graded" }] };
    return { ok: true, confirmation: registerPendingMutation(context.user.id, { operation: "set_assessment_score", assessmentId: row.id, score: parsed.data, expectedUpdatedAt: row.updated_at }, preview) };
  }

  if (name === "clear_assessment_score") {
    const parsed = clearAssessmentScoreProposalSchema.safeParse(raw); if (!parsed.success) return failure("validation", parsed.error.issues[0].message);
    const owned = await getOwnedAssessmentForMutation(parsed.data.assessmentId, context); if (!owned.ok) return owned;
    const row = owned.data.assessment; if (row.score_earned === null) return failure("conflict", "This assessment does not have a recorded score.");
    const preview: AssistantMutationPreview = { operation: "clear_assessment_score", actionLabel: "Clear assessment score", subjectTitle: subject(owned.data.course.code, row.name), changes: [{ label: "Score", before: `${row.score_earned} / ${row.score_max}`, after: "None" }, ...(row.status === "graded" ? [{ label: "Status", before: "graded", after: "upcoming" }] : [])] };
    return { ok: true, confirmation: registerPendingMutation(context.user.id, { operation: "clear_assessment_score", assessmentId: row.id, expectedUpdatedAt: row.updated_at }, preview) };
  }

  if (name === "set_assessment_status") {
    const parsed = setAssessmentStatusProposalSchema.safeParse(raw); if (!parsed.success) return failure("validation", parsed.error.issues[0].message);
    const owned = await getOwnedAssessmentForMutation(parsed.data.assessmentId, context); if (!owned.ok) return owned;
    const row = owned.data.assessment; if (row.status === parsed.data.status) return failure("conflict", `The assessment is already ${parsed.data.status}.`);
    if (row.score_earned !== null && ["upcoming", "submitted"].includes(parsed.data.status)) return failure("validation", "Clear the recorded score before changing this assessment to Upcoming or Submitted.");
    const consequence = parsed.data.status === "missed" ? "Counts as zero under current grade rules; weighting is not redistributed." : parsed.data.status === "exempt" ? "Excluded from configured, graded, and remaining effective weight; weighting is not redistributed." : null;
    const preview: AssistantMutationPreview = { operation: "set_assessment_status", actionLabel: parsed.data.status === "missed" ? "Mark assessment missed" : parsed.data.status === "exempt" ? "Mark assessment exempt" : "Update assessment status", subjectTitle: subject(owned.data.course.code, row.name), changes: [{ label: "Status", before: shown(row.status), after: shown(parsed.data.status) }, ...(consequence ? [{ label: "Grade effect", after: consequence }] : [])] };
    return { ok: true, confirmation: registerPendingMutation(context.user.id, { operation: "set_assessment_status", assessmentId: row.id, status: parsed.data.status, expectedUpdatedAt: row.updated_at }, preview) };
  }

  if (name !== "update_assessment") return failure("validation", "Unsupported School mutation.");
  const parsed = updateAssessmentProposalSchema.safeParse(raw); if (!parsed.success) return failure("validation", parsed.error.issues[0].message);
  const owned = await getOwnedAssessmentForMutation(parsed.data.assessmentId, context); if (!owned.ok) return owned;
  const current = assessmentInputFromRecord(owned.data.assessment, context.timeZone); const changes = parsed.data; const input = { ...current };
  if (changes.title !== undefined) input.name = changes.title;
  if (changes.assessmentType !== undefined) input.assessmentType = changes.assessmentType;
  if (changes.timingType !== undefined) input.timingType = changes.timingType;
  if (changes.dueLocal !== undefined) input.dueLocal = changes.dueLocal;
  if (changes.startsLocal !== undefined) input.startsLocal = changes.startsLocal;
  if (changes.endsLocal !== undefined) input.endsLocal = changes.endsLocal;
  if (changes.eventDate !== undefined) input.eventDate = changes.eventDate;
  if (changes.estimatedEffortMinutes !== undefined) input.effortHours = changes.estimatedEffortMinutes === null ? "" : exactToString((BigInt(changes.estimatedEffortMinutes) * 10_000n + 30n) / 60n);
  if (changes.location !== undefined) input.location = changes.location ?? "";
  if (changes.notes !== undefined) input.notes = changes.notes ?? "";
  if (input.timingType === "deadline") { input.startsLocal = ""; input.endsLocal = ""; input.eventDate = ""; }
  else if (input.timingType === "scheduled") { input.dueLocal = ""; input.eventDate = ""; }
  else { input.dueLocal = ""; input.startsLocal = ""; input.endsLocal = ""; }
  const validated = validateAssessmentMutation(input, context.timeZone); if (!validated.ok) return validated;
  const previewChanges: AssistantMutationPreview["changes"] = []; const add = (label: string, before: unknown, after: unknown) => { if (shown(before) !== shown(after)) previewChanges.push({ label, before: shown(before), after: shown(after) }); };
  if (changes.title !== undefined) add("Title", current.name, input.name);
  if (changes.assessmentType !== undefined) add("Type", current.assessmentType, input.assessmentType);
  if (changes.timingType !== undefined || changes.dueLocal !== undefined || changes.startsLocal !== undefined || changes.eventDate !== undefined) add("When", when(current, context.timeZone), when(input, context.timeZone));
  if (changes.estimatedEffortMinutes !== undefined) add("Effort", owned.data.assessment.estimated_effort_minutes ? `${owned.data.assessment.estimated_effort_minutes} minutes` : null, changes.estimatedEffortMinutes ? `${changes.estimatedEffortMinutes} minutes` : null);
  if (changes.location !== undefined) add("Location", current.location, input.location);
  if (changes.notes !== undefined) add("Notes", current.notes, input.notes);
  if (!previewChanges.length) return failure("conflict", "The proposal does not change this assessment.");
  const preview: AssistantMutationPreview = { operation: "update_assessment", actionLabel: "Update assessment", subjectTitle: subject(owned.data.course.code, owned.data.assessment.name), changes: previewChanges };
  return { ok: true, confirmation: registerPendingMutation(context.user.id, { operation: "update_assessment", assessmentId: owned.data.assessment.id, input, expectedUpdatedAt: owned.data.assessment.updated_at }, preview) };
}
