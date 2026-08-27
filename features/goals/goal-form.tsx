"use client";

import { useState } from "react";

import { saveGoal } from "./actions";

type Defaults = { id?: string; title?: string; description?: string | null; category?: string; status?: string; deadline?: string | null; progressMode?: string; currentValue?: string | null; targetValue?: string | null; unitLabel?: string | null };
const input = "mt-1 h-10 w-full rounded-lg border bg-card px-3 text-sm";

export function GoalForm({ defaults = {} }: { defaults?: Defaults }) {
  const [progressMode, setProgressMode] = useState(defaults.progressMode ?? "none");
  return <form action={saveGoal} className="grid gap-3 sm:grid-cols-2">
    {defaults.id ? <input name="id" type="hidden" value={defaults.id} /> : null}
    <label className="text-sm font-medium sm:col-span-2">Title<input className={input} defaultValue={defaults.title ?? ""} maxLength={200} name="title" required /></label>
    <label className="text-sm font-medium">Category<select className={input} defaultValue={defaults.category ?? "personal"} name="category"><option value="finance">Finance</option><option value="school">School</option><option value="career">Career</option><option value="personal">Personal</option><option value="health_fitness">Health/Fitness</option><option value="project">Project</option><option value="other">Other</option></select></label>
    <label className="text-sm font-medium">Status<select className={input} defaultValue={defaults.status ?? "active"} name="status"><option value="active">Active</option><option value="completed">Completed</option></select></label>
    <label className="text-sm font-medium">Deadline<input className={input} defaultValue={defaults.deadline ?? ""} name="deadline" type="date" /></label>
    <label className="text-sm font-medium">Progress type<select className={input} name="progressMode" onChange={(event) => setProgressMode(event.target.value)} value={progressMode}><option value="none">No measured progress</option><option value="percentage">Manual percentage</option><option value="numeric">Numeric target</option></select></label>
    {progressMode !== "none" ? <label className="text-sm font-medium">{progressMode === "percentage" ? "Progress percentage" : "Current value"}<input className={input} defaultValue={defaults.currentValue ?? "0"} inputMode="decimal" min="0" name="currentValue" required step="0.0001" type="number" /></label> : <input name="currentValue" type="hidden" value="" />}
    {progressMode === "numeric" ? <><label className="text-sm font-medium">Target value<input className={input} defaultValue={defaults.targetValue ?? ""} inputMode="decimal" min="0.0001" name="targetValue" required step="0.0001" type="number" /></label><label className="text-sm font-medium">Unit label <span className="font-normal text-muted-foreground">(optional)</span><input className={input} defaultValue={defaults.unitLabel ?? ""} maxLength={40} name="unitLabel" placeholder="CAD, applications, pages" /></label></> : <><input name="targetValue" type="hidden" value="" /><input name="unitLabel" type="hidden" value="" /></>}
    <label className="text-sm font-medium sm:col-span-2">Description<textarea className="mt-1 min-h-28 w-full rounded-lg border bg-card p-3 text-sm" defaultValue={defaults.description ?? ""} maxLength={10000} name="description" /></label>
    <p className="text-xs leading-5 text-muted-foreground sm:col-span-2">Progress may exceed its target and is never used to complete the goal automatically.</p>
    <button className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground sm:col-span-2">{defaults.id ? "Save goal" : "Create goal"}</button>
  </form>;
}
