"use client";

import { useMemo, useState } from "react";

import { saveAssessment } from "./actions";
import { calculateRequiredGrade, calculateScenario, formatPercent, parseExact } from "./grades";

const input = "mt-1 h-10 w-full rounded-lg border bg-card px-3 text-sm";
const label = "text-sm font-medium";

export function AssessmentForm({ courseId, defaults }: { courseId: string; defaults?: Record<string, string | null> }) {
  const [timing, setTiming] = useState(defaults?.timingType ?? "deadline");
  return <form action={saveAssessment} className="grid gap-3 sm:grid-cols-2">
    {defaults?.id ? <input name="id" type="hidden" value={defaults.id} /> : null}<input name="courseId" type="hidden" value={courseId} />
    <label className={label}>Name<input className={input} defaultValue={defaults?.name ?? ""} name="name" required /></label>
    <label className={label}>Type<select className={input} defaultValue={defaults?.assessmentType ?? "assignment"} name="assessmentType">{["assignment", "quiz", "midterm", "final_exam", "project", "lab", "participation", "presentation", "other"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
    <label className={label}>Timing<select className={input} name="timingType" onChange={(event) => setTiming(event.target.value)} value={timing}><option value="deadline">Due date/time</option><option value="scheduled">Scheduled start/end</option><option value="all_day">All-day date</option></select></label>
    <label className={label}>Weight %<input className={input} defaultValue={defaults?.weight ?? ""} inputMode="decimal" name="weight" required /></label>
    {timing === "deadline" ? <label className={`${label} sm:col-span-2`}>Due<input className={input} defaultValue={defaults?.dueLocal ?? ""} name="dueLocal" required type="datetime-local" /></label> : null}
    {timing === "scheduled" ? <><label className={label}>Starts<input className={input} defaultValue={defaults?.startsLocal ?? ""} name="startsLocal" required type="datetime-local" /></label><label className={label}>Ends<input className={input} defaultValue={defaults?.endsLocal ?? ""} name="endsLocal" required type="datetime-local" /></label></> : null}
    {timing === "all_day" ? <label className={`${label} sm:col-span-2`}>Date<input className={input} defaultValue={defaults?.eventDate ?? ""} name="eventDate" required type="date" /></label> : null}
    <label className={label}>Status<select className={input} defaultValue={defaults?.status ?? "upcoming"} name="status">{["upcoming", "submitted", "graded", "missed", "exempt"].map((value) => <option key={value}>{value}</option>)}</select></label>
    <label className={label}>Estimated effort (hours)<input className={input} defaultValue={defaults?.effortHours ?? ""} inputMode="decimal" min="0.01" name="effortHours" placeholder="5" /></label>
    <label className={label}>Location<input className={input} defaultValue={defaults?.location ?? ""} name="location" /></label>
    <span />
    <label className={label}>Score earned<input className={input} defaultValue={defaults?.scoreEarned ?? ""} inputMode="decimal" name="scoreEarned" placeholder="42" /></label>
    <label className={label}>Maximum score<input className={input} defaultValue={defaults?.scoreMax ?? ""} inputMode="decimal" name="scoreMax" placeholder="50" /></label>
    <p className="text-xs text-muted-foreground sm:col-span-2">Entering both score fields marks the assessment graded. Clearing both changes a graded assessment back to upcoming. Missed work counts as zero; exempt work is excluded entirely.</p>
    <label className={`${label} sm:col-span-2`}>Notes<textarea className="mt-1 min-h-20 w-full rounded-lg border bg-card p-3" defaultValue={defaults?.notes ?? ""} name="notes" /></label>
    <button className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground sm:col-span-2">{defaults?.id ? "Save assessment" : "Add assessment"}</button>
  </form>;
}

export function GradeTools({ currentPoints, target, assessments }: { currentPoints: string; target: string | null; assessments: { id: string; name: string; weight: string }[] }) {
  const [scores, setScores] = useState<Record<string, string>>(() => Object.fromEntries(assessments.map((assessment) => [assessment.id, "80"])));
  const [solveId, setSolveId] = useState(assessments.at(-1)?.id ?? "");
  const calculation = useMemo(() => {
    try {
      let projected = parseExact(currentPoints);
      for (const assessment of assessments) projected = calculateScenario(projected, parseExact(assessment.weight), parseExact(scores[assessment.id] ?? "0"));
      const targetExact = target ? parseExact(target) : null;
      let required = null;
      if (targetExact && solveId) {
        let fixed = parseExact(currentPoints);
        for (const assessment of assessments) if (assessment.id !== solveId) fixed = calculateScenario(fixed, parseExact(assessment.weight), parseExact(scores[assessment.id] ?? "0"));
        const selected = assessments.find((assessment) => assessment.id === solveId)!;
        required = calculateRequiredGrade(fixed, parseExact(selected.weight), targetExact);
      }
      return { projected, targetExact, required };
    } catch { return null; }
  }, [assessments, currentPoints, scores, solveId, target]);

  if (!assessments.length) return <p className="text-sm text-muted-foreground">There is no remaining non-exempt work to model.</p>;
  const gap = calculation?.targetExact === null || !calculation ? null : calculation.projected - calculation.targetExact;
  return <div className="space-y-5">
    <div className="space-y-3">{assessments.map((assessment) => <label className="grid items-center gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_8rem]" key={assessment.id}><span><b>{assessment.name}</b><span className="ml-2 text-xs text-muted-foreground">{assessment.weight}%</span></span><span className="flex items-center gap-2"><input aria-label={`${assessment.name} hypothetical percentage`} className="h-9 w-full rounded-md border bg-background px-2" inputMode="decimal" value={scores[assessment.id] ?? ""} onChange={(event) => setScores((current) => ({ ...current, [assessment.id]: event.target.value }))} /><span>%</span></span></label>)}</div>
    <div className="rounded-xl bg-accent/40 p-4"><p className="text-sm text-muted-foreground">Projected final course grade</p><p className="mt-1 text-3xl font-bold">{calculation ? formatPercent(calculation.projected) : "Enter valid percentages"}</p>{gap !== null ? <p className={`mt-1 text-sm ${gap < 0n ? "text-destructive" : "text-success"}`}>{gap < 0n ? `${formatPercent(-gap)} below target` : gap === 0n ? "Exactly at target" : `${formatPercent(gap)} above target`}</p> : <p className="mt-1 text-sm text-muted-foreground">Set a course target to compare this scenario.</p>}</div>
    {target ? <div className="grid gap-3 sm:grid-cols-[1fr_auto]"><label className={label}>Solve one assessment<select className={input} value={solveId} onChange={(event) => setSolveId(event.target.value)}>{assessments.map((assessment) => <option key={assessment.id} value={assessment.id}>{assessment.name}</option>)}</select></label><div className="self-end rounded-lg border px-4 py-2"><p className="text-xs text-muted-foreground">Required score</p><p className="font-bold">{calculation?.required?.required === null || !calculation?.required ? "—" : formatPercent(calculation.required.required)}</p></div>{calculation?.required?.reason ? <p className="text-sm text-destructive sm:col-span-2">{calculation.required.reason}</p> : null}</div> : null}
    <p className="text-xs text-muted-foreground">Scenario values are temporary and never write grades to the database.</p>
  </div>;
}
