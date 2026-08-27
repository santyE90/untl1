import "server-only";

import { createHash } from "node:crypto";
import { assistantConfig } from "./config";

export type AssistantObservation = {
  requestId: string;
  userCorrelation: string;
  model: string;
  toolNames: string[];
  toolCalls: number;
  durationMs: number;
  outcome: "success" | "aborted" | "rate_limited" | "configuration" | "provider" | "tool_limit" | "unexpected";
};

export function userCorrelation(userId: string) {
  return createHash("sha256").update(`lifestack-assistant:${userId}`).digest("hex").slice(0, 12);
}

export function observeAssistantTurn(observation: Omit<AssistantObservation, "model">) {
  console.info("[LifeStack Assistant]", JSON.stringify({ ...observation, model: assistantConfig.model }));
}
