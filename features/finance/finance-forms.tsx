import type { FinanceAccount } from "./queries";
import { assignRecurringAccount, createAccount, createBill, createCategory, createIncome, createTransaction, createTransfer, updateAccount } from "./actions";

type Category = { id: string; name: string; category_type: string; archived_at: string | null };
type FormProps = { accounts: FinanceAccount[]; categories: Category[]; today: string };
type DefaultCurrencyProps = { defaultCurrency: string };

const input = "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20";
const label = "grid gap-1.5 text-sm font-medium";
const submit = "h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/85";

function AccountOptions({ accounts }: { accounts: FinanceAccount[] }) {
  return accounts.filter((account) => !account.archivedAt).map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>);
}

function CategoryOptions({ categories, type }: { categories: Category[]; type: "expense" | "income" }) {
  return categories.filter((category) => !category.archived_at && [type, "both"].includes(category.category_type)).map((category) => <option key={category.id} value={category.id}>{category.name}</option>);
}

export function AccountForm({ today, defaultCurrency }: Pick<FormProps, "today"> & DefaultCurrencyProps) {
  return <form action={createAccount} className="grid gap-4 sm:grid-cols-2">
    <label className={label}>Account name<input className={input} name="name" required maxLength={80} placeholder="Everyday chequing" /></label>
    <label className={label}>Type<select className={input} name="accountType" defaultValue="chequing"><option value="chequing">Chequing</option><option value="savings">Savings</option><option value="credit_card">Credit card</option><option value="cash">Cash</option><option value="investment">Investment</option><option value="other">Other / custom</option></select></label>
    <label className={label}>Custom type name<input className={input} name="customTypeName" maxLength={40} placeholder="Only for Other" /></label>
    <label className={label}>Institution<input className={input} name="institution" maxLength={100} placeholder="Optional" /></label>
    <label className={label}>Opening balance<input className={input} name="openingBalance" inputMode="decimal" defaultValue="0.00" required /></label>
    <label className={label}>Opening balance date<input className={input} name="openingBalanceDate" type="date" defaultValue={today} required /></label>
    <label className={label}>Currency<input className={input} name="currency" defaultValue={defaultCurrency} pattern="[A-Za-z]{3}" maxLength={3} required /></label>
    <label className={label}>Credit limit<input className={input} name="creditLimit" inputMode="decimal" placeholder="Credit cards only" /></label>
    <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2"><input type="checkbox" name="includeInNetWorth" defaultChecked /> Include in net worth</label>
    <button className={`${submit} sm:col-span-2`} type="submit">Create account</button>
  </form>;
}

export function AccountEditForm({ account }: { account: FinanceAccount }) {
  return <form action={updateAccount} className="grid gap-3 sm:grid-cols-2">
    <input name="id" type="hidden" value={account.id} />
    <label className={label}>Account name<input className={input} defaultValue={account.name} name="name" required maxLength={80} /></label>
    <label className={label}>Type<select className={input} defaultValue={account.accountType} name="accountType"><option value="chequing">Chequing</option><option value="savings">Savings</option><option value="credit_card">Credit card</option><option value="cash">Cash</option><option value="investment">Investment</option><option value="other">Other / custom</option></select></label>
    <label className={label}>Custom type name<input className={input} defaultValue={account.customTypeName ?? ""} name="customTypeName" maxLength={40} /></label>
    <label className={label}>Institution<input className={input} defaultValue={account.institution ?? ""} name="institution" maxLength={100} /></label>
    <label className={label}>Credit limit<input className={input} defaultValue={account.creditLimit ?? ""} name="creditLimit" inputMode="decimal" /></label>
    <label className="flex items-center gap-2 text-sm font-medium"><input defaultChecked={account.includeInNetWorth} name="includeInNetWorth" type="checkbox" /> Include in net worth</label>
    <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground sm:col-span-2">Currency ({account.currency}), opening balance ({account.openingBalance}), and opening date ({account.openingBalanceDate}) are locked because they define the auditable ledger baseline.</p>
    <button className={`${submit} sm:col-span-2`} type="submit">Save account details</button>
  </form>;
}

