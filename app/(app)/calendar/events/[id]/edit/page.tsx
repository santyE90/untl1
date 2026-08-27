import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { instantToLocalInput } from "@/features/calendar/dates";
import { CalendarEventForm } from "@/features/calendar/event-form";
import { getNativeCalendarEvent } from "@/features/calendar/queries";

export const metadata: Metadata = { title: "Edit event" };

export default async function EditCalendarEventPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params; const query = await searchParams; const { event, timeZone } = await getNativeCalendarEvent(id);
  const editingTimeZone = event.recurrenceTimezone ?? timeZone;
  return <div className="mx-auto max-w-2xl space-y-6"><Link className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary" href={`/calendar/events/${id}`}><ArrowLeft className="size-4" /> Back to event</Link><header><p className="text-sm font-semibold text-primary">Calendar-owned event</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Edit {event.recurrenceFrequency ? "recurring series" : "event"}</h1></header>{query.error ? <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{query.error}</p> : null}<section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-7"><CalendarEventForm defaults={{ id: event.id, title: event.title, eventType: event.eventType, allDay: event.allDay, startDate: event.startDate ?? undefined, endDate: event.endDate ?? undefined, startsAtLocal: event.startsAt ? instantToLocalInput(event.startsAt, editingTimeZone) : undefined, endsAtLocal: event.endsAt ? instantToLocalInput(event.endsAt, editingTimeZone) : undefined, description: event.description, location: event.location, recurrenceFrequency: event.recurrenceFrequency, recurrenceUntil: event.recurrenceUntil, reminderOffsets: event.reminderOffsets, timeZoneLabel: editingTimeZone }} /></section></div>;
}
