import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";

import { UpcomingSection } from "@/components/app-shell/upcoming-section";

export const metadata: Metadata = { title: "School" };

export default function SchoolPage() {
  return <UpcomingSection description="Semesters, courses, assessments, grades, and workload planning will be added in a later milestone." icon={GraduationCap} title="School" />;
}