export function CategoryForm({ defaults }: { defaults?: { id: string; name: string; categoryType: string; displayColor: string | null } } = {}) {
  return <form action={createCategory} className="grid gap-4 sm:grid-cols-3">
    {defaults ? <input name="id" type="hidden" value={defaults.id}/> : null}
    <label className={label}>Name<input className={input} defaultValue={defaults?.name} name="name" required maxLength={60} /></label>
    <label className={label}>Type<select className={input} defaultValue={defaults?.categoryType ?? "expense"} name="categoryType"><option value="expense">Expense</option><option value="income">Income</option><option value="both">Both</option></select></label>
    <label className={label}>Colour<input className={`${input} p-1`} name="displayColor" type="color" defaultValue={defaults?.displayColor ?? "#9865a9"} /></label>
    <button className={`${submit} sm:col-span-3`} type="submit">{defaults ? "Save custom category" : "Create custom category"}</button>
  </form>;
}

export function TransactionForm({ accounts, categories, today }: FormProps) {
  return <form action={createTransaction} className="grid gap-4 sm:grid-cols-2">
    <label className={label}>Direction<select className={input} name="kind"><option value="expense">Expense</option><option value="income">Income</option></select></label>
    <label className={label}>Amount<input className={input} name="amount" inputMode="decimal" min="0.0001" step="0.0001" required placeholder="0.00" /></label>
    <label className={label}>Account<select className={input} name="accountId" required defaultValue=""><option value="" disabled>Select an account</option><AccountOptions accounts={accounts} /></select></label>
    <label className={label}>Category<select className={input} name="categoryId" required defaultValue=""><option value="" disabled>Select a category</option>{categories.filter((category) => !category.archived_at).map((category) => <option key={category.id} value={category.id}>{category.name} · {category.category_type}</option>)}</select></label>
    <label className={label}>Date<input className={input} name="transactionDate" type="date" defaultValue={today} required /></label>
    <label className={label}>Merchant / payee<input className={input} name="merchant" maxLength={120} /></label>
    <label className={`${label} sm:col-span-2`}>Description<input className={input} name="description" maxLength={160} /></label>
    <label className={`${label} sm:col-span-2`}>Notes<textarea className="min-h-20 w-full rounded-lg border border-input bg-card p-3 text-sm" name="notes" maxLength={2000} /></label>
    <button className={`${submit} sm:col-span-2`} type="submit">Add transaction</button>
  </form>;
}

export function TransferForm({ accounts, today }: Pick<FormProps, "accounts" | "today">) {
  return <form action={createTransfer} className="grid gap-4 sm:grid-cols-2">
    <label className={label}>From<select className={input} name="sourceAccountId" required defaultValue=""><option value="" disabled>Source account</option><AccountOptions accounts={accounts} /></select></label>
    <label className={label}>To<select className={input} name="destinationAccountId" required defaultValue=""><option value="" disabled>Destination account</option><AccountOptions accounts={accounts} /></select></label>
    <label className={label}>Amount<input className={input} name="amount" inputMode="decimal" min="0.0001" step="0.0001" required /></label>
    <label className={label}>Date<input className={input} name="transferDate" type="date" defaultValue={today} required /></label>
    <label className={`${label} sm:col-span-2`}>Description<input className={input} name="description" maxLength={160} placeholder="Optional" /></label>
    <input type="hidden" name="notes" value="" />
    <button className={`${submit} sm:col-span-2`} type="submit" disabled={accounts.filter((account) => !account.archivedAt).length < 2}>Transfer atomically</button>
  </form>;
}

