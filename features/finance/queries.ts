import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AuthenticatedAppContext } from "@/features/shared/server-context";

export type FinanceAccount = {
  id: string;
  name: string;
  accountType: string;
  currency: string;
  currentBalance: string;
  openingBalanceDate: string;
  includeInNetWorth: boolean;
  archivedAt: string | null;
  institution: string | null;
  customTypeName: string | null;
  creditLimit: string | null;
  openingBalance: string;
};

function financeAccount(row: { id: string | null; name: string | null; account_type: string | null; currency: string | null; current_balance: number | null; opening_balance: number | null; opening_balance_date: string | null; include_in_net_worth: boolean | null; archived_at: string | null }, detail?: { institution: string | null; custom_type_name: string | null; credit_limit: number | null }): FinanceAccount | null {
  if (!row.id || !row.name || !row.currency || !row.account_type || !row.opening_balance_date) return null;
  return { id: row.id, name: row.name, accountType: row.account_type, currency: row.currency, currentBalance: String(row.current_balance ?? 0), openingBalance: String(row.opening_balance ?? 0), openingBalanceDate: row.opening_balance_date, includeInNetWorth: row.include_in_net_worth ?? true, archivedAt: row.archived_at, institution: detail?.institution ?? null, customTypeName: detail?.custom_type_name ?? null, creditLimit: detail?.credit_limit === null || detail?.credit_limit === undefined ? null : String(detail.credit_limit) };
}

export async function getFinanceOverview(context?: AuthenticatedAppContext) {
  const supabase = context?.supabase ?? await createClient();
  const [balancesResult, accountDetailsResult, categoriesResult, transactionsResult, billsResult, incomeResult] = await Promise.all([
    supabase.from("finance_account_balances").select("*").order("archived_at", { ascending: true }).order("name"),
    supabase.from("finance_accounts").select("id,institution,custom_type_name,credit_limit"),
    supabase.from("finance_categories").select("*").order("archived_at", { ascending: true }).order("name"),
    supabase.from("finance_transactions").select("*").order("transaction_date", { ascending: false }).order("created_at", { ascending: false }).limit(50),
    supabase.from("recurring_bills").select("*").order("next_due_date").limit(20),
    supabase.from("recurring_income").select("*").order("next_payday").limit(20),
  ]);

  const error = balancesResult.error ?? accountDetailsResult.error ?? categoriesResult.error ?? transactionsResult.error ?? billsResult.error ?? incomeResult.error;
  if (error) throw new Error(`Unable to load finance data: ${error.message}`);

  const accountDetails = new Map((accountDetailsResult.data ?? []).map((row) => [row.id, row]));
  const accounts: FinanceAccount[] = (balancesResult.data ?? []).flatMap((row) => financeAccount(row, row.id ? accountDetails.get(row.id) : undefined) ?? []);

  const accountNames = new Map(accounts.map((account) => [account.id, account.name]));
  const categoryNames = new Map((categoriesResult.data ?? []).map((category) => [category.id, category.name]));

  return {
    accounts,
    categories: categoriesResult.data ?? [],
    transactions: (transactionsResult.data ?? []).map((transaction) => ({
      ...transaction,
      amount: String(transaction.amount),
      accountName: accountNames.get(transaction.account_id) ?? "Archived account",
      categoryName: transaction.category_id ? categoryNames.get(transaction.category_id) ?? "Archived category" : null,
    })),
    bills: (billsResult.data ?? []).map((bill) => ({ ...bill, expected_amount: String(bill.expected_amount), accountName: bill.account_id ? accountNames.get(bill.account_id) ?? "Archived account" : "Unassigned", categoryName: categoryNames.get(bill.category_id) ?? "Archived category" })),
    income: (incomeResult.data ?? []).map((item) => ({ ...item, expected_amount: String(item.expected_amount), accountName: item.destination_account_id ? accountNames.get(item.destination_account_id) ?? "Archived account" : "Unassigned" })),
  };
}

export async function getTransactionForEdit(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("finance_transactions").select("*").eq("id", id).neq("kind", "transfer").maybeSingle();
  if (error) throw new Error(`Unable to load transaction: ${error.message}`);
  if (!data) return null;
  const amount = String(data.amount);
  return { ...data, amount: amount.startsWith("-") ? amount.slice(1) : amount };
}

export async function getAccountBalances(context?: AuthenticatedAppContext) {
  const supabase = context?.supabase ?? await createClient();
  const { data, error } = await supabase.from("finance_account_balances").select("id,name,account_type,currency,current_balance,opening_balance,opening_balance_date,include_in_net_worth,archived_at").order("archived_at", { ascending: true }).order("name");
  if (error) throw new Error(`Unable to load account balances: ${error.message}`);
  return (data ?? []).flatMap((row) => financeAccount(row) ?? []);
}

export async function getUpcomingBills() {
  const { bills } = await getFinanceOverview();
  return bills.filter((bill) => bill.is_active);
}

export async function getNextPayday() {
  const { income } = await getFinanceOverview();
  return income.find((item) => item.is_active) ?? null;
}

export async function getMonthlySpending(startDate: string, endDate: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("finance_transactions").select("amount,category_id,transaction_date").eq("kind", "expense").eq("status", "posted").gte("transaction_date", startDate).lte("transaction_date", endDate);
  if (error) throw new Error(`Unable to load spending: ${error.message}`);
  return data.map((row) => ({ ...row, amount: String(row.amount) }));
}
