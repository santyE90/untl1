import { saveMilestone } from "./actions";

type Defaults = { id?: string; title?: string; description?: string | null; targetDate?: string | null; sortOrder?: number };
const input = "mt-1 h-10 w-full rounded-lg border bg-card px-3 text-sm";

export function MilestoneForm({ goalId, defaults = {} }: { goalId: string; defaults?: Defaults }) {
  return <form action={saveMilestone} className="grid gap-3 sm:grid-cols-2">
    <input name="goalId" type="hidden" value={goalId} />{defaults.id ? <input name="id" type="hidden" value={defaults.id} /> : null}
    <label className="text-sm font-medium sm:col-span-2">Title<input className={input} defaultValue={defaults.title ?? ""} maxLength={200} name="title" required /></label>
    <label className="text-sm font-medium">Target date <span className="font-normal text-muted-foreground">(optional)</span><input className={input} defaultValue={defaults.targetDate ?? ""} name="targetDate" type="date" /></label>
    <label className="text-sm font-medium">Display order<input className={input} defaultValue={defaults.sortOrder ?? 0} min="0" name="sortOrder" required type="number" /></label>
    <label className="text-sm font-medium sm:col-span-2">Description<textarea className="mt-1 min-h-20 w-full rounded-lg border bg-card p-3 text-sm" defaultValue={defaults.description ?? ""} maxLength={5000} name="description" /></label>
    <button className="h-10 rounded-lg border px-4 text-sm font-semibold sm:col-span-2">{defaults.id ? "Save milestone" : "Add milestone"}</button>
  </form>;
}
