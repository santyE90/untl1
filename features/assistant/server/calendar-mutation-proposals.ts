import "server-only";

import { instantToLocalInput } from "@/features/calendar/dates";
import { parseCalendarEventMutation } from "@/features/calendar/mutations";
import type { AuthenticatedAppContext } from "@/features/shared/server-context";
import { createCalendarEventProposalSchema, updateCalendarEventProposalSchema, type AssistantMutationPreview } from "../mutations";
import { registerPendingMutation } from "./pending-mutations";

type ProposalResult = { ok: true; confirmation: ReturnType<typeof registerPendingMutation> } | { ok: false; error: { code: string; message: string } };
type CalendarChanges = { title?: string; eventType?: string | null; description?: string | null; location?: string | null; allDay?: boolean; startDate?: string | null; endDate?: string | null; startsAtLocal?: string | null; endsAtLocal?: string | null };
const failure = (code: string, message: string): ProposalResult => ({ ok: false, error: { code, message } });
const shown = (value: unknown) => value === null || value === "" ? "None" : String(value).slice(0, 240);
const temporal = (input: { allDay: boolean; startDate: string; endDate: string; startsAtLocal: string; endsAtLocal: string }, timeZone: string) => input.allDay ? input.startDate === input.endDate ? input.startDate : `${input.startDate} through ${input.endDate} (inclusive)` : `${input.startsAtLocal} – ${input.endsAtLocal} (${timeZone})`;

function eventInput(data: { title: string; eventType: string | null; description: string | null; location: string | null; allDay: boolean; startDate: string | null; endDate: string | null; startsAtLocal: string | null; endsAtLocal: string | null }) {
  return { title: data.title, eventType: data.eventType ?? "", allDay: data.allDay, startDate: data.startDate ?? "", endDate: data.endDate ?? "", startsAtLocal: data.startsAtLocal ?? "", endsAtLocal: data.endsAtLocal ?? "", description: data.description ?? "", location: data.location ?? "", recurrenceFrequency: "", recurrenceUntil: "", reminderOffsets: [] };
}

export async function proposeAssistantCalendarMutation(name: string, rawArguments: string, context: AuthenticatedAppContext): Promise<ProposalResult> {
  let raw: unknown;
  try { raw = JSON.parse(rawArguments || "{}"); } catch { return failure("validation", "The proposed Calendar change was not valid JSON."); }
  if (name === "create_calendar_event") {
    const parsed = createCalendarEventProposalSchema.safeParse(raw);
    if (!parsed.success) return failure("validation", parsed.error.issues[0].message);
    const input = eventInput(parsed.data);
    const validated = parseCalendarEventMutation(input, context.timeZone);
    if (!validated.ok) return validated;
    const preview: AssistantMutationPreview = { operation: "create_calendar_event", actionLabel: "Create Calendar event", subjectTitle: parsed.data.title, changes: [{ label: "When", after: temporal(input, context.timeZone) }, ...(parsed.data.location ? [{ label: "Location", after: parsed.data.location }] : []), ...(parsed.data.eventType ? [{ label: "Type", after: parsed.data.eventType }] : [])] };
    return { ok: true, confirmation: registerPendingMutation(context.user.id, { operation: "create_calendar_event", input }, preview) };
  }
  if (name !== "update_calendar_event") return failure("validation", "Unsupported Calendar mutation.");
  const parsed = updateCalendarEventProposalSchema.safeParse(raw);
  if (!parsed.success) return failure("validation", parsed.error.issues[0].message);
  const changes = parsed.data as typeof parsed.data & CalendarChanges;
  const existing = await context.supabase.from("calendar_events").select("id,title,event_type,all_day,starts_at,ends_at,start_date,end_date,description,location,recurrence_frequency,updated_at").eq("id", changes.eventId).eq("user_id", context.user.id).is("archived_at", null).maybeSingle();
  if (existing.error) return failure("unexpected", "The Calendar event could not be checked.");
  if (!existing.data) return failure("not_found", "A matching owned native Calendar event was not found.");
  if (existing.data.recurrence_frequency) return failure("validation", "Recurring Calendar events cannot be edited through the Assistant yet.");
  const current = { title: existing.data.title, eventType: existing.data.event_type ?? "", allDay: existing.data.all_day, startDate: existing.data.start_date ?? "", endDate: existing.data.end_date ?? "", startsAtLocal: existing.data.starts_at ? instantToLocalInput(existing.data.starts_at, context.timeZone) : "", endsAtLocal: existing.data.ends_at ? instantToLocalInput(existing.data.ends_at, context.timeZone) : "", description: existing.data.description ?? "", location: existing.data.location ?? "", recurrenceFrequency: "", recurrenceUntil: "", reminderOffsets: [] as number[] };
  const input = { ...current };
  for (const field of ["title", "eventType", "description", "location"] as const) if (changes[field] !== undefined) input[field] = changes[field] ?? "";
  if (changes.allDay !== undefined) input.allDay = changes.allDay;
  if (changes.startDate !== undefined) input.startDate = changes.startDate ?? "";
  if (changes.endDate !== undefined) input.endDate = changes.endDate ?? "";
  if (changes.startsAtLocal !== undefined) input.startsAtLocal = changes.startsAtLocal ?? "";
  if (changes.endsAtLocal !== undefined) input.endsAtLocal = changes.endsAtLocal ?? "";
  if (input.allDay) { input.startsAtLocal = ""; input.endsAtLocal = ""; } else { input.startDate = ""; input.endDate = ""; }
  const validated = parseCalendarEventMutation(input, context.timeZone);
  if (!validated.ok) return validated;
  const previewChanges: AssistantMutationPreview["changes"] = [];
  const add = (label: string, before: unknown, after: unknown) => { if (shown(before) !== shown(after)) previewChanges.push({ label, before: shown(before), after: shown(after) }); };
  if (changes.title !== undefined) add("Title", current.title, input.title);
  if (changes.description !== undefined) add("Description", current.description, input.description);
  if (changes.location !== undefined) add("Location", current.location, input.location);
  if (changes.eventType !== undefined) add("Type", current.eventType, input.eventType);
  if (changes.allDay !== undefined || changes.startDate !== undefined || changes.startsAtLocal !== undefined) add("When", temporal(current, context.timeZone), temporal(input, context.timeZone));
  if (!previewChanges.length) return failure("conflict", "The proposal does not change this Calendar event.");
  const preview: AssistantMutationPreview = { operation: "update_calendar_event", actionLabel: "Update Calendar event", subjectTitle: existing.data.title, changes: previewChanges };
  return { ok: true, confirmation: registerPendingMutation(context.user.id, { operation: "update_calendar_event", eventId: existing.data.id, input, expectedUpdatedAt: existing.data.updated_at }, preview) };
}
