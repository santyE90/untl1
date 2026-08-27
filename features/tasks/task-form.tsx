"use client";

import { useState } from "react";

import { saveTask } from "./actions";

type AssessmentOption = { id: string; name: string; courseCode: string };
type Defaults = { id?: string; title?: string; description?: string | null; status?: string; priority?: string; dueKind?: string; dueDate?: string; dueLocal?: string; estimatedEffortMinutes?: string; assessmentId?: string | null };
const input = "mt-1 h-10 w-full rounded-lg border bg-card px-3 text-sm";

export function TaskForm({ assessments, defaults = {} }: { assessments: AssessmentOption[]; defaults?: Defaults }) {
  const [dueKind, setDueKind] = useState(defaults.dueKind ?? "none");
  return <form action={saveTask} className="grid gap-3 sm:grid-cols-2">
    {defaults.id ? <input name="id" type="hidden" value={defaults.id} /> : null}
    <label className="text-sm font-medium sm:col-span-2">Title<input className={input} defaultValue={defaults.title ?? ""} maxLength={200} name="title" required /></label>
    <label className="text-sm font-medium">Status<select className={input} defaultValue={defaults.status ?? "todo"} name="status"><option value="todo">Todo</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></label>
    <label className="text-sm font-medium">Priority<select className={input} defaultValue={defaults.priority ?? "medium"} name="priority"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
    <label className="text-sm font-medium">Due type<select className={input} name="dueKind" onChange={(event) => setDueKind(event.target.value)} value={dueKind}><option value="none">No due date</option><option value="date">Date only</option><option value="timed">Date and time</option></select></label>
    {dueKind === "date" ? <label className="text-sm font-medium">Due date<input className={input} defaultValue={defaults.dueDate ?? ""} name="dueDate" required type="date" /></label> : <input name="dueDate" type="hidden" value="" />}
    {dueKind === "timed" ? <label className="text-sm font-medium">Due date and time<input className={input} defaultValue={defaults.dueLocal ?? ""} name="dueLocal" required type="datetime-local" /></label> : <input name="dueLocal" type="hidden" value="" />}
    <label className="text-sm font-medium">Estimated effort (minutes)<input className={input} defaultValue={defaults.estimatedEffortMinutes ?? ""} inputMode="numeric" min="1" name="estimatedEffortMinutes" placeholder="120" type="number" /></label>
    <label className="text-sm font-medium">Related assessment<select className={input} defaultValue={defaults.assessmentId ?? ""} name="assessmentId"><option value="">None</option>{assessments.map((assessment) => <option key={assessment.id} value={assessment.id}>{assessment.courseCode} · {assessment.name}</option>)}</select></label>
    <label className="text-sm font-medium sm:col-span-2">Description<textarea className="mt-1 min-h-24 w-full rounded-lg border bg-card p-3 text-sm" defaultValue={defaults.description ?? ""} maxLength={10000} name="description" /></label>
    <button className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground sm:col-span-2">{defaults.id ? "Save task" : "Create task"}</button>
  </form>;
}
