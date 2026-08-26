import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";

import { UpcomingSection } from "@/components/app-shell/upcoming-section";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return <UpcomingSection description="Real analytics will appear only after enough underlying module data exists." icon={BarChart3} title="Analytics" />;
}
