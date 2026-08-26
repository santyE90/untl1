import type { Metadata } from "next";
import { WalletCards } from "lucide-react";

import { UpcomingSection } from "@/components/app-shell/upcoming-section";

export const metadata: Metadata = { title: "Finance" };

export default function FinancePage() {
  return <UpcomingSection description="Accounts, transactions, transfers, recurring bills, and budgets will be implemented in the Finance milestones." icon={WalletCards} title="Finance" />;
}
