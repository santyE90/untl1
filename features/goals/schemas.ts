import { z } from "zod";

const optionalText = z.string().trim().transform((value) => value || null);
const exactDecimal = /^(\d{1,16})(?:\.(\d{1,4}))?$/;
const isPositiveExactDecimal = (value: string) => exactDecimal.test(value) && BigInt(value.replace(".", "")) > 0n;

export const goalSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: optionalText.pipe(z.string().max(10000).nullable()),
  category: z.enum(["finance", "school", "career", "personal", "health_fitness", "project", "other"]),
  status: z.enum(["active", "completed"]),
  deadline: z.string(),
  progressMode: z.enum(["none", "percentage", "numeric"]),
  currentValue: z.string().trim(),
  targetValue: z.string().trim(),
  unitLabel: z.string().trim().max(40),
}).superRefine((value, context) => {
  if (value.deadline && !/^\d{4}-\d{2}-\d{2}$/.test(value.deadline)) context.addIssue({ code: "custom", message: "Choose a valid deadline." });
  if (value.progressMode !== "none" && !exactDecimal.test(value.currentValue)) context.addIssue({ code: "custom", message: "Current progress must be a non-negative number with up to four decimal places." });
  if (value.progressMode === "numeric") {
    if (!isPositiveExactDecimal(value.targetValue)) context.addIssue({ code: "custom", message: "Target progress must be greater than zero." });
  }
});

export const goalStatusSchema = z.enum(["active", "completed"]);
export const goalEntityIdSchema = z.string().uuid();

export const milestoneSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: optionalText.pipe(z.string().max(5000).nullable()),
  targetDate: z.string(),
  sortOrder: z.coerce.number().int().min(0).max(1000000),
}).superRefine((value, context) => {
  if (value.targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(value.targetDate)) context.addIssue({ code: "custom", message: "Choose a valid milestone date." });
});
