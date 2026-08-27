import { describe, expect, it } from "vitest";

import { divideRounded, parseScaledDecimal, scaledDecimalToFixed } from "./exact-decimal";

describe("shared exact-decimal primitives", () => {
  it("parses domain-configured signed and unsigned scales", () => {
    expect(parseScaledDecimal("12.3456", { scale: 4, maxWholeDigits: 8 })).toBe(123456n);
    expect(parseScaledDecimal("-1.25", { scale: 4, maxWholeDigits: 15, allowNegative: true })).toBe(-12500n);
    expect(() => parseScaledDecimal("1.00001", { scale: 4, maxWholeDigits: 8 })).toThrow();
  });

  it("formats fixed values and rounds ratios symmetrically", () => {
    expect(scaledDecimalToFixed(-12500n, 4)).toBe("-1.2500");
    expect(divideRounded(5n, 2n)).toBe(3n);
    expect(divideRounded(-5n, 2n)).toBe(-3n);
  });
});
