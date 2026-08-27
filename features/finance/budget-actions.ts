"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

import { moneyToDecimal, parseMoney } from "./money";
import { budgetSchema } from "./schemas";

function dbNumeric(value: string): number {
  return value as unknown as number;
}

function fail(message: string, month: string): never {
  redirect(`/finance/budget?month=${encodeURIComponent(month)}&error=${encodeURIComponent(message)}`);
}

export async function saveMonthlyBudget(formData: FormData) {
  const month = String(formData.get("month") ?? "");
  const parsed = budgetSchema.safeParse({ month, currency: String(formData.get("currency") ?? ""), overallLimit: String(formData.get("overallLimit") ?? ""), notes: String(formData.get("notes") ?? "") });
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Check the budget details.", month);

  const categoryLimits: Record<string, string> = {};
  for (const [key, rawValue] of formData.entries()) {
    if (!key.startsWith("category:")) continue;
    const value = String(rawValue).trim();
    if (!value) continue;
    const categoryId = key.slice("category:".length);
    try {
      const amount = parseMoney(value);
      if (amount <= BigInt(0)) fail("Category limits must be greater than zero.", month);
      categoryLimits[categoryId] = moneyToDecimal(amount);
    } catch {
      fail("Enter valid category limits with no more than four decimal places.", month);
    }
  }

  await requireAuthenticatedUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_monthly_finance_budget", {
    budget_month: `${parsed.data.month}-01`,
    budget_currency: parsed.data.currency,
    overall_amount: dbNumeric(moneyToDecimal(parseMoney(parsed.data.overallLimit))),
    budget_notes: parsed.data.notes ?? undefined,
    category_limits: categoryLimits,
  });
  if (error) fail(error.message, month);

  revalidatePath("/finance", "layout");
  redirect(`/finance/budget?month=${parsed.data.month}&currency=${parsed.data.currency}&success=${encodeURIComponent("Budget saved.")}`);
}
