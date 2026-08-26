"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

import { moneyToDecimal, parseMoney, signedTransactionAmount } from "./money";
import { accountSchema, billSchema, categorySchema, incomeSchema, transactionSchema, transferSchema } from "./schemas";

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
  if (error) fail(error.message);
  done("Account created.");
}

export async function archiveAccount(formData: FormData) {
  const id = text(formData, "id");
  const { supabase } = await financeContext();
  const { error } = await supabase.from("finance_accounts").update({ archived_at: new Date().toISOString() }).eq("id", id).is("archived_at", null);
  if (error) fail(error.message);
  done("Account archived.");
}

export async function createCategory(formData: FormData) {
  const parsed = categorySchema.safeParse({ name: text(formData, "name"), categoryType: text(formData, "categoryType"), displayColor: text(formData, "displayColor") });
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Check the category details.");
  const { user, supabase } = await financeContext();
  const { error } = await supabase.from("finance_categories").insert({ user_id: user.id, name: parsed.data.name, category_type: parsed.data.categoryType, display_color: parsed.data.displayColor });
  if (error) fail(error.message);
  done("Category created.");
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
  if (error) fail(error.message);
  done("Transaction added.");
}

export async function updateTransaction(formData: FormData) {
  const id = text(formData, "id");
  const parsed = transactionSchema.safeParse({ accountId: text(formData, "accountId"), categoryId: text(formData, "categoryId"), kind: text(formData, "kind"), amount: text(formData, "amount"), transactionDate: text(formData, "transactionDate"), merchant: text(formData, "merchant"), description: text(formData, "description"), notes: text(formData, "notes") });
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Check the transaction details.", `/finance/transactions/${id}/edit`);
  const data = parsed.data;
  const { supabase } = await validateTransactionParents(data.accountId, data.categoryId, data.kind, data.transactionDate);
  const { error } = await supabase.from("finance_transactions").update({ account_id: data.accountId, category_id: data.categoryId, amount: dbNumeric(signedTransactionAmount(data.kind, data.amount)), kind: data.kind, transaction_date: data.transactionDate, merchant: data.merchant, description: data.description, notes: data.notes }).eq("id", id).neq("kind", "transfer");
  if (error) fail(error.message, `/finance/transactions/${id}/edit`);
  done("Transaction updated.");
}

export async function voidTransaction(formData: FormData) {
  const { supabase } = await financeContext();
  const { error } = await supabase.from("finance_transactions").update({ status: "void" }).eq("id", text(formData, "id")).neq("kind", "transfer");
  if (error) fail(error.message);
  done("Transaction voided; its history is preserved.");
}

export async function createTransfer(formData: FormData) {
  const parsed = transferSchema.safeParse({ sourceAccountId: text(formData, "sourceAccountId"), destinationAccountId: text(formData, "destinationAccountId"), amount: text(formData, "amount"), transferDate: text(formData, "transferDate"), description: text(formData, "description"), notes: text(formData, "notes") });
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Check the transfer details.");
  const { supabase } = await financeContext();
  const data = parsed.data;
  const { error } = await supabase.rpc("create_finance_transfer", { source_account: data.sourceAccountId, destination_account: data.destinationAccountId, transfer_amount: dbNumeric(moneyToDecimal(parseMoney(data.amount))), occurred_on: data.transferDate, transfer_description: data.description, transfer_notes: data.notes });
  if (error) fail(error.message);
  done("Transfer completed atomically.");
}

export async function createBill(formData: FormData) {
  const parsed = billSchema.safeParse({ name: text(formData, "name"), expectedAmount: text(formData, "expectedAmount"), accountId: text(formData, "accountId"), categoryId: text(formData, "categoryId"), frequency: text(formData, "frequency"), anchorDate: text(formData, "anchorDate"), nextDueDate: text(formData, "nextDueDate"), reminderDays: text(formData, "reminderDays"), autopay: checked(formData, "autopay") });
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Check the bill details.");
  const { user, supabase } = await validateTransactionParents(parsed.data.accountId, parsed.data.categoryId, "expense", parsed.data.nextDueDate);
  const { data: account } = await supabase.from("finance_accounts").select("currency").eq("id", parsed.data.accountId).single();
  const { error } = await supabase.from("recurring_bills").insert({ user_id: user.id, name: parsed.data.name, expected_amount: dbNumeric(moneyToDecimal(parseMoney(parsed.data.expectedAmount))), currency: account?.currency ?? "CAD", account_id: parsed.data.accountId, category_id: parsed.data.categoryId, frequency: parsed.data.frequency, anchor_date: parsed.data.anchorDate, next_due_date: parsed.data.nextDueDate, reminder_days: parsed.data.reminderDays, autopay: parsed.data.autopay });
  if (error) fail(error.message);
  done("Recurring bill added.");
}

export async function createIncome(formData: FormData) {
  const parsed = incomeSchema.safeParse({ name: text(formData, "name"), expectedAmount: text(formData, "expectedAmount"), destinationAccountId: text(formData, "destinationAccountId"), categoryId: text(formData, "categoryId"), frequency: text(formData, "frequency"), anchorDate: text(formData, "anchorDate"), nextPayday: text(formData, "nextPayday"), reminderDays: text(formData, "reminderDays") });
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Check the income details.");
  const { user, supabase } = await financeContext();
  const { data: account } = await supabase.from("finance_accounts").select("currency,opening_balance_date,archived_at").eq("id", parsed.data.destinationAccountId).eq("user_id", user.id).maybeSingle();
  if (!account || account.archived_at || parsed.data.nextPayday < account.opening_balance_date) fail("Choose an active destination account with a compatible date.");
  if (parsed.data.categoryId) {
    const { data: category } = await supabase.from("finance_categories").select("category_type,archived_at").eq("id", parsed.data.categoryId).eq("user_id", user.id).maybeSingle();
    if (!category || category.archived_at || !["income", "both"].includes(category.category_type)) fail("Choose an income category.");
  }
  const { error } = await supabase.from("recurring_income").insert({ user_id: user.id, name: parsed.data.name, expected_amount: dbNumeric(moneyToDecimal(parseMoney(parsed.data.expectedAmount))), currency: account.currency, destination_account_id: parsed.data.destinationAccountId, category_id: parsed.data.categoryId, frequency: parsed.data.frequency, anchor_date: parsed.data.anchorDate, next_payday: parsed.data.nextPayday, reminder_days: parsed.data.reminderDays });
  if (error) fail(error.message);
  done("Recurring income added.");
}

export async function setBillActive(formData: FormData) {
  const { supabase } = await financeContext();
  const { error } = await supabase.from("recurring_bills").update({ is_active: text(formData, "active") === "true" }).eq("id", text(formData, "id"));
  if (error) fail(error.message);
  done("Bill schedule updated.");
}

export async function setIncomeActive(formData: FormData) {
  const { supabase } = await financeContext();
  const { error } = await supabase.from("recurring_income").update({ is_active: text(formData, "active") === "true" }).eq("id", text(formData, "id"));
  if (error) fail(error.message);
  done("Income schedule updated.");
}
