import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { CalendarEventForm } from "@/features/calendar/event-form";
import { assertCalendarDate } from "@/features/calendar/dates";
import { getCalendarContext } from "@/features/calendar/queries";

export const metadata: Metadata = { title: "Add event" };

export default async function NewCalendarEventPage({ searchParams }: { searchParams: Promise<{ date?: string; error?: string }> }) {
  const params = await searchParams;
  const { today } = await getCalendarContext();
  let date = params.date ?? today;
  try { assertCalendarDate(date); } catch { date = today; }
  return <div className="mx-auto max-w-2xl space-y-6"><Link className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary" href="/calendar"><ArrowLeft className="size-4" /> Back to Calendar</Link><header><p className="text-sm font-semibold text-primary">Calendar-owned event</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Add an event</h1><p className="mt-2 text-sm text-muted-foreground">Times are entered in your profile timezone. All-day dates never shift through UTC.</p></header>{params.error ? <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{params.error}</p> : null}<section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-7"><CalendarEventForm defaults={{ startDate: date, endDate: date, startsAtLocal: `${date}T09:00`, endsAtLocal: `${date}T10:00` }} /></section></div>;
}
