import { z } from "zod";

const optionalText = z.string().trim().transform((value) => value || null);
export const taskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: optionalText.pipe(z.string().max(10000).nullable()),
  status: z.enum(["todo", "in_progress", "completed"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  dueKind: z.enum(["none", "date", "timed"]),
  dueDate: z.string(),
  dueLocal: z.string(),
  estimatedEffortMinutes: z.union([z.literal(""), z.coerce.number().int().min(1).max(100000)]),
  assessmentId: z.union([z.literal(""), z.string().uuid()]),
  goalId: z.union([z.literal(""), z.string().uuid()]),
}).superRefine((value, context) => {
  if (value.dueKind === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value.dueDate)) context.addIssue({ code: "custom", message: "Choose a valid due date." });
  if (value.dueKind === "timed" && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value.dueLocal)) context.addIssue({ code: "custom", message: "Choose a valid due date and time." });
});

export const taskStatusSchema = z.enum(["todo", "in_progress", "completed"]);
