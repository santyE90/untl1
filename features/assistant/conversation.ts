import type { AssistantMessage } from "./contracts";
import { assistantLimits } from "./limits";

export function boundAssistantConversation(messages: AssistantMessage[]) {
  const recent = messages.slice(-assistantLimits.maxConversationMessages);
  const bounded: AssistantMessage[] = [];
  let characters = 0;
  for (let index = recent.length - 1; index >= 0; index -= 1) {
    const message = recent[index];
    if (characters + message.content.length > assistantLimits.maxConversationChars) break;
    bounded.unshift(message);
    characters += message.content.length;
  }
  return { messages: bounded, trimmed: bounded.length < messages.length };
}
