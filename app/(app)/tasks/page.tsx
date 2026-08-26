import type { Metadata } from "next";
import { CheckSquare2 } from "lucide-react";

import { UpcomingSection } from "@/components/app-shell/upcoming-section";

export const metadata: Metadata = { title: "Tasks" };

export default function TasksPage() {
  return <UpcomingSection description="Tasks, subtasks, priorities, recurrence, and related goals or courses are planned but not yet implemented." icon={CheckSquare2} title="Tasks" />;
}
