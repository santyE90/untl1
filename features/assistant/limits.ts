export const assistantLimits = {
  maxUserMessageChars: 8_000,
  maxConversationMessages: 12,
  maxConversationChars: 32_000,
  maxOutputTokens: 900,
  maxToolIterations: 4,
  maxToolCalls: 8,
  maxToolResultBytes: 48_000,
  maxReferences: 8,
  itemCaps: { calendar: 40, accounts: 30, bills: 40, courses: 30, assessments: 40, tasks: 40, goals: 40 },
  throttle: { windowMs: 60_000, maxRequests: 6, minimumIntervalMs: 1_500 },
} as const;
