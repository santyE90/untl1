import type { FinanceAccount } from "./queries";
import { assignRecurringAccount, createAccount, createBill, createCategory, createIncome, createTransaction, createTransfer } from "./actions";

type Category = { id: string; name: string; category_type: string; archived_at: string | null };
type FormProps = { accounts: FinanceAccount[]; categories: Category[]; today: string };

const input = "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20";
const label = "grid gap-1.5 text-sm font-medium";
const submit = "h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/85";

function AccountOptions({ accounts }: { accounts: FinanceAccount[] }) {
  return accounts.filter((account) => !account.archivedAt).map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>);
}

function CategoryOptions({ categories, type }: { categories: Category[]; type: "expense" | "income" }) {
  return categories.filter((category) => !category.archived_at && [type, "both"].includes(category.category_type)).map((category) => <option key={category.id} value={category.id}>{category.name}</option>);
}

export function AccountForm({ today }: Pick<FormProps, "today">) {
  return <form action={createAccount} className="grid gap-4 sm:grid-cols-2">
    <label className={label}>Account name<input className={input} name="name" required maxLength={80} placeholder="Everyday chequing" /></label>
    <label className={label}>Type<select className={input} name="accountType" defaultValue="chequing"><option value="chequing">Chequing</option><option value="savings">Savings</option><option value="credit_card">Credit card</option><option value="cash">Cash</option><option value="investment">Investment</option><option value="other">Other / custom</option></select></label>
    <label className={label}>Custom type name<input className={input} name="customTypeName" maxLength={40} placeholder="Only for Other" /></label>
    <label className={label}>Institution<input className={input} name="institution" maxLength={100} placeholder="Optional" /></label>
    <label className={label}>Opening balance<input className={input} name="openingBalance" inputMode="decimal" defaultValue="0.00" required /></label>
    <label className={label}>Opening balance date<input className={input} name="openingBalanceDate" type="date" defaultValue={today} required /></label>
    <label className={label}>Currency<input className={input} name="currency" defaultValue="CAD" pattern="[A-Za-z]{3}" maxLength={3} required /></label>
    <label className={label}>Credit limit<input className={input} name="creditLimit" inputMode="decimal" placeholder="Credit cards only" /></label>
    <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2"><input type="checkbox" name="includeInNetWorth" defaultChecked /> Include in net worth</label>
    <button className={`${submit} sm:col-span-2`} type="submit">Create account</button>
  </form>;
}

export function CategoryForm() {
  return <form action={createCategory} className="grid gap-4 sm:grid-cols-3">
    <label className={label}>Name<input className={input} name="name" required maxLength={60} /></label>
    <label className={label}>Type<select className={input} name="categoryType"><option value="expense">Expense</option><option value="income">Income</option><option value="both">Both</option></select></label>
    <label className={label}>Colour<input className={`${input} p-1`} name="displayColor" type="color" defaultValue="#9865a9" /></label>
    <button className={`${submit} sm:col-span-3`} type="submit">Create custom category</button>
  </form>;
}

export function TransactionForm({ accounts, categories, today }: FormProps) {
  return <form action={createTransaction} className="grid gap-4 sm:grid-cols-2">
    <label className={label}>Direction<select className={input} name="kind"><option value="expense">Expense</option><option value="income">Income</option></select></label>
    <label className={label}>Amount<input className={input} name="amount" inputMode="decimal" min="0.0001" step="0.0001" required placeholder="0.00" /></label>
    <label className={label}>Account<select className={input} name="accountId" required defaultValue=""><option value="" disabled>Select an account</option><AccountOptions accounts={accounts} /></select></label>
    <label className={label}>Category<select className={input} name="categoryId" required defaultValue=""><option value="" disabled>Select a category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name} · {category.category_type}</option>)}</select></label>
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

export function BillForm({ accounts, categories, today }: FormProps) {
  return <form action={createBill} className="grid gap-4 sm:grid-cols-2">
    <label className={label}>Bill name<input className={input} name="name" required maxLength={100} /></label>
    <label className={label}>Expected amount<input className={input} name="expectedAmount" inputMode="decimal" min="0.0001" step="0.0001" required /></label>
    <label className={label}>Payment account<select className={input} name="accountId" defaultValue=""><option value="">Unassigned for now</option><AccountOptions accounts={accounts} /></select></label>
    <label className={label}>Currency<input className={input} name="currency" defaultValue="CAD" pattern="[A-Za-z]{3}" maxLength={3} required /></label>
    <label className={label}>Category<select className={input} name="categoryId" required defaultValue=""><option value="" disabled>Select a category</option><CategoryOptions categories={categories} type="expense" /></select></label>
    <label className={label}>Frequency<select className={input} name="frequency"><option value="weekly">Weekly</option><option value="biweekly">Biweekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label>
    <label className={label}>Schedule anchor<input className={input} name="anchorDate" type="date" defaultValue={today} required /></label>
    <label className={label}>Next due date<input className={input} name="nextDueDate" type="date" defaultValue={today} required /></label>
    <label className={label}>Reminder lead days<input className={input} name="reminderDays" type="number" min={0} max={365} defaultValue={3} required /></label>
    <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="autopay" /> Autopay</label>
    <button className={`${submit} sm:col-span-2`} type="submit">Add recurring bill</button>
  </form>;
}

export function IncomeForm({ accounts, categories, today }: FormProps) {
  return <form action={createIncome} className="grid gap-4 sm:grid-cols-2">
    <label className={label}>Income source<input className={input} name="name" required maxLength={100} /></label>
    <label className={label}>Expected amount<input className={input} name="expectedAmount" inputMode="decimal" min="0.0001" step="0.0001" required /></label>
    <label className={label}>Destination account<select className={input} name="destinationAccountId" defaultValue=""><option value="">Unassigned for now</option><AccountOptions accounts={accounts} /></select></label>
    <label className={label}>Currency<input className={input} name="currency" defaultValue="CAD" pattern="[A-Za-z]{3}" maxLength={3} required /></label>
    <label className={label}>Category (optional)<select className={input} name="categoryId" defaultValue=""><option value="">None</option><CategoryOptions categories={categories} type="income" /></select></label>
    <label className={label}>Frequency<select className={input} name="frequency"><option value="weekly">Weekly</option><option value="biweekly">Biweekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label>
    <label className={label}>Schedule anchor<input className={input} name="anchorDate" type="date" defaultValue={today} required /></label>
    <label className={label}>Next payday<input className={input} name="nextPayday" type="date" defaultValue={today} required /></label>
    <label className={label}>Reminder lead days<input className={input} name="reminderDays" type="number" min={0} max={365} defaultValue={1} required /></label>
    <button className={`${submit} sm:col-span-2`} type="submit">Add recurring income</button>
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
