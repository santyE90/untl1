export function decimalScaleFactor(scale: number) {
  if (!Number.isInteger(scale) || scale < 0 || scale > 12) throw new Error("Decimal scale is invalid.");
  return 10n ** BigInt(scale);
}

export function parseScaledDecimal(value: string | number, options: { scale: number; maxWholeDigits: number; allowNegative?: boolean }) {
  const normalized = String(value).trim();
  const signPattern = options.allowNegative ? "(-?)" : "()";
  const pattern = new RegExp(`^${signPattern}(\\d{1,${options.maxWholeDigits}})(?:\\.(\\d{1,${options.scale}}))?$`);
  const match = pattern.exec(normalized);
  if (!match) throw new Error(`Enter a valid number with no more than ${options.scale} decimal places.`);
  const [, sign, whole, fraction = ""] = match;
  const scaled = BigInt(whole) * decimalScaleFactor(options.scale) + BigInt(fraction.padEnd(options.scale, "0"));
  return sign === "-" ? -scaled : scaled;
}

export function scaledDecimalToFixed(value: bigint, scale: number) {
  const factor = decimalScaleFactor(scale);
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / factor}.${(absolute % factor).toString().padStart(scale, "0")}`;
}

export function divideRounded(numerator: bigint, denominator: bigint) {
  if (denominator === 0n) throw new Error("Cannot divide by zero.");
  const negative = numerator < 0n !== denominator < 0n;
  const absoluteNumerator = numerator < 0n ? -numerator : numerator;
  const absoluteDenominator = denominator < 0n ? -denominator : denominator;
  const result = (absoluteNumerator + absoluteDenominator / 2n) / absoluteDenominator;
  return negative ? -result : result;
}
