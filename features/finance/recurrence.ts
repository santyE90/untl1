export const frequencies = ["weekly", "biweekly", "monthly", "yearly"] as const;
export type Frequency = (typeof frequencies)[number];

function parseDate(date: string): Date {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error("Invalid calendar date.");
  }
  return parsed;
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addMonthsClamped(date: Date, months: number): Date {
  const day = date.getUTCDate();
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1, 12));
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0, 12)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export function nextOccurrence(current: string, frequency: Frequency): string {
  const date = parseDate(current);
  if (frequency === "weekly") date.setUTCDate(date.getUTCDate() + 7);
  if (frequency === "biweekly") date.setUTCDate(date.getUTCDate() + 14);
  if (frequency === "monthly") return iso(addMonthsClamped(date, 1));
  if (frequency === "yearly") return iso(addMonthsClamped(date, 12));
  return iso(date);
}
