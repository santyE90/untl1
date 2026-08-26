import type { Metadata } from "next";
import { Bot } from "lucide-react";

import { UpcomingSection } from "@/components/app-shell/upcoming-section";

export const metadata: Metadata = { title: "AI Assistant" };

export default function AssistantPage() {
  return <UpcomingSection description="The assistant is intentionally disabled. No OpenAI requests will be made until the dedicated AI milestone." icon={Bot} title="AI Assistant" />;
}
