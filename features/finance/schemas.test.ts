import { describe, expect, it } from "vitest";

import { accountSchema, billSchema, incomeSchema, transactionSchema, transferSchema } from "./schemas";

describe("finance validation", () => {
  it("rejects zero transactions", () => {
    expect(transactionSchema.safeParse({ accountId: crypto.randomUUID(), categoryId: crypto.randomUUID(), kind: "expense", amount: "0", transactionDate: "2026-08-26", merchant: "", description: "", notes: "" }).success).toBe(false);
  });

  it("rejects a same-account transfer", () => {
    const account = crypto.randomUUID();
    expect(transferSchema.safeParse({ sourceAccountId: account, destinationAccountId: account, amount: "50", transferDate: "2026-08-26", description: "", notes: "" }).success).toBe(false);
  });

  it("requires valid credit limits only for credit cards", () => {
    const base = { name: "Visa", accountType: "credit_card", customTypeName: "", institution: "", currency: "CAD", openingBalance: "-100", openingBalanceDate: "2026-08-01", includeInNetWorth: true };
    expect(accountSchema.safeParse({ ...base, creditLimit: "1000" }).success).toBe(true);
    expect(accountSchema.safeParse({ ...base, creditLimit: "-1" }).success).toBe(false);
  });

  it("accepts recurring schedules without accounts but still requires currency", () => {
    const common = { name: "Internet", expectedAmount: "50", frequency: "monthly", anchorDate: "2026-08-27", reminderDays: "3" };
    expect(billSchema.safeParse({ ...common, accountId: "", categoryId: crypto.randomUUID(), currency: "CAD", nextDueDate: "2026-09-21", autopay: false }).data?.accountId).toBeNull();
    expect(incomeSchema.safeParse({ ...common, destinationAccountId: "", categoryId: "", currency: "CAD", nextPayday: "2026-09-05" }).data?.destinationAccountId).toBeNull();
    expect(billSchema.safeParse({ ...common, accountId: "", categoryId: crypto.randomUUID(), currency: "", nextDueDate: "2026-09-21", autopay: false }).success).toBe(false);
  });
});
