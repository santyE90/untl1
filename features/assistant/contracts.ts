import { z } from "zod";
import { assistantLimits } from "./limits";

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

export const assistantStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("meta"), requestId: z.string().uuid() }).strict(),
  z.object({ type: z.literal("status"), phase: z.enum(["thinking", "using_tools"]) }).strict(),
  z.object({ type: z.literal("delta"), text: z.string() }).strict(),
  z.object({ type: z.literal("done"), references: z.array(assistantReferenceSchema).max(assistantLimits.maxReferences) }).strict(),
  z.object({ type: z.literal("error"), code: z.string(), message: z.string(), requestId: z.string().uuid() }).strict(),
]);
export type AssistantStreamEvent = z.infer<typeof assistantStreamEventSchema>;
