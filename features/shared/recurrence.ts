export type CalendarFrequency = "daily" | "weekly" | "biweekly" | "monthly" | "yearly";

export function parseRecurrenceDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error("Invalid recurrence date.");
  return date;
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function clampedDate(year: number, month: number, day: number) {
  const lastDay = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay), 12));
}

export function advanceAnchoredDate(currentDate: string, frequency: CalendarFrequency, anchorDate: string): string {
  const current = parseRecurrenceDate(currentDate);
  const anchor = parseRecurrenceDate(anchorDate);
  if (frequency === "daily" || frequency === "weekly" || frequency === "biweekly") {
    current.setUTCDate(current.getUTCDate() + (frequency === "daily" ? 1 : frequency === "weekly" ? 7 : 14));
    return iso(current);
  }
  if (frequency === "monthly") return iso(clampedDate(current.getUTCFullYear(), current.getUTCMonth() + 1, anchor.getUTCDate()));
  return iso(clampedDate(current.getUTCFullYear() + 1, anchor.getUTCMonth(), anchor.getUTCDate()));
}

export function expandAnchoredDates({ anchorDate, frequency, range, until, maxOccurrences = 1000 }: { anchorDate: string; frequency: CalendarFrequency; range: { start: string; end: string }; until?: string | null; maxOccurrences?: number }) {
  parseRecurrenceDate(range.start); parseRecurrenceDate(range.end);
  if (range.end < range.start) throw new Error("Recurrence range is invalid.");
  if (until && until < anchorDate) return [];
  let candidate = anchorDate;
  let iterations = 0;
  const dates: string[] = [];
  while (candidate < range.start) {
    candidate = advanceAnchoredDate(candidate, frequency, anchorDate);
    if (++iterations > maxOccurrences) throw new Error("Recurrence expansion exceeded its safe bound.");
  }
  while (candidate <= range.end && (!until || candidate <= until)) {
    dates.push(candidate);
    candidate = advanceAnchoredDate(candidate, frequency, anchorDate);
    if (++iterations > maxOccurrences) throw new Error("Recurrence expansion exceeded its safe bound.");
  }
  return dates;
}
