import "server-only";
import { assistantLimits } from "../limits";

export const assistantConfig = {
  model: "gpt-5-mini",
  maxOutputTokens: assistantLimits.maxOutputTokens,
  reasoningEffort: "low" as const,
  maxToolIterations: assistantLimits.maxToolIterations,
  maxToolCalls: assistantLimits.maxToolCalls,
} as const;

export function getOpenAIApiKey() {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is required for the LifeStack Assistant.");
  return key;
}
