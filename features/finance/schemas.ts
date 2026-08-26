import { z } from "zod";

import { frequencies } from "./recurrence";
import { parseMoney } from "./money";

const id = z.string().uuid();
const date = z.iso.date();
const money = z.string().trim().regex(/^\d{1,15}(?:\.\d{1,4})?$/, "Enter a valid positive amount.").refine((value) => parseMoney(value) > BigInt(0), "Amount must be greater than zero.");
const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null);

export const accountSchema = z.object({
  name: z.string().trim().min(1).max(80),
  accountType: z.enum(["chequing", "savings", "credit_card", "cash", "investment", "other"]),
  customTypeName: optionalText(40),
  institution: optionalText(100),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  openingBalance: z.string().trim().regex(/^-?\d{1,15}(?:\.\d{1,4})?$/, "Enter a valid opening balance."),
  openingBalanceDate: date,
  creditLimit: optionalText(30),
  includeInNetWorth: z.boolean(),
}).superRefine((data, context) => {
  if (data.accountType === "other" && !data.customTypeName) context.addIssue({ code: "custom", path: ["customTypeName"], message: "Name the custom account type." });
  if (data.accountType !== "other" && data.customTypeName) context.addIssue({ code: "custom", path: ["customTypeName"], message: "Custom type only applies to Other." });
  if (data.creditLimit && (!/^\d{1,15}(?:\.\d{1,4})?$/.test(data.creditLimit) || parseMoney(data.creditLimit) <= BigInt(0))) context.addIssue({ code: "custom", path: ["creditLimit"], message: "Credit limit must be positive." });
  if (data.accountType !== "credit_card" && data.creditLimit) context.addIssue({ code: "custom", path: ["creditLimit"], message: "Credit limits only apply to credit cards." });
});

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(60),
  categoryType: z.enum(["expense", "income", "both"]),
  displayColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

export const transactionSchema = z.object({
  accountId: id,
  categoryId: id,
  kind: z.enum(["expense", "income"]),
  amount: money,
  transactionDate: date,
  merchant: optionalText(120),
  description: optionalText(160),
  notes: optionalText(2000),
});

export const transferSchema = z.object({
  sourceAccountId: id,
  destinationAccountId: id,
  amount: money,
  transferDate: date,
  description: optionalText(160),
  notes: optionalText(2000),
}).refine((data) => data.sourceAccountId !== data.destinationAccountId, { path: ["destinationAccountId"], message: "Choose two different accounts." });

const recurringBase = z.object({
  name: z.string().trim().min(1).max(100),
  expectedAmount: money,
  frequency: z.enum(frequencies),
  anchorDate: date,
  reminderDays: z.coerce.number().int().min(0).max(365),
});

export const billSchema = recurringBase.extend({
  accountId: id,
  categoryId: id,
  nextDueDate: date,
  autopay: z.boolean(),
});

export const incomeSchema = recurringBase.extend({
  destinationAccountId: id,
  categoryId: z.union([id, z.literal("")]).transform((value) => value || null),
  nextPayday: date,
});
