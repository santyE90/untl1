import { z } from "zod";

export const assistantMutationNameSchema = z.enum(["create_task", "update_task", "set_task_status", "create_calendar_event", "update_calendar_event"]);
export type AssistantMutationName = z.infer<typeof assistantMutationNameSchema>;

const nullableId = z.string().uuid().nullable();
export const createTaskProposalSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(10000).nullable(),
  priority: z.enum(["low", "medium", "high", "urgent"]).nullable(),
  dueDate: z.string().nullable(),
  dueLocal: z.string().nullable(),
  estimatedEffortMinutes: z.number().int().min(1).max(100000).nullable(),
  assessmentId: nullableId,
  goalId: nullableId,
}).strict().superRefine((value, context) => {
  if (value.dueDate && value.dueLocal) context.addIssue({ code: "custom", message: "Use a date or a local date/time, not both." });
});

export const updateTaskProposalSchema = z.object({
  taskId: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(10000).nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  dueKind: z.enum(["none", "date", "timed"]).optional(),
  dueDate: z.string().optional(),
  dueLocal: z.string().optional(),
  estimatedEffortMinutes: z.number().int().min(1).max(100000).nullable().optional(),
  assessmentId: nullableId.optional(),
  goalId: nullableId.optional(),
}).strict().superRefine((value, context) => {
  if (Object.keys(value).length === 1) context.addIssue({ code: "custom", message: "At least one Task field must change." });
  if (value.dueKind === "date" && !value.dueDate) context.addIssue({ code: "custom", message: "A date is required for a date-only Task." });
  if (value.dueKind === "timed" && !value.dueLocal) context.addIssue({ code: "custom", message: "A local date and time are required for a timed Task." });
  if (value.dueKind === undefined && (value.dueDate || value.dueLocal)) context.addIssue({ code: "custom", message: "dueKind is required when changing a due date." });
});

export const setTaskStatusProposalSchema = z.object({ taskId: z.string().uuid(), status: z.enum(["todo", "in_progress", "completed"]) }).strict();

const calendarFields = {
  title: z.string().trim().min(1).max(160), eventType: z.string().trim().max(40).nullable(), description: z.string().max(4000).nullable(), location: z.string().trim().max(240).nullable(),
  allDay: z.boolean(), startDate: z.string().nullable(), endDate: z.string().nullable(), startsAtLocal: z.string().nullable(), endsAtLocal: z.string().nullable(),
};
export const createCalendarEventProposalSchema = z.object(calendarFields).strict().superRefine((value, context) => {
  if (value.allDay && (!value.startDate || !value.endDate || value.startsAtLocal || value.endsAtLocal)) context.addIssue({ code: "custom", message: "All-day events require start and end dates only." });
  if (!value.allDay && (!value.startsAtLocal || !value.endsAtLocal || value.startDate || value.endDate)) context.addIssue({ code: "custom", message: "Timed events require explicit local start and end times only." });
});
export const updateCalendarEventProposalSchema = z.object({ eventId: z.string().uuid(), title: calendarFields.title.optional(), eventType: calendarFields.eventType.optional(), description: calendarFields.description.optional(), location: calendarFields.location.optional(), allDay: calendarFields.allDay.optional(), startDate: calendarFields.startDate.optional(), endDate: calendarFields.endDate.optional(), startsAtLocal: calendarFields.startsAtLocal.optional(), endsAtLocal: calendarFields.endsAtLocal.optional() }).strict().superRefine((value, context) => {
  if (Object.keys(value).length === 1) context.addIssue({ code: "custom", message: "At least one Calendar field must change." });
  if ((value.startsAtLocal === undefined) !== (value.endsAtLocal === undefined)) context.addIssue({ code: "custom", message: "Changing a timed event requires both start and end times." });
  if ((value.startDate === undefined) !== (value.endDate === undefined)) context.addIssue({ code: "custom", message: "Changing an all-day event requires both start and end dates." });
});

export const assistantConfirmationRequestSchema = z.object({ token: z.string().min(32).max(160) }).strict();
export type AssistantMutationPreview = { operation: AssistantMutationName; actionLabel: string; subjectTitle: string; changes: { label: string; before?: string; after: string }[] };
