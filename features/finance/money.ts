const SCALE = 4;
const SCALE_FACTOR = BigInt(10) ** BigInt(SCALE);
const MONEY_PATTERN = /^(-?)(\d{1,15})(?:\.(\d{1,4}))?$/;

export type Money = bigint;

export function parseMoney(value: string | number): Money {
  const normalized = String(value).trim();
  const match = MONEY_PATTERN.exec(normalized);

  if (!match) {
    throw new Error("Enter a valid amount with no more than four decimal places.");
  }

  const [, sign, whole, fraction = ""] = match;
  const scaled = BigInt(whole) * SCALE_FACTOR + BigInt(fraction.padEnd(SCALE, "0"));
  return sign === "-" ? -scaled : scaled;
}

export function moneyToDecimal(value: Money): string {
  const sign = value < BigInt(0) ? "-" : "";
  const absolute = value < BigInt(0) ? -value : value;
  const whole = absolute / SCALE_FACTOR;
  const fraction = (absolute % SCALE_FACTOR).toString().padStart(SCALE, "0");
  return `${sign}${whole}.${fraction}`;
}

export function addMoney(values: Array<string | number | Money>): Money {
  return values.reduce<Money>((total, value) => {
    return total + (typeof value === "bigint" ? value : parseMoney(value));
  }, BigInt(0));
}

export function multiplyMoney(value: string | number | Money, multiplier: bigint): Money {
  const parsed = typeof value === "bigint" ? value : parseMoney(value);
  return parsed * multiplier;
}

export function divideMoneyRounded(value: Money, divisor: bigint): Money {
  if (divisor <= BigInt(0)) throw new Error("Divisor must be positive.");
  const negative = value < BigInt(0);
  const absolute = negative ? -value : value;
  const quotient = (absolute + divisor / BigInt(2)) / divisor;
  return negative ? -quotient : quotient;
}

export function formatMoney(value: string | number | Money, currency = "CAD"): string {
  const scaled = typeof value === "bigint" ? value : parseMoney(value);
  const negative = scaled < BigInt(0);
  const absolute = negative ? -scaled : scaled;
  const roundedCents = (absolute + BigInt(50)) / BigInt(100);
  const whole = roundedCents / BigInt(100);
  const fraction = (roundedCents % BigInt(100)).toString().padStart(2, "0");
  const groupedWhole = new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 }).format(whole);
  const parts = new Intl.NumberFormat("en-CA", { style: "currency", currency }).formatToParts(0);
  const firstNumberPart = parts.findIndex((part) => part.type === "integer");
  const lastNumberPart = parts.findLastIndex((part) => part.type === "fraction");
  const prefix = parts.slice(0, firstNumberPart).map((part) => part.value).join("");
  const suffix = parts.slice(lastNumberPart + 1).map((part) => part.value).join("");
  const decimal = parts.find((part) => part.type === "decimal")?.value ?? ".";
  return `${negative ? "-" : ""}${prefix}${groupedWhole}${decimal}${fraction}${suffix}`;
}

export function signedTransactionAmount(kind: "expense" | "income", amount: string): string {
  const parsed = parseMoney(amount);
  if (parsed <= BigInt(0)) throw new Error("Amount must be greater than zero.");
  return moneyToDecimal(kind === "expense" ? -parsed : parsed);
}
