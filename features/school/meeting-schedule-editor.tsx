"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { saveMeetingSchedule } from "./actions";

type MeetingRow = {
  meetingType: string;
  weekday: number;
  startTime: string;
  endTime: string;
  location: string;
  effectiveStart: string;
  effectiveEnd: string;
  active: boolean;
};

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const input = "mt-1 min-h-10 w-full rounded-lg border bg-card px-3 text-sm";

export function MeetingScheduleEditor({ courseId, initialRows, termStart, termEnd }: { courseId: string; initialRows: MeetingRow[]; termStart: string; termEnd: string }) {
  const [rows, setRows] = useState<MeetingRow[]>(initialRows);
  const serialized = useMemo(() => JSON.stringify(rows), [rows]);
  function update(index: number, values: Partial<MeetingRow>) { setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...values } : row)); }
  function add() { setRows((current) => [...current, { meetingType: "lecture", weekday: 1, startTime: "09:00", endTime: "10:00", location: "", effectiveStart: termStart, effectiveEnd: termEnd, active: true }]); }

  return <form action={saveMeetingSchedule} className="space-y-4">
    <input name="courseId" type="hidden" value={courseId} />
    <input name="meetings" type="hidden" value={serialized} />
    <p className="text-sm text-muted-foreground">Add one row per meeting pattern, so Monday and Wednesday can use different times, rooms, or meeting types.</p>
    <div className="space-y-3">{rows.map((row, index) => <fieldset className="rounded-xl border p-4" key={index}>
      <legend className="px-1 text-sm font-bold">Meeting {index + 1}</legend>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-medium">Day<select className={input} value={row.weekday} onChange={(event) => update(index, { weekday: Number(event.target.value) })}>{days.map((day, weekday) => <option key={day} value={weekday}>{day}</option>)}</select></label>
        <label className="text-sm font-medium">Type<select className={input} value={row.meetingType} onChange={(event) => update(index, { meetingType: event.target.value })}>{["lecture", "tutorial", "lab", "seminar", "other"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="text-sm font-medium">Starts<input className={input} required type="time" value={row.startTime} onChange={(event) => update(index, { startTime: event.target.value })} /></label>
        <label className="text-sm font-medium">Ends<input className={input} required type="time" value={row.endTime} onChange={(event) => update(index, { endTime: event.target.value })} /></label>
        <label className="text-sm font-medium sm:col-span-2">Location<input className={input} maxLength={160} value={row.location} onChange={(event) => update(index, { location: event.target.value })} /></label>
        <label className="text-sm font-medium">Effective start<input className={input} required type="date" value={row.effectiveStart} onChange={(event) => update(index, { effectiveStart: event.target.value })} /></label>
        <label className="text-sm font-medium">Effective end<input className={input} required type="date" value={row.effectiveEnd} onChange={(event) => update(index, { effectiveEnd: event.target.value })} /></label>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm"><input checked={row.active} type="checkbox" onChange={(event) => update(index, { active: event.target.checked })} /> Active</label><button aria-label={`Remove meeting ${index + 1}`} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-destructive hover:bg-destructive/10" type="button" onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}><Trash2 className="size-4" />Remove</button></div>
    </fieldset>)}</div>
    {!rows.length ? <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No meeting patterns. Saving will clear the course schedule and its Calendar projections.</p> : null}
    <div className="flex flex-col gap-2 sm:flex-row"><button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold hover:bg-muted" type="button" onClick={add}><Plus className="size-4" />Add meeting row</button><button className="min-h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground" type="submit">Save complete schedule</button></div>
  </form>;
}
