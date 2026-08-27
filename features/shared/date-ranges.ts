export type DateRange = { start: string; end: string };

const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;

function isoDate(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day, 12)).toISOString().slice(0, 10);
}

export function monthRange(monthKey: string): DateRange {
  const match = MONTH_KEY.exec(monthKey);
  if (!match) throw new Error("Month must use YYYY-MM.");
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  return { start: isoDate(year, monthIndex, 1), end: isoDate(year, monthIndex + 1, 0) };
}

export function previousMonthKey(monthKey: string): string {
  const start = new Date(`${monthRange(monthKey).start}T12:00:00Z`);
  start.setUTCMonth(start.getUTCMonth() - 1);
  return start.toISOString().slice(0, 7);
}

export function nextMonthKey(monthKey: string): string {
  const start = new Date(`${monthRange(monthKey).start}T12:00:00Z`);
  start.setUTCMonth(start.getUTCMonth() + 1);
  return start.toISOString().slice(0, 7);
}

export function currentMonthKey(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) throw new Error("Unable to determine the current month.");
  return `${year}-${month}`;
}

export function currentDateInTimeZone(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const year = value("year");
  const month = value("month");
  const day = value("day");
  if (!year || !month || !day) throw new Error("Unable to determine the current date.");
  return `${year}-${month}-${day}`;
}

export function daysRemainingInPeriod(today: string, range: DateRange): number {
  if (today < range.start) return Math.round((Date.parse(range.end) - Date.parse(range.start)) / 86_400_000) + 1;
  if (today > range.end) return 0;
  return Math.round((Date.parse(range.end) - Date.parse(today)) / 86_400_000) + 1;
}

export function addCalendarDays(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error("Invalid calendar date.");
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}
