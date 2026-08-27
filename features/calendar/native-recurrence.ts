import { addCalendarDays } from "../shared/date-ranges";
import { expandAnchoredDates } from "../shared/recurrence";
import { dateForInstant, instantToLocalInput, recurringLocalDateTimeToUtc } from "./dates";
import { nativeEventToCalendarItem } from "./projection";
import type { CalendarItem, NativeCalendarEvent } from "./types";

function dayDistance(start: string, end: string) {
  return Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000);
}

export function expandNativeEvent(event: NativeCalendarEvent, range: { start: string; end: string }, displayTimeZone?: string): CalendarItem[] {
  if (event.archivedAt) return [];
  if (!event.recurrenceFrequency) return [nativeEventToCalendarItem(event)];

  const recurrenceTimeZone = event.allDay ? null : event.recurrenceTimezone;
  if (!event.allDay && !recurrenceTimeZone) throw new Error("Timed recurring event is missing its recurrence timezone.");
  const anchorDate = event.allDay ? event.startDate! : dateForInstant(event.startsAt!, recurrenceTimeZone!);
  const spanDays = event.allDay ? dayDistance(event.startDate!, event.endDate!) : Math.ceil((Date.parse(event.endsAt!) - Date.parse(event.startsAt!)) / 86_400_000);
  const expansionRange = event.allDay
    ? { start: addCalendarDays(range.start, -Math.max(spanDays, 0)), end: range.end }
    : { start: addCalendarDays(range.start, -Math.max(spanDays, 1)), end: addCalendarDays(range.end, 1) };
  const occurrenceDates = expandAnchoredDates({ anchorDate, frequency: event.recurrenceFrequency, range: expansionRange, until: event.recurrenceUntil });

  if (event.allDay) {
    const sourceSpan = dayDistance(event.startDate!, event.endDate!);
    return occurrenceDates.map((occurrenceDate) => ({
      ...nativeEventToCalendarItem(event),
      id: `native:${event.id}:${occurrenceDate}`,
      start: occurrenceDate,
      end: addCalendarDays(occurrenceDate, sourceSpan),
      sourceUrl: `/calendar/events/${event.id}?occurrence=${occurrenceDate}`,
      recurrence: { frequency: event.recurrenceFrequency!, occurrenceDate, isSeries: true as const },
      metadata: { archived: false, recurring: true },
    })).filter((item) => item.start <= range.end && (item.end ?? item.start) >= range.start);
  }

  const localStart = instantToLocalInput(event.startsAt!, recurrenceTimeZone!);
  const wallTime = localStart.slice(11);
  const duration = Date.parse(event.endsAt!) - Date.parse(event.startsAt!);
  return occurrenceDates.map((occurrenceDate) => {
    const start = recurringLocalDateTimeToUtc(`${occurrenceDate}T${wallTime}`, recurrenceTimeZone!);
    return {
      ...nativeEventToCalendarItem(event),
      id: `native:${event.id}:${occurrenceDate}`,
      start,
      end: new Date(Date.parse(start) + duration).toISOString(),
      sourceUrl: `/calendar/events/${event.id}?occurrence=${occurrenceDate}`,
      recurrence: { frequency: event.recurrenceFrequency!, occurrenceDate, isSeries: true as const },
      metadata: { archived: false, recurring: true, recurrenceTimezone: recurrenceTimeZone },
    };
  }).filter((item) => {
    const outputZone = displayTimeZone ?? recurrenceTimeZone!;
    return dateForInstant(item.start, outputZone) <= range.end && dateForInstant(item.end ?? item.start, outputZone) >= range.start;
  });
}
