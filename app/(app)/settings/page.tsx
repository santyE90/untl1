import type { Metadata } from "next";
import { Settings } from "lucide-react";

import { UpcomingSection } from "@/components/app-shell/upcoming-section";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return <UpcomingSection description="Profile and preference editing will be added after the authentication foundation is verified." icon={Settings} title="Settings" />;
}