export function BillForm({ accounts, categories, today, defaultCurrency, defaults }: FormProps & DefaultCurrencyProps & { defaults?: { id: string; name: string; expectedAmount: string; accountId: string | null; categoryId: string; currency: string; frequency: string; anchorDate: string; nextDueDate: string; reminderDays: number; autopay: boolean } }) {
  return <form action={createBill} className="grid gap-4 sm:grid-cols-2">
    {defaults ? <input name="id" type="hidden" value={defaults.id} /> : null}
    <label className={label}>Bill name<input className={input} defaultValue={defaults?.name} name="name" required maxLength={100} /></label>
    <label className={label}>Expected amount<input className={input} defaultValue={defaults?.expectedAmount} name="expectedAmount" inputMode="decimal" min="0.0001" step="0.0001" required /></label>
    <label className={label}>Payment account<select className={input} name="accountId" defaultValue={defaults?.accountId ?? ""}><option value="">Unassigned for now</option><AccountOptions accounts={accounts} /></select></label>
    <label className={label}>Currency<input className={input} name="currency" defaultValue={defaults?.currency ?? defaultCurrency} pattern="[A-Za-z]{3}" maxLength={3} readOnly={Boolean(defaults)} required /></label>
    <label className={label}>Category<select className={input} name="categoryId" required defaultValue={defaults?.categoryId ?? ""}><option value="" disabled>Select a category</option><CategoryOptions categories={categories} type="expense" /></select></label>
    <label className={label}>Frequency<select className={input} defaultValue={defaults?.frequency ?? "monthly"} name="frequency"><option value="weekly">Weekly</option><option value="biweekly">Biweekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label>
    <label className={label}>Schedule anchor<input className={input} name="anchorDate" type="date" defaultValue={defaults?.anchorDate ?? today} required /></label>
    <label className={label}>Next due date<input className={input} name="nextDueDate" type="date" defaultValue={defaults?.nextDueDate ?? today} required /></label>
    <label className={label}>Reminder lead days<input className={input} name="reminderDays" type="number" min={0} max={365} defaultValue={defaults?.reminderDays ?? 3} required /></label>
    <label className="flex items-center gap-2 text-sm font-medium"><input defaultChecked={defaults?.autopay} type="checkbox" name="autopay" /> Autopay</label>
    <button className={`${submit} sm:col-span-2`} type="submit">{defaults ? "Save recurring bill" : "Add recurring bill"}</button>
  </form>;
}

export function IncomeForm({ accounts, categories, today, defaultCurrency, defaults }: FormProps & DefaultCurrencyProps & { defaults?: { id: string; name: string; expectedAmount: string; destinationAccountId: string | null; categoryId: string | null; currency: string; frequency: string; anchorDate: string; nextPayday: string; reminderDays: number } }) {
  return <form action={createIncome} className="grid gap-4 sm:grid-cols-2">
    {defaults ? <input name="id" type="hidden" value={defaults.id} /> : null}
    <label className={label}>Income source<input className={input} defaultValue={defaults?.name} name="name" required maxLength={100} /></label>
    <label className={label}>Expected amount<input className={input} defaultValue={defaults?.expectedAmount} name="expectedAmount" inputMode="decimal" min="0.0001" step="0.0001" required /></label>
    <label className={label}>Destination account<select className={input} name="destinationAccountId" defaultValue={defaults?.destinationAccountId ?? ""}><option value="">Unassigned for now</option><AccountOptions accounts={accounts} /></select></label>
    <label className={label}>Currency<input className={input} name="currency" defaultValue={defaults?.currency ?? defaultCurrency} pattern="[A-Za-z]{3}" maxLength={3} readOnly={Boolean(defaults)} required /></label>
    <label className={label}>Category (optional)<select className={input} name="categoryId" defaultValue={defaults?.categoryId ?? ""}><option value="">None</option><CategoryOptions categories={categories} type="income" /></select></label>
    <label className={label}>Frequency<select className={input} defaultValue={defaults?.frequency ?? "monthly"} name="frequency"><option value="weekly">Weekly</option><option value="biweekly">Biweekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label>
    <label className={label}>Schedule anchor<input className={input} name="anchorDate" type="date" defaultValue={defaults?.anchorDate ?? today} required /></label>
    <label className={label}>Next payday<input className={input} name="nextPayday" type="date" defaultValue={defaults?.nextPayday ?? today} required /></label>
    <label className={label}>Reminder lead days<input className={input} name="reminderDays" type="number" min={0} max={365} defaultValue={defaults?.reminderDays ?? 1} required /></label>
    <button className={`${submit} sm:col-span-2`} type="submit">{defaults ? "Save recurring income" : "Add recurring income"}</button>
  </form>;
}

export function RecurringAccountForm({ accounts, currency, sourceId, sourceType, currentAccountId }: { accounts: FinanceAccount[]; currency: string; sourceId: string; sourceType: "bill" | "income"; currentAccountId: string | null }) {
  const compatible = accounts.filter((account) => !account.archivedAt && account.currency === currency);
  return <form action={assignRecurringAccount} className="mt-2 flex gap-2">
    <input type="hidden" name="sourceId" value={sourceId} />
    <input type="hidden" name="sourceType" value={sourceType} />
    <select aria-label={`Account for ${sourceType}`} className="h-8 min-w-0 flex-1 rounded-md border border-input bg-card px-2 text-xs" name="accountId" defaultValue={currentAccountId ?? ""}>
      <option value="">Unassigned</option>
      {compatible.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
    </select>
    <button className="rounded-md border border-border px-2 text-xs font-semibold hover:bg-muted">Assign</button>
  </form>;
}
