"use client";

import { useState } from "react";

import { createCalendarEvent, updateCalendarEvent } from "./actions";

const input = "mt-1.5 h-11 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20";
const label = "block text-sm font-medium";

type Defaults = {
  id?: string;
  title?: string;
  eventType?: string | null;
  allDay?: boolean;
  startDate?: string;
  endDate?: string;
  startsAtLocal?: string;
  endsAtLocal?: string;
  description?: string | null;
  location?: string | null;
  recurrenceFrequency?: string | null;
  recurrenceUntil?: string | null;
  reminderOffsets?: number[];
  timeZoneLabel?: string;
};

export function CalendarEventForm({ defaults = {} }: { defaults?: Defaults }) {
  const [allDay, setAllDay] = useState(defaults.allDay ?? false);
  const [recurrence, setRecurrence] = useState(defaults.recurrenceFrequency ?? "");
  const action = defaults.id ? updateCalendarEvent : createCalendarEvent;

  return (
    <form action={action} className="grid gap-5 sm:grid-cols-2">
      {defaults.id ? <input name="id" type="hidden" value={defaults.id} /> : null}
      <label className={`${label} sm:col-span-2`}>Title<input autoFocus className={input} defaultValue={defaults.title} maxLength={160} name="title" required /></label>
      <label className={label}>Type (optional)<select className={input} defaultValue={defaults.eventType ?? ""} name="eventType"><option value="">Event</option><option value="personal">Personal</option><option value="appointment">Appointment</option><option value="work">Work</option><option value="social">Social</option><option value="health">Health</option><option value="travel">Travel</option><option value="birthday">Birthday</option><option value="other">Other</option></select></label>
      <label className="flex min-h-11 items-center gap-3 self-end rounded-lg border border-input px-3 text-sm font-medium"><input checked={allDay} className="size-4 accent-primary" name="allDay" onChange={(event) => setAllDay(event.target.checked)} type="checkbox" /> All-day event</label>
      {allDay ? <>
        <label className={label}>Start date<input className={input} defaultValue={defaults.startDate} name="startDate" required type="date" /></label>
        <label className={label}>End date <span className="font-normal text-muted-foreground">(inclusive)</span><input className={input} defaultValue={defaults.endDate ?? defaults.startDate} name="endDate" required type="date" /></label>
      </> : <>
        <label className={label}>Starts<input className={input} defaultValue={defaults.startsAtLocal} name="startsAtLocal" required type="datetime-local" /></label>
        <label className={label}>Ends<input className={input} defaultValue={defaults.endsAtLocal} name="endsAtLocal" required type="datetime-local" /></label>
      </>}
      {!allDay && defaults.timeZoneLabel ? <p className="-mt-3 text-xs text-muted-foreground sm:col-span-2">Series times use {defaults.timeZoneLabel}.</p> : null}
      <label className={label}>Repeats<select className={input} name="recurrenceFrequency" onChange={(event) => setRecurrence(event.target.value)} value={recurrence}><option value="">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label>
      <label className={label}>Repeat through <span className="font-normal text-muted-foreground">(optional)</span><input className={input} disabled={!recurrence} defaultValue={defaults.recurrenceUntil ?? ""} name="recurrenceUntil" type="date" /></label>
      {defaults.id && recurrence ? <p className="rounded-lg bg-accent/45 p-3 text-sm text-muted-foreground sm:col-span-2">Saving changes edits the entire recurring series. Individual occurrence exceptions are not available yet.</p> : null}
      <label className={`${label} sm:col-span-2`}>Location (optional)<input className={input} defaultValue={defaults.location ?? ""} maxLength={240} name="location" /></label>
      <label className={`${label} sm:col-span-2`}>Description / notes (optional)<textarea className="mt-1.5 min-h-28 w-full rounded-lg border border-input bg-card p-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20" defaultValue={defaults.description ?? ""} maxLength={4000} name="description" /></label>
      <fieldset className="sm:col-span-2"><legend className="text-sm font-medium">Event reminders</legend><p className="mt-1 text-xs text-muted-foreground">Configuration only—LifeStack does not send notifications yet. For a series, these apply to every projected occurrence.</p><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{[[0,"At event time"],[5,"5 minutes"],[15,"15 minutes"],[30,"30 minutes"],[60,"1 hour"],[1440,"1 day"],[10080,"1 week"]].map(([offset, text]) => <label className="flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-medium" key={offset}><input defaultChecked={defaults.reminderOffsets?.includes(Number(offset))} name="reminderOffsets" type="checkbox" value={offset} /> {text}</label>)}</div></fieldset>
      <button className="h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 sm:col-span-2" type="submit">{defaults.id ? "Save event" : "Create event"}</button>
    </form>
  );
}
