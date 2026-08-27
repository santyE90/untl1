import type { DateRange } from "./date-ranges";
import type { Frequency } from "./recurrence";

export type RecurringProjectionSource = {
  id: string;
  sourceType: "bill" | "income";
  name: string;
  amount: string;
  currency: string;
  frequency: Frequency;
  anchorDate: string;
  nextDate: string;
  accountId: string | null;
  active: boolean;
};

export type RecurringOccurrence = RecurringProjectionSource & {
  occurrenceId: string;
  date: string;
};

function parseDate(value: string) {
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

export function advanceAnchoredOccurrence(currentDate: string, frequency: Frequency, anchorDate: string): string {
  const current = parseDate(currentDate);
  const anchor = parseDate(anchorDate);
  if (frequency === "weekly" || frequency === "biweekly") {
    current.setUTCDate(current.getUTCDate() + (frequency === "weekly" ? 7 : 14));
    return iso(current);
  }
  if (frequency === "monthly") {
    return iso(clampedDate(current.getUTCFullYear(), current.getUTCMonth() + 1, anchor.getUTCDate()));
  }
  return iso(clampedDate(current.getUTCFullYear() + 1, anchor.getUTCMonth(), anchor.getUTCDate()));
}

export function expandRecurringSchedule(source: RecurringProjectionSource, range: DateRange, recordedOccurrenceIds = new Set<string>()): RecurringOccurrence[] {
  if (!source.active || source.nextDate > range.end) return [];
  parseDate(range.start);
  parseDate(range.end);
  let candidate = source.nextDate;
  const occurrences: RecurringOccurrence[] = [];
  let iterations = 0;

  while (candidate < range.start) {
    candidate = advanceAnchoredOccurrence(candidate, source.frequency, source.anchorDate);
    if (++iterations > 1000) throw new Error("Recurrence expansion exceeded its safe bound.");
  }

  while (candidate <= range.end) {
    const occurrenceId = `${source.sourceType}:${source.id}:${candidate}`;
    if (!recordedOccurrenceIds.has(occurrenceId)) occurrences.push({ ...source, occurrenceId, date: candidate });
    candidate = advanceAnchoredOccurrence(candidate, source.frequency, source.anchorDate);
    if (++iterations > 1000) throw new Error("Recurrence expansion exceeded its safe bound.");
  }
  return occurrences;
}

export function expandRecurringSchedules(sources: RecurringProjectionSource[], range: DateRange, recordedOccurrenceIds = new Set<string>()) {
  return sources.flatMap((source) => expandRecurringSchedule(source, range, recordedOccurrenceIds)).sort((a, b) =>
    a.date.localeCompare(b.date)
    || (a.sourceType === b.sourceType ? a.name.localeCompare(b.name) : a.sourceType === "bill" ? -1 : 1)
  );
}
