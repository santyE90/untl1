import type { Metadata } from "next";
import { Target } from "lucide-react";

import { UpcomingSection } from "@/components/app-shell/upcoming-section";

export const metadata: Metadata = { title: "Goals" };

export default function GoalsPage() {
  return <UpcomingSection description="Long-term goals and milestones will be connected to tasks and finance when their data models exist." icon={Target} title="Goals" />;
}
