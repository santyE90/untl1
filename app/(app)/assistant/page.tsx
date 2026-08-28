import type { Metadata } from "next";
import { AssistantChat } from "@/features/assistant/assistant-chat";

export const metadata: Metadata = { title: "AI Assistant" };

export default function AssistantPage() {
  return <div className="space-y-5"><header><p className="text-sm font-medium text-primary">Confirmation-gated assistant</p><h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">AI Assistant</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Ask questions across LifeStack or prepare supported changes. Nothing is written until you review and confirm it.</p></header><AssistantChat /></div>;
}
