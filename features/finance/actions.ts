"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

import { moneyToDecimal, parseMoney, signedTransactionAmount } from "./money";
import { accountSchema, accountUpdateSchema, billSchema, categorySchema, incomeSchema, recurringAccountAssignmentSchema, transactionSchema, transferSchema } from "./schemas";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

function checked(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

function dbNumeric(value: string): number {
  // PostgREST accepts exact numeric strings. The cast is type-only; the runtime
  // value remains a string and is never converted through IEEE-754 for storage.
  return value as unknown as number;
}

function fail(message: string, destination = "/finance"): never {
  redirect(`${destination}?error=${encodeURIComponent(message)}`);
}

function done(message: string, destination = "/finance"): never {
  revalidatePath("/finance", "layout");
  redirect(`${destination}?success=${encodeURIComponent(message)}`);
}

async function financeContext() {
  const user = await requireAuthenticatedUser();
  const supabase = await createClient();
  return { user, supabase };
}

export async function createAccount(formData: FormData) {
  const parsed = accountSchema.safeParse({
    name: text(formData, "name"), accountType: text(formData, "accountType"), customTypeName: text(formData, "customTypeName"), institution: text(formData, "institution"), currency: text(formData, "currency"), openingBalance: text(formData, "openingBalance"), openingBalanceDate: text(formData, "openingBalanceDate"), creditLimit: text(formData, "creditLimit"), includeInNetWorth: checked(formData, "includeInNetWorth"),
  });
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Check the account details.");

  const { user, supabase } = await financeContext();
  const data = parsed.data;
  const { error } = await supabase.from("finance_accounts").insert({
    user_id: user.id, name: data.name, account_type: data.accountType, custom_type_name: data.customTypeName, institution: data.institution, currency: data.currency, opening_balance: dbNumeric(moneyToDecimal(parseMoney(data.openingBalance))), opening_balance_date: data.openingBalanceDate, credit_limit: data.creditLimit ? dbNumeric(moneyToDecimal(parseMoney(data.creditLimit))) : null, include_in_net_worth: data.includeInNetWorth,
  });
  if (error) fail("The account could not be created. Check its details and try again.");
  done("Account created.");
}

export async function archiveAccount(formData: FormData) {
  const id = text(formData, "id");
  const { supabase } = await financeContext();
  const { error } = await supabase.from("finance_accounts").update({ archived_at: new Date().toISOString() }).eq("id", id).is("archived_at", null);
  if (error) fail("The account could not be archived.");
  done("Account archived.");
}

export async function restoreAccount(formData: FormData) {
  const { user, supabase } = await financeContext();
  const { data, error } = await supabase.from("finance_accounts").update({ archived_at: null }).eq("id", text(formData, "id")).eq("user_id", user.id).select("id").maybeSingle();
  if (error || !data) fail("The account could not be restored.");
  done("Account restored.");
}

export async function updateAccount(formData: FormData) {
  const id = text(formData, "id");
  const parsed = accountUpdateSchema.safeParse({ name: text(formData, "name"), accountType: text(formData, "accountType"), customTypeName: text(formData, "customTypeName"), institution: text(formData, "institution"), creditLimit: text(formData, "creditLimit"), includeInNetWorth: checked(formData, "includeInNetWorth") });
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Check the account details.");
  const { user, supabase } = await financeContext();
  const data = parsed.data;
  const { data: saved, error } = await supabase.from("finance_accounts").update({ name: data.name, account_type: data.accountType, custom_type_name: data.customTypeName, institution: data.institution, credit_limit: data.creditLimit ? dbNumeric(moneyToDecimal(parseMoney(data.creditLimit))) : null, include_in_net_worth: data.includeInNetWorth }).eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
  if (error || !saved) fail("The account could not be updated. Its currency and opening balance remain ledger-safe and unchanged.");
  done("Account details updated.");
}

export async function deleteUnusedAccount(formData: FormData) {
  const { supabase } = await financeContext();
  const { error } = await supabase.rpc("delete_unused_finance_account", { owned_account_id: text(formData, "id") });
  if (error) fail("This account has transactions, transfers, or recurring schedules. Archive it instead to preserve financial history.");
  done("Unused account permanently deleted.");
}

export async function createCategory(formData: FormData) {
  const id = text(formData, "id");
  const parsed = categorySchema.safeParse({ name: text(formData, "name"), categoryType: text(formData, "categoryType"), displayColor: text(formData, "displayColor") });
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Check the category details.");
  const { user, supabase } = await financeContext();
  const values = { name: parsed.data.name, category_type: parsed.data.categoryType, display_color: parsed.data.displayColor };
  const result = id
    ? await supabase.from("finance_categories").update(values).eq("id", id).eq("user_id", user.id).eq("is_default", false).select("id").maybeSingle()
    : await supabase.from("finance_categories").insert({ user_id: user.id, ...values }).select("id").single();
  if (result.error || !result.data) fail("The category could not be saved. A category with that name may already exist.");
  done(id ? "Custom category updated." : "Category created.");
}

export async function archiveCategory(formData: FormData) {
  const { user, supabase } = await financeContext();
  const { data, error } = await supabase.from("finance_categories").update({ archived_at: new Date().toISOString() }).eq("id", text(formData, "id")).eq("user_id", user.id).eq("is_default", false).select("id").maybeSingle();
  if (error || !data) fail("The custom category could not be archived.");
  done("Custom category archived. Historical transactions keep their category reference.");
}

export async function restoreCategory(formData: FormData) {
  const { user, supabase } = await financeContext();
  const { data, error } = await supabase.from("finance_categories").update({ archived_at: null }).eq("id", text(formData, "id")).eq("user_id", user.id).eq("is_default", false).select("id").maybeSingle();
  if (error || !data) fail("The custom category could not be restored. Another active category may use that name.");
  done("Custom category restored.");
}

async function validateTransactionParents(accountId: string, categoryId: string, kind: "expense" | "income", date: string) {
  const { user, supabase } = await financeContext();
  const [accountResult, categoryResult] = await Promise.all([
    supabase.from("finance_accounts").select("id,opening_balance_date,archived_at").eq("id", accountId).eq("user_id", user.id).maybeSingle(),
    supabase.from("finance_categories").select("id,category_type,archived_at").eq("id", categoryId).eq("user_id", user.id).maybeSingle(),
  ]);
  const account = accountResult.data;
  const category = categoryResult.data;
  if (!account || account.archived_at) fail("Choose an active account.");
  if (date < account.opening_balance_date) fail("Transaction date cannot be before the account opening date.");
  if (!category || category.archived_at || (category.category_type !== "both" && category.category_type !== kind)) fail(`Choose a ${kind} category.`);
  return { user, supabase };
}

export async function createTransaction(formData: FormData) {
  const parsed = transactionSchema.safeParse({ accountId: text(formData, "accountId"), categoryId: text(formData, "categoryId"), kind: text(formData, "kind"), amount: text(formData, "amount"), transactionDate: text(formData, "transactionDate"), merchant: text(formData, "merchant"), description: text(formData, "description"), notes: text(formData, "notes") });
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Check the transaction details.");
  const data = parsed.data;
  const { user, supabase } = await validateTransactionParents(data.accountId, data.categoryId, data.kind, data.transactionDate);
  const { error } = await supabase.from("finance_transactions").insert({ user_id: user.id, account_id: data.accountId, category_id: data.categoryId, amount: dbNumeric(signedTransactionAmount(data.kind, data.amount)), kind: data.kind, status: "posted", transaction_date: data.transactionDate, merchant: data.merchant, description: data.description, notes: data.notes });
  if (error) fail("The transaction could not be added. Check its account, category, and date.");
  done("Transaction added.");
}

export async function updateTransaction(formData: FormData) {
  const id = text(formData, "id");
  const parsed = transactionSchema.safeParse({ accountId: text(formData, "accountId"), categoryId: text(formData, "categoryId"), kind: text(formData, "kind"), amount: text(formData, "amount"), transactionDate: text(formData, "transactionDate"), merchant: text(formData, "merchant"), description: text(formData, "description"), notes: text(formData, "notes") });
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Check the transaction details.", `/finance/transactions/${id}/edit`);
  const data = parsed.data;
  const { supabase } = await validateTransactionParents(data.accountId, data.categoryId, data.kind, data.transactionDate);
  const { error } = await supabase.from("finance_transactions").update({ account_id: data.accountId, category_id: data.categoryId, amount: dbNumeric(signedTransactionAmount(data.kind, data.amount)), kind: data.kind, transaction_date: data.transactionDate, merchant: data.merchant, description: data.description, notes: data.notes }).eq("id", id).neq("kind", "transfer");
  if (error) fail("The transaction could not be updated.", `/finance/transactions/${id}/edit`);
  done("Transaction updated.");
}

export async function voidTransaction(formData: FormData) {
  const { supabase } = await financeContext();
  const { error } = await supabase.from("finance_transactions").update({ status: "void" }).eq("id", text(formData, "id")).neq("kind", "transfer");
  if (error) fail("The transaction could not be voided.");
  done("Transaction voided; its history is preserved.");
}

export async function createTransfer(formData: FormData) {
  const parsed = transferSchema.safeParse({ sourceAccountId: text(formData, "sourceAccountId"), destinationAccountId: text(formData, "destinationAccountId"), amount: text(formData, "amount"), transferDate: text(formData, "transferDate"), description: text(formData, "description"), notes: text(formData, "notes") });
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Check the transfer details.");
  const { supabase } = await financeContext();
  const data = parsed.data;
  const { error } = await supabase.rpc("create_finance_transfer", { source_account: data.sourceAccountId, destination_account: data.destinationAccountId, transfer_amount: dbNumeric(moneyToDecimal(parseMoney(data.amount))), occurred_on: data.transferDate, transfer_description: data.description ?? undefined, transfer_notes: data.notes ?? undefined });
  if (error) fail("The transfer could not be completed. Check both accounts, their currencies, and the transfer date.");
  done("Transfer completed atomically.");
}

export async function createBill(formData: FormData) {
  const id = text(formData, "id");
  const parsed = billSchema.safeParse({ name: text(formData, "name"), expectedAmount: text(formData, "expectedAmount"), accountId: text(formData, "accountId"), categoryId: text(formData, "categoryId"), currency: text(formData, "currency"), frequency: text(formData, "frequency"), anchorDate: text(formData, "anchorDate"), nextDueDate: text(formData, "nextDueDate"), reminderDays: text(formData, "reminderDays"), autopay: checked(formData, "autopay") });
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Check the bill details.");
  const { user, supabase } = await financeContext();
  const { data: category } = await supabase.from("finance_categories").select("category_type,archived_at").eq("id", parsed.data.categoryId).eq("user_id", user.id).maybeSingle();
  if (!category || category.archived_at || !["expense", "both"].includes(category.category_type)) fail("Choose an expense category.");
  if (parsed.data.accountId) {
    const { data: account } = await supabase.from("finance_accounts").select("currency,opening_balance_date,archived_at").eq("id", parsed.data.accountId).eq("user_id", user.id).maybeSingle();
    if (!account || account.archived_at || account.currency !== parsed.data.currency || parsed.data.nextDueDate < account.opening_balance_date) fail("Choose an active account with the same currency and a compatible date.");
  }
  const values = { name: parsed.data.name, expected_amount: dbNumeric(moneyToDecimal(parseMoney(parsed.data.expectedAmount))), account_id: parsed.data.accountId, category_id: parsed.data.categoryId, frequency: parsed.data.frequency, anchor_date: parsed.data.anchorDate, next_due_date: parsed.data.nextDueDate, reminder_days: parsed.data.reminderDays, autopay: parsed.data.autopay };
  const result = id
    ? await supabase.from("recurring_bills").update(values).eq("id", id).eq("user_id", user.id).eq("currency", parsed.data.currency).select("id").maybeSingle()
    : await supabase.from("recurring_bills").insert({ user_id: user.id, currency: parsed.data.currency, ...values }).select("id").single();
  if (result.error || !result.data) fail("The recurring bill could not be saved. Check its account, category, currency, and dates.");
  done(id ? "Recurring bill updated." : "Recurring bill added.");
}

export async function createIncome(formData: FormData) {
  const id = text(formData, "id");
  const parsed = incomeSchema.safeParse({ name: text(formData, "name"), expectedAmount: text(formData, "expectedAmount"), destinationAccountId: text(formData, "destinationAccountId"), categoryId: text(formData, "categoryId"), currency: text(formData, "currency"), frequency: text(formData, "frequency"), anchorDate: text(formData, "anchorDate"), nextPayday: text(formData, "nextPayday"), reminderDays: text(formData, "reminderDays") });
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Check the income details.");
  const { user, supabase } = await financeContext();
  if (parsed.data.destinationAccountId) {
    const { data: account } = await supabase.from("finance_accounts").select("currency,opening_balance_date,archived_at").eq("id", parsed.data.destinationAccountId).eq("user_id", user.id).maybeSingle();
    if (!account || account.archived_at || account.currency !== parsed.data.currency || parsed.data.nextPayday < account.opening_balance_date) fail("Choose an active destination account with the same currency and a compatible date.");
  }
  if (parsed.data.categoryId) {
    const { data: category } = await supabase.from("finance_categories").select("category_type,archived_at").eq("id", parsed.data.categoryId).eq("user_id", user.id).maybeSingle();
    if (!category || category.archived_at || !["income", "both"].includes(category.category_type)) fail("Choose an income category.");
  }
  const values = { name: parsed.data.name, expected_amount: dbNumeric(moneyToDecimal(parseMoney(parsed.data.expectedAmount))), destination_account_id: parsed.data.destinationAccountId, category_id: parsed.data.categoryId, frequency: parsed.data.frequency, anchor_date: parsed.data.anchorDate, next_payday: parsed.data.nextPayday, reminder_days: parsed.data.reminderDays };
  const result = id
    ? await supabase.from("recurring_income").update(values).eq("id", id).eq("user_id", user.id).eq("currency", parsed.data.currency).select("id").maybeSingle()
    : await supabase.from("recurring_income").insert({ user_id: user.id, currency: parsed.data.currency, ...values }).select("id").single();
  if (result.error || !result.data) fail("The recurring income schedule could not be saved. Check its account, category, currency, and dates.");
  done(id ? "Recurring income updated." : "Recurring income added.");
}

export async function deleteRecurringSchedule(formData: FormData) {
  const sourceType = text(formData, "sourceType");
  const { supabase } = await financeContext();
  const result = sourceType === "bill"
    ? await supabase.rpc("delete_recurring_bill", { owned_bill_id: text(formData, "id") })
    : sourceType === "income"
      ? await supabase.rpc("delete_recurring_income", { owned_income_id: text(formData, "id") })
      : null;
  if (!result || result.error) fail("The recurring schedule could not be deleted. No posted transaction was changed.");
  done(sourceType === "bill" ? "Recurring bill deleted. Posted ledger entries were preserved." : "Recurring income deleted. Posted ledger entries were preserved.");
}

export async function setBillActive(formData: FormData) {
  const { supabase } = await financeContext();
  const { error } = await supabase.from("recurring_bills").update({ is_active: text(formData, "active") === "true" }).eq("id", text(formData, "id"));
  if (error) fail("The bill schedule could not be updated.");
  done("Bill schedule updated.");
}

export async function setIncomeActive(formData: FormData) {
  const { supabase } = await financeContext();
  const { error } = await supabase.from("recurring_income").update({ is_active: text(formData, "active") === "true" }).eq("id", text(formData, "id"));
  if (error) fail("The income schedule could not be updated.");
  done("Income schedule updated.");
}

export async function assignRecurringAccount(formData: FormData) {
  const parsed = recurringAccountAssignmentSchema.safeParse({ sourceType: text(formData, "sourceType"), sourceId: text(formData, "sourceId"), accountId: text(formData, "accountId") });
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Choose a valid account.");
  const { user, supabase } = await financeContext();
  const scheduleQuery = parsed.data.sourceType === "bill"
    ? supabase.from("recurring_bills").select("currency").eq("id", parsed.data.sourceId).eq("user_id", user.id).maybeSingle()
    : supabase.from("recurring_income").select("currency").eq("id", parsed.data.sourceId).eq("user_id", user.id).maybeSingle();
  const { data: schedule } = await scheduleQuery;
  if (!schedule) fail("Schedule not found.");
  if (parsed.data.accountId) {
    const { data: account } = await supabase.from("finance_accounts").select("currency,archived_at").eq("id", parsed.data.accountId).eq("user_id", user.id).maybeSingle();
    if (!account || account.archived_at || account.currency !== schedule.currency) fail("Choose an active account using the schedule currency.");
  }
  const result = parsed.data.sourceType === "bill"
    ? await supabase.from("recurring_bills").update({ account_id: parsed.data.accountId }).eq("id", parsed.data.sourceId)
    : await supabase.from("recurring_income").update({ destination_account_id: parsed.data.accountId }).eq("id", parsed.data.sourceId);
  if (result.error) fail("The schedule account assignment could not be saved.");
  done(parsed.data.accountId ? "Schedule account assigned." : "Schedule marked unassigned.");
}
