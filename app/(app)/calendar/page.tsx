import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";

import { UpcomingSection } from "@/components/app-shell/upcoming-section";

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarPage() {
  return <UpcomingSection description="Your shared timeline will connect native events with dates owned by the other modules." icon={CalendarDays} title="Calendar" />;
}
