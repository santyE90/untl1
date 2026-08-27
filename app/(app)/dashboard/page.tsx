import type { Metadata } from "next";
import { ArrowRight, CalendarDays, CircleDollarSign, ListChecks, Sparkles } from "lucide-react";

import { CalendarItemCard } from "@/features/calendar/calendar-item-card";
import { dateForInstant } from "@/features/calendar/dates";
import { getCalendarContext, getCalendarItems } from "@/features/calendar/queries";
import { addCalendarDays } from "@/features/finance/date-ranges";

export const metadata: Metadata = { title: "Dashboard" };

const moduleCards = [
  { icon: CircleDollarSign, title: "Finance", description: "Accounts, transactions, recurring schedules, budgets, analytics, and planning.", status: "Available" },
  { icon: CalendarDays, title: "Calendar", description: "Native events and projected Finance dates in one source-aware timeline.", status: "Available" },
  { icon: ListChecks, title: "Tasks", description: "Your current priorities will appear here once task management is available." },
];

export default async function DashboardPage() {
  const context = await getCalendarContext();
  const user = context.user;
  const upcoming = await getCalendarItems({ start: context.today, end: addCalendarDays(context.today, 30) });
  const todayItems = upcoming.filter((item) => item.allDay ? item.start.slice(0, 10) <= context.today && (item.end ?? item.start).slice(0, 10) >= context.today : dateForInstant(item.start, context.timeZone) === context.today);
  const firstName = user.displayName?.trim().split(/\s+/)[0];
  const today = new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: context.timeZone,
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
            <p className="text-sm text-muted-foreground">Native events and Finance dates for the next 30 days.</p>
          </div>
        </div>
        {upcoming.length ? <div className="mt-6 grid gap-6 lg:grid-cols-2"><div><h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Today · {todayItems.length} {todayItems.length === 1 ? "item" : "items"}</h3><div className="space-y-2">{todayItems.length ? todayItems.slice(0, 4).map((item) => <CalendarItemCard item={item} key={item.id} timeZone={context.timeZone} />) : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Nothing scheduled today.</p>}</div></div><div><h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Upcoming</h3><div className="space-y-2">{upcoming.filter((item) => !todayItems.some((todayItem) => todayItem.id === item.id)).slice(0, 4).map((item) => <CalendarItemCard item={item} key={item.id} timeZone={context.timeZone} />)}</div></div></div> : <div className="mt-6 rounded-xl border border-dashed bg-muted/45 px-5 py-8 text-center"><p className="font-medium">Nothing scheduled yet</p><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">Create a Calendar event or add a recurring bill or payday in Finance. No activity is fabricated.</p></div>}
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
          {moduleCards.map(({ icon: Icon, title, description, status }) => (
            <article className="rounded-2xl border bg-card p-5 shadow-xs" key={title}>
              <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary"><Icon className="size-5" /></span>
              <div className="mt-5 flex items-center justify-between gap-3"><h3 className="font-semibold">{title}</h3><span className="rounded-full bg-muted px-2 py-1 text-[0.6875rem] font-medium text-muted-foreground">{status ?? "Coming soon"}</span></div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
