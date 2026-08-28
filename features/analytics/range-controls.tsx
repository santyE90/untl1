import Link from "next/link";
import type { AnalyticsRange, AnalyticsRangeKey } from "./date-range";
import { analyticsRangeOptions } from "./date-range";

type Selection = { selectedKey: AnalyticsRangeKey; customFrom: string; customTo: string; error: string | null };

export function AnalyticsRangeControls({ basePath, range, selection, timeZone }: { basePath: string; range: AnalyticsRange; selection: Selection; timeZone: string }) {
  const bucketLabel = range.bucket === "month" ? "Monthly" : range.bucket === "week" ? "Weekly" : "Daily";
  return <div className="space-y-3">
    <nav aria-label="Analytics date range" className="flex max-w-full gap-2 overflow-x-auto pb-1">{analyticsRangeOptions.map((option) => <Link aria-current={selection.selectedKey === option.key ? "page" : undefined} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold ${selection.selectedKey === option.key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`} href={option.key === "custom" ? `${basePath}?range=custom&from=${range.start}&to=${range.end}` : `${basePath}?range=${option.key}`} key={option.key}>{option.label}</Link>)}</nav>
    {selection.selectedKey === "custom" ? <form className="rounded-xl border bg-card p-4" method="get"><input name="range" type="hidden" value="custom"/><div className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="grid gap-1.5 text-sm font-semibold">From<input className="min-h-11 rounded-lg border bg-background px-3 font-normal" defaultValue={selection.customFrom} name="from" required type="date"/></label><label className="grid gap-1.5 text-sm font-semibold">To<input className="min-h-11 rounded-lg border bg-background px-3 font-normal" defaultValue={selection.customTo} name="to" required type="date"/></label><button className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90" type="submit">Apply range</button></div>{selection.error ? <p className="mt-3 text-sm text-destructive" role="alert">{selection.error}</p> : <p className="mt-3 text-xs text-muted-foreground">Inclusive local calendar dates, up to 366 days.</p>}</form> : null}
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="rounded-full bg-muted px-3 py-1.5">{range.start} → {range.end}</span><span>{timeZone}</span><span>·</span><span>{bucketLabel} buckets</span></div>
  </div>;
}

const sections = [{ href: "/analytics", label: "Overview" }, { href: "/analytics/finance", label: "Finance" }, { href: "/analytics/school", label: "School" }, { href: "/analytics/tasks", label: "Tasks" }, { href: "/analytics/goals", label: "Goals" }];
export function AnalyticsSectionNav({ active }: { active: string }) {
  return <nav aria-label="Analytics sections" className="flex max-w-full gap-2 overflow-x-auto rounded-xl border bg-card p-2">{sections.map((item) => <Link aria-current={active === item.label.toLowerCase() ? "page" : undefined} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold ${active === item.label.toLowerCase() ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`} href={item.href} key={item.href}>{item.label}</Link>)}</nav>;
}
