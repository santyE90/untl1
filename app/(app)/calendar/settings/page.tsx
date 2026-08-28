import type { Metadata } from "next";
import { ArrowLeft, RotateCcw } from "lucide-react";
import Link from "next/link";

import { restoreCalendarEvent } from "@/features/calendar/actions";
import { formatCalendarDate } from "@/features/calendar/dates";
import { getArchivedCalendarEvents } from "@/features/calendar/queries";

export const metadata: Metadata = { title: "Calendar archive" };

export default async function CalendarSettingsPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const query = await searchParams; const { events, defaultView } = await getArchivedCalendarEvents();
  return <div className="mx-auto max-w-3xl space-y-7"><Link className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary" href="/calendar"><ArrowLeft className="size-4"/> Back to Calendar</Link><header><p className="text-sm font-semibold text-primary">Calendar management</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Archived events</h1></header>
    {query.success ? <p className="rounded-lg bg-success/10 p-3 text-sm text-success" role="status">{query.success}</p> : null}{query.error ? <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{query.error}</p> : null}
    <section className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">Your current default Calendar view is <strong className="capitalize text-foreground">{defaultView}</strong>. LifeStack-wide Calendar preferences are managed centrally.</p><Link className="mt-3 inline-flex text-sm font-semibold text-primary" href="/settings#calendar">Open Calendar preferences →</Link></section>
    <section><h2 className="text-xl font-bold">Archived events</h2><p className="mt-1 text-sm text-muted-foreground">Archived series have no active projected occurrences. Restoring returns the complete source series.</p><div className="mt-4 space-y-3">{events.length ? events.map((event) => <article className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs sm:flex-row sm:items-center" key={event.id}><div className="min-w-0 flex-1"><p className="truncate font-semibold">{event.title}</p><p className="text-xs text-muted-foreground">{event.recurrenceFrequency ? `${event.recurrenceFrequency} series · ` : ""}Archived {event.archivedAt ? new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(new Date(event.archivedAt)) : ""}{event.allDay && event.startDate ? ` · began ${formatCalendarDate(event.startDate)}` : ""}</p></div><form action={restoreCalendarEvent}><input name="id" type="hidden" value={event.id}/><button className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold text-primary sm:w-auto"><RotateCcw className="size-4"/> Restore</button></form></article>) : <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No archived Calendar events.</div>}</div></section>
  </div>;
}
