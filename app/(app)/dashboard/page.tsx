import type { Metadata } from "next";
import { ArrowRight, CalendarDays, CircleDollarSign, ListChecks, Sparkles } from "lucide-react";

import { requireAuthenticatedUser } from "@/lib/auth/user";

export const metadata: Metadata = { title: "Dashboard" };

const moduleCards = [
  { icon: CircleDollarSign, title: "Finance", description: "Accounts and transactions will appear here after the Finance milestone." },
  { icon: CalendarDays, title: "Calendar", description: "Events and cross-module deadlines will appear here after Calendar is connected." },
  { icon: ListChecks, title: "Tasks", description: "Your current priorities will appear here once task management is available." },
];

export default async function DashboardPage() {
  const user = await requireAuthenticatedUser();
  const firstName = user.displayName?.trim().split(/\s+/)[0];
  const today = new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Toronto",
  }).format(new Date());

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">{today}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Good to see you{firstName ? `, ${firstName}` : ""}.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Your workspace is ready. It will become more useful as each real module is connected.</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-xs"><span className="size-2 rounded-full bg-success" /> Foundation active</span>
      </header>

      <section aria-labelledby="today-heading" className="rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary"><Sparkles className="size-5" /></span>
          <div>
            <h2 className="font-semibold" id="today-heading">Today</h2>
            <p className="text-sm text-muted-foreground">Your daily briefing will live here.</p>
          </div>
        </div>
        <div className="mt-6 rounded-xl border border-dashed bg-muted/45 px-5 py-8 text-center">
          <p className="font-medium">Nothing to summarize yet</p>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">This is an honest empty state—not generated activity. Upcoming bills, events, assignments, and tasks will appear as their modules are implemented.</p>
        </div>
      </section>

      <section aria-labelledby="workspace-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold" id="workspace-heading">Your workspace</h2>
            <p className="mt-1 text-sm text-muted-foreground">A preview of the connected areas being built.</p>
          </div>
          <span className="hidden items-center gap-1 text-xs font-medium text-muted-foreground sm:flex">Built one milestone at a time <ArrowRight className="size-3.5" /></span>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {moduleCards.map(({ icon: Icon, title, description }) => (
            <article className="rounded-2xl border bg-card p-5 shadow-xs" key={title}>
              <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary"><Icon className="size-5" /></span>
              <div className="mt-5 flex items-center justify-between gap-3"><h3 className="font-semibold">{title}</h3><span className="rounded-full bg-muted px-2 py-1 text-[0.6875rem] font-medium text-muted-foreground">Coming soon</span></div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
