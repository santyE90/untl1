import Link from "next/link";
import { notFound } from "next/navigation";

import { updateTransaction } from "@/features/finance/actions";
import { getFinanceOverview, getTransactionForEdit } from "@/features/finance/queries";

const input = "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm";
const label = "grid gap-1.5 text-sm font-medium";

export default async function EditTransactionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id }, notice] = await Promise.all([params, searchParams]);
  const [transaction, finance] = await Promise.all([getTransactionForEdit(id), getFinanceOverview()]);
  if (!transaction || transaction.kind === "transfer") notFound();

  return <div className="mx-auto max-w-2xl space-y-6"><div><Link className="text-sm font-semibold text-primary" href="/finance">← Back to Finance</Link><h1 className="mt-3 text-3xl font-bold">Edit transaction</h1><p className="mt-2 text-sm text-muted-foreground">Changes remain timestamped. Use Void instead when the original row should stop affecting balances while remaining in history.</p></div>{notice.error ? <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{notice.error}</p> : null}<form action={updateTransaction} className="grid gap-4 rounded-2xl border border-border bg-card p-6 sm:grid-cols-2"><input type="hidden" name="id" value={id} /><label className={label}>Direction<select className={input} name="kind" defaultValue={transaction.kind}><option value="expense">Expense</option><option value="income">Income</option></select></label><label className={label}>Amount<input className={input} name="amount" defaultValue={transaction.amount} inputMode="decimal" required /></label><label className={label}>Account<select className={input} name="accountId" defaultValue={transaction.account_id}>{finance.accounts.filter((account) => !account.archivedAt || account.id === transaction.account_id).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label className={label}>Category<select className={input} name="categoryId" defaultValue={transaction.category_id ?? ""}>{finance.categories.map((category) => <option key={category.id} value={category.id}>{category.name} · {category.category_type}</option>)}</select></label><label className={label}>Date<input className={input} name="transactionDate" type="date" defaultValue={transaction.transaction_date} required /></label><label className={label}>Merchant / payee<input className={input} name="merchant" defaultValue={transaction.merchant ?? ""} /></label><label className={`${label} sm:col-span-2`}>Description<input className={input} name="description" defaultValue={transaction.description ?? ""} /></label><label className={`${label} sm:col-span-2`}>Notes<textarea className="min-h-24 rounded-lg border border-input bg-card p-3 text-sm" name="notes" defaultValue={transaction.notes ?? ""} /></label><button className="h-10 rounded-lg bg-primary px-4 font-semibold text-primary-foreground sm:col-span-2">Save transaction</button></form></div>;
}
