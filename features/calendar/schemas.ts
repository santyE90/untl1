import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null);

export const calendarEventSchema = z.object({
  title: z.string().trim().min(1, "Enter an event title.").max(160),
  eventType: optionalText(40),
  allDay: z.boolean(),
  startDate: z.string(),
  endDate: z.string(),
  startsAtLocal: z.string(),
  endsAtLocal: z.string(),
  description: optionalText(4000),
  location: optionalText(240),
  recurrenceFrequency: z.union([z.enum(["daily", "weekly", "monthly", "yearly"]), z.literal("")]).default("").transform((value) => value || null),
  recurrenceUntil: z.string().default(""),
  reminderOffsets: z.array(z.coerce.number().int().min(0).max(10080)).max(8).default([]).transform((values) => [...new Set(values)].sort((a, b) => a - b)),
}).superRefine((data, context) => {
  if (data.allDay) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(data.endDate)) {
      context.addIssue({ code: "custom", path: ["startDate"], message: "Choose valid all-day dates." });
    } else if (data.endDate < data.startDate) {
      context.addIssue({ code: "custom", path: ["endDate"], message: "End date cannot be before start date." });
    }
  } else if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(data.startsAtLocal) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(data.endsAtLocal)) {
    context.addIssue({ code: "custom", path: ["startsAtLocal"], message: "Choose valid start and end times." });
  } else if (data.endsAtLocal <= data.startsAtLocal) {
    context.addIssue({ code: "custom", path: ["endsAtLocal"], message: "End time must be after start time." });
  }
  const anchor = data.allDay ? data.startDate : data.startsAtLocal.slice(0, 10);
  if (data.recurrenceFrequency && data.recurrenceUntil && (!/^\d{4}-\d{2}-\d{2}$/.test(data.recurrenceUntil) || data.recurrenceUntil < anchor)) {
    context.addIssue({ code: "custom", path: ["recurrenceUntil"], message: "Recurrence end cannot be before the first event." });
  }
  if (!data.recurrenceFrequency && data.recurrenceUntil) context.addIssue({ code: "custom", path: ["recurrenceUntil"], message: "Choose a recurrence frequency first." });
});

export const calendarEventIdSchema = z.string().uuid("Event is invalid.");
