import { addCalendarDays, type DateRange } from "../finance/date-ranges";

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function assertCalendarDate(value: string) {
  const match = DATE.exec(value);
  if (!match) throw new Error("Date must use YYYY-MM-DD.");
  const probe = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  if (probe.toISOString().slice(0, 10) !== value) throw new Error("Date is invalid.");
  return value;
}

function wallParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function zonedLocalDateTimeToUtc(value: string, timeZone: string): string {
  const match = LOCAL_DATE_TIME.exec(value);
  if (!match) throw new Error("Date and time are invalid.");
  const center = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
  const candidates: Date[] = [];
  for (let minutes = -14 * 60; minutes <= 14 * 60; minutes += 15) {
    const candidate = new Date(center + minutes * 60_000);
    if (wallParts(candidate, timeZone) === value) candidates.push(candidate);
  }
  if (!candidates.length) throw new Error("That local time does not exist in your timezone.");
  return candidates[0].toISOString();
}

export function recurringLocalDateTimeToUtc(value: string, timeZone: string): string {
  try { return zonedLocalDateTimeToUtc(value, timeZone); } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("does not exist")) throw error;
    const match = LOCAL_DATE_TIME.exec(value);
    if (!match) throw error;
    const pseudo = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
    for (let minutes = 1; minutes <= 180; minutes += 1) {
      const shifted = new Date(pseudo + minutes * 60_000).toISOString().slice(0, 16);
      try { return zonedLocalDateTimeToUtc(shifted, timeZone); } catch { /* Continue through the DST gap. */ }
    }
    throw error;
  }
}

export function instantToLocalInput(instant: string, timeZone: string) {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid instant.");
  return wallParts(date, timeZone);
}

export function dateForInstant(instant: string, timeZone: string) {
  return wallParts(new Date(instant), timeZone).slice(0, 10);
}

export function formatCalendarDate(date: string, options: Intl.DateTimeFormatOptions = {}) {
  assertCalendarDate(date);
  const chosen: Intl.DateTimeFormatOptions = Object.keys(options).length ? options : { month: "short", day: "numeric", year: "numeric" };
  return new Intl.DateTimeFormat("en-CA", { ...chosen, timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

export function formatCalendarTime(instant: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(instant));
}

export function monthGridRange(monthKey: string, weekStartsOn = 0): DateRange {
  const start = assertCalendarDate(`${monthKey}-01`);
  const first = new Date(`${start}T12:00:00Z`);
  const offset = (first.getUTCDay() - weekStartsOn + 7) % 7;
  const gridStart = addCalendarDays(start, -offset);
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12)).toISOString().slice(0, 10);
  const lastDate = new Date(`${last}T12:00:00Z`);
  const tail = (weekStartsOn + 6 - lastDate.getUTCDay() + 7) % 7;
  return { start: gridStart, end: addCalendarDays(last, tail) };
}

export function eachDate(range: DateRange) {
  const dates: string[] = [];
  for (let date = range.start; date <= range.end; date = addCalendarDays(date, 1)) dates.push(date);
  return dates;
}
