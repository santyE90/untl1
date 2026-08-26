import { describe, expect, it } from "vitest";

import { addMoney, formatMoney, moneyToDecimal, parseMoney, signedTransactionAmount } from "./money";

describe("finance money", () => {
  it("adds decimal money without floating-point drift", () => {
    expect(moneyToDecimal(addMoney(["0.10", "0.20", "100.1234"]))).toBe("100.4234");
  });

  it("applies consistent ledger direction", () => {
    expect(signedTransactionAmount("expense", "42.50")).toBe("-42.5000");
    expect(signedTransactionAmount("income", "42.50")).toBe("42.5000");
  });

  it("derives balances including transfers and excluding pending or void rows", () => {
    const opening = parseMoney("1000");
    const posted = ["-80", "2500", "-500", "500"];
    expect(moneyToDecimal(addMoney([opening, ...posted]))).toBe("3420.0000");
    expect(moneyToDecimal(addMoney(["-500", "500"]))).toBe("0.0000");
  });

  it("keeps credit-card debt negative", () => {
    expect(moneyToDecimal(addMoney(["0", "-120.49", "50"]))).toBe("-70.4900");
  });

  it("formats large values without converting the ledger amount to a float", () => {
    expect(formatMoney("999999999999999.9999", "CAD")).toBe("$1,000,000,000,000,000.00");
  });

  it("rejects excess precision, zero directions, and malformed amounts", () => {
    expect(() => parseMoney("1.00001")).toThrow();
    expect(() => signedTransactionAmount("expense", "0")).toThrow();
    expect(() => parseMoney("12 dollars")).toThrow();
  });
});
