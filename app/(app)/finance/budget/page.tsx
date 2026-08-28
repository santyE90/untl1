import Link from "next/link";

import { ConfirmAction } from "@/components/ui/confirm-action";
import { getFinanceAnalytics } from "@/features/finance/analytics-queries";
import { deleteMonthlyBudget, saveMonthlyBudget } from "@/features/finance/budget-actions";
import { nextMonthKey, previousMonthKey } from "@/features/finance/date-ranges";
import { formatMoney, moneyToDecimal } from "@/features/finance/money";

export const metadata = { title: "Finance Budget" };
export const dynamic = "force-dynamic";

const input = "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm";

function validMonth(value?: string) {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : undefined;
}

function monthLabel(month: string) {
  return new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));
}

export default async function BudgetPage({ searchParams }: { searchParams: Promise<{ month?: string; currency?: string; error?: string; success?: string }> }) {
  const params = await searchParams;
  const analytics = await getFinanceAnalytics(validMonth(params.month));
  const currencies = [...new Set([analytics.defaultCurrency, ...analytics.accountCurrencies, ...analytics.budgets.map((budget) => budget.row.currency)])].sort();
  const currency = currencies.includes(params.currency ?? "") ? params.currency! : currencies[0] ?? analytics.defaultCurrency;
  const selected = analytics.budgets.find((budget) => budget.row.currency === currency);
  const allocationMap = new Map((selected ? analytics.allocations.filter((item) => item.budget_id === selected.row.id) : []).map((item) => [item.category_id, String(item.amount)]));
  const categoryStatus = new Map(selected?.status.categories.map((item) => [item.categoryId, item]));
  const categories = analytics.categories.filter((category) => ["expense", "both"].includes(category.category_type) && (!category.archived_at || allocationMap.has(category.id)));

  return <div className="space-y-7">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><Link className="text-sm font-semibold text-primary" href="/finance">← Finance overview</Link><h1 className="mt-2 text-3xl font-bold">Monthly budget</h1><p className="mt-2 text-sm text-muted-foreground">Limits are plans. Actual usage always comes from posted expense transactions.</p></div><Link className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold" href={`/finance/analytics?month=${analytics.month}`}>View analytics</Link></header>

    {params.error ? <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{params.error}</p> : null}
    {params.success ? <p role="status" className="rounded-xl bg-success/10 p-3 text-sm text-success">{params.success}</p> : null}

    <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"><Link className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-muted" href={`/finance/budget?month=${previousMonthKey(analytics.month)}&currency=${currency}`}>← Previous</Link><div className="text-center"><p className="font-bold">{monthLabel(analytics.month)}</p><div className="mt-1 flex justify-center gap-1">{currencies.map((item) => <Link key={item} className={`rounded-md px-2 py-1 text-xs font-semibold ${item === currency ? "bg-primary text-primary-foreground" : "bg-muted"}`} href={`/finance/budget?month=${analytics.month}&currency=${item}`}>{item}</Link>)}</div></div><Link className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-muted" href={`/finance/budget?month=${nextMonthKey(analytics.month)}&currency=${currency}`}>Next →</Link></section>

    {selected ? <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><article className="rounded-2xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Overall limit</p><p className="mt-2 text-2xl font-bold">{formatMoney(selected.status.overallLimit, currency)}</p></article><article className="rounded-2xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Actual spending</p><p className="mt-2 text-2xl font-bold">{formatMoney(selected.status.totalSpent, currency)}</p></article><article className="rounded-2xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Remaining</p><p className={`mt-2 text-2xl font-bold ${selected.status.remaining < BigInt(0) ? "text-financial-negative" : "text-financial-positive"}`}>{formatMoney(selected.status.remaining, currency)}</p></article><article className="rounded-2xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Used</p><p className="mt-2 text-2xl font-bold">{selected.status.percentageUsed?.toFixed(1) ?? "—"}%</p><p className="text-xs text-muted-foreground">{analytics.daysRemaining} days remaining</p></article></section> : <section className="rounded-2xl border border-dashed border-primary/40 bg-accent/30 p-6"><h2 className="text-xl font-bold">Plan {monthLabel(analytics.month)}</h2><p className="mt-2 text-sm text-muted-foreground">Start with one overall limit, then add limits only for categories you want to manage closely. Unbudgeted spending will still be tracked.</p></section>}

    <form action={saveMonthlyBudget} className="space-y-6 rounded-2xl border border-border bg-card p-5 sm:p-6"><input type="hidden" name="month" value={analytics.month} /><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-medium">Currency<select className={input} name="currency" defaultValue={currency}>{currencies.map((item) => <option key={item}>{item}</option>)}</select></label><label className="grid gap-1.5 text-sm font-medium">Overall monthly spending limit<input className={input} name="overallLimit" inputMode="decimal" required defaultValue={selected ? moneyToDecimal(selected.status.overallLimit) : ""} placeholder="1200.00" /></label></div><label className="grid gap-1.5 text-sm font-medium">Notes<textarea className="min-h-20 rounded-lg border border-input bg-card p-3 text-sm" name="notes" maxLength={2000} defaultValue={selected?.row.notes ?? ""} placeholder="Optional context for this month" /></label><div><h2 className="font-bold">Category limits</h2><p className="mt-1 text-sm text-muted-foreground">Leave a field blank to keep it unbudgeted or remove its existing limit.</p><div className="mt-4 grid gap-3 md:grid-cols-2">{categories.map((category) => { const status = categoryStatus.get(category.id); return <label className="rounded-xl border border-border p-4" key={category.id}><span className="flex items-center justify-between gap-3 text-sm font-semibold"><span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ backgroundColor: category.display_color ?? "var(--muted-foreground)" }} />{category.name}{category.archived_at ? " (archived)" : ""}</span>{status ? <span className={status.remaining < BigInt(0) ? "text-financial-negative" : "text-muted-foreground"}>{formatMoney(status.actual, currency)} spent</span> : null}</span><input className={`${input} mt-3`} name={`category:${category.id}`} inputMode="decimal" defaultValue={allocationMap.get(category.id) ?? ""} placeholder="No limit" />{status ? <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${status.overAmount > BigInt(0) ? "bg-destructive" : "bg-primary"}`} style={{ width: `${Math.min(status.percentageUsed ?? 0, 100)}%` }} /></div> : null}</label>; })}</div></div><button className="h-11 w-full rounded-lg bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary/85">{selected ? "Update budget" : "Create budget"}</button></form>

    {selected ? <section className="rounded-2xl border border-destructive/20 bg-card p-5"><h2 className="font-bold">Remove this monthly plan</h2><p className="mt-1 text-sm text-muted-foreground">Deleting a budget removes only its plan and category limits. Ledger transactions and actual spending remain unchanged.</p><div className="mt-3"><ConfirmAction action={deleteMonthlyBudget} fields={{ id: selected.row.id, month: analytics.month }} triggerLabel="Delete monthly budget" title={`Delete the ${currency} budget for ${monthLabel(analytics.month)}?`} description="This permanently deletes the monthly plan and its category limits. Transactions and derived spending are not deleted." /></div></section> : null}

    {analytics.budgetHistory.length ? <section><h2 className="text-lg font-bold">Budget history</h2><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{analytics.budgetHistory.map((budget) => <Link className="rounded-xl border border-border bg-card p-4 hover:border-primary/40" key={budget.id} href={`/finance/budget?month=${budget.budget_month.slice(0, 7)}&currency=${budget.currency}`}><p className="font-semibold">{monthLabel(budget.budget_month.slice(0, 7))}</p><p className="text-sm text-muted-foreground">{formatMoney(String(budget.overall_limit), budget.currency)} · {budget.currency}</p></Link>)}</div></section> : null}
  </div>;
}
