import { z } from "zod";
import { assistantLimits } from "./limits";
import { assistantMutationNameSchema } from "./mutations";

export const assistantReferenceSchema = z.object({
  type: z.enum(["calendar", "finance", "course", "assessment", "task", "goal"]),
  id: z.string().min(1).max(160),
  label: z.string().min(1).max(120),
  href: z.string().startsWith("/").max(300),
}).strict();

export type AssistantReference = z.infer<typeof assistantReferenceSchema>;

export const assistantMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(assistantLimits.maxUserMessageChars),
}).strict();

export const assistantRequestSchema = z.object({
  messages: z.array(assistantMessageSchema).min(1).max(assistantLimits.maxConversationMessages),
}).strict().refine((value) => value.messages.at(-1)?.role === "user", {
  message: "The latest message must be from the user.",
  path: ["messages"],
}).refine((value) => value.messages.reduce((total, message) => total + message.content.length, 0) <= assistantLimits.maxConversationChars, { message: "Conversation context is too large.", path: ["messages"] });

export type AssistantMessage = z.infer<typeof assistantMessageSchema>;

export type AssistantApiSuccess = { ok: true; message: string };
export type AssistantApiFailure = { ok: false; error: { code: string; message: string } };
export type AssistantApiResponse = AssistantApiSuccess | AssistantApiFailure;
export const assistantMutationResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), operation: assistantMutationNameSchema, entity: z.object({ id: z.string().uuid(), title: z.string(), updated_at: z.string() }).passthrough(), references: z.array(assistantReferenceSchema).max(assistantLimits.maxReferences) }).strict(),
  z.object({ ok: z.literal(false), error: z.object({ code: z.string(), message: z.string() }).strict() }).strict(),
]);

export const assistantStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("meta"), requestId: z.string().uuid() }).strict(),
  z.object({ type: z.literal("status"), phase: z.enum(["thinking", "using_tools"]) }).strict(),
  z.object({ type: z.literal("delta"), text: z.string() }).strict(),
  z.object({ type: z.literal("confirmation"), token: z.string().min(32).max(160), expiresAt: z.string().datetime(), preview: z.object({ operation: assistantMutationNameSchema, actionLabel: z.string().min(1).max(80), subjectTitle: z.string().min(1).max(200), changes: z.array(z.object({ label: z.string().min(1).max(80), before: z.string().max(10000).optional(), after: z.string().max(10000) }).strict()).min(1).max(12) }).strict() }).strict(),
  z.object({ type: z.literal("done"), references: z.array(assistantReferenceSchema).max(assistantLimits.maxReferences) }).strict(),
  z.object({ type: z.literal("error"), code: z.string(), message: z.string(), requestId: z.string().uuid() }).strict(),
]);
export type AssistantStreamEvent = z.infer<typeof assistantStreamEventSchema>;
