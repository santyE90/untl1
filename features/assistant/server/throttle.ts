import "server-only";

import { assistantLimits } from "../limits";

type UserState = { active: boolean; startedAt: number[] };
const users = new Map<string, UserState>();

export type ThrottleDecision = { allowed: true; release: () => void } | { allowed: false; retryAfterSeconds: number };

export function acquireAssistantRequest(userId: string, now = Date.now()): ThrottleDecision {
  const cutoff = now - assistantLimits.throttle.windowMs;
  const current = users.get(userId) ?? { active: false, startedAt: [] };
  current.startedAt = current.startedAt.filter((started) => started > cutoff);
  const latest = current.startedAt.at(-1);
  const retryMs = current.active ? assistantLimits.throttle.minimumIntervalMs : latest === undefined ? 0 : assistantLimits.throttle.minimumIntervalMs - (now - latest);
  if (current.active || retryMs > 0 || current.startedAt.length >= assistantLimits.throttle.maxRequests) {
    const windowRetry = current.startedAt.length >= assistantLimits.throttle.maxRequests ? current.startedAt[0] + assistantLimits.throttle.windowMs - now : 0;
    users.set(userId, current);
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(Math.max(retryMs, windowRetry) / 1000)) };
  }
  current.active = true;
  current.startedAt.push(now);
  users.set(userId, current);
  let released = false;
  return { allowed: true, release: () => { if (released) return; released = true; const state = users.get(userId); if (state) state.active = false; } };
}

export function resetAssistantThrottleForTests() { users.clear(); }
