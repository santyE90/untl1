import "server-only";

import { assistantReferenceSchema, type AssistantReference } from "../contracts";

const UUID = "[0-9a-fA-F-]{36}";
const approvedHref = new RegExp(`^(?:/calendar(?:\\?date=\\d{4}-\\d{2}-\\d{2}|/events/${UUID})?|/finance(?:/(?:planning|analytics|budget))?|/school(?:/courses/${UUID}(?:#assessment-${UUID})?)?|/tasks(?:\\?task=${UUID}#task-${UUID})?|/goals/${UUID})$`);

export function trustedReference(reference: AssistantReference): AssistantReference | null {
  const parsed = assistantReferenceSchema.safeParse(reference);
  if (!parsed.success || !approvedHref.test(parsed.data.href) || parsed.data.href.includes("//") || parsed.data.href.includes("javascript:")) return null;
  return parsed.data;
}

export function uniqueReferences(references: AssistantReference[], limit: number) {
  const unique = new Map<string, AssistantReference>();
  for (const reference of references) {
    const trusted = trustedReference(reference);
    if (trusted) unique.set(`${trusted.type}:${trusted.id}`, trusted);
    if (unique.size >= limit) break;
  }
  return [...unique.values()];
}
