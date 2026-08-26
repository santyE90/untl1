import { describe, expect, it } from "vitest";

import { accountSchema, transactionSchema, transferSchema } from "./schemas";

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
});
