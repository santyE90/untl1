import { moneyToDecimal, type Money } from "../finance/money";
import type { CashFlowEntry } from "../finance/cash-flow-planning";

import { dateForInstant } from "./dates";
import type { CalendarItem, CalendarItemFor, NativeCalendarEvent } from "./types";

export function nativeEventToCalendarItem(event: NativeCalendarEvent): CalendarItemFor<"native"> {
  return {
    id: `native:${event.id}`,
    sourceType: "native",
    sourceId: event.id,
    title: event.title,
    start: event.allDay ? event.startDate! : event.startsAt!,
    end: event.allDay ? event.endDate! : event.endsAt,
    allDay: event.allDay,
    category: event.eventType,
    type: event.eventType ?? "event",
    description: event.description,
    location: event.location,
    amount: null,
    currency: null,
    isEditable: true,
    sourceUrl: `/calendar/events/${event.id}`,
    recurrence: null,
    reminderOffsets: event.reminderOffsets,
    metadata: { archived: Boolean(event.archivedAt) },
  };
}

export function financeEntryToCalendarItem(entry: CashFlowEntry, accountName: string | null): CalendarItem {
  const magnitude: Money = entry.amount < BigInt(0) ? -entry.amount : entry.amount;
  return {
    id: entry.occurrenceId,
    sourceType: entry.type,
    sourceId: entry.sourceId,
    title: entry.name,
    start: entry.date,
    end: entry.date,
    allDay: true,
    category: "Finance",
    type: entry.type === "bill" ? "Recurring bill" : "Recurring income",
    description: entry.type === "bill" ? "Projected recurring bill" : "Projected recurring income / payday",
    location: null,
    amount: `${entry.type === "bill" ? "-" : "+"}${moneyToDecimal(magnitude)}`,
    currency: entry.currency,
    isEditable: false,
    sourceUrl: "/finance#recurring",
    recurrence: null,
    reminderOffsets: [],
    metadata: { accountName: accountName ?? "Unassigned", scheduled: true },
  };
}

export function calendarDateForItem(item: CalendarItem, timeZone: string) {
  return item.allDay ? item.start.slice(0, 10) : dateForInstant(item.start, timeZone);
}

export function calendarItemOccursOnDate(item: CalendarItem, date: string, timeZone: string) {
  const start = calendarDateForItem(item, timeZone);
  const end = item.allDay ? (item.end ?? item.start).slice(0, 10) : dateForInstant(item.end ?? item.start, timeZone);
  return start <= date && end >= date;
}

export function combineCalendarItems(items: CalendarItem[], range: { start: string; end: string }, timeZone: string) {
  return items
    .filter((item) => {
      const start = calendarDateForItem(item, timeZone);
      const end = item.allDay ? (item.end ?? item.start).slice(0, 10) : dateForInstant(item.end ?? item.start, timeZone);
      return start <= range.end && end >= range.start;
    })
    .sort((a, b) => {
      const dateOrder = calendarDateForItem(a, timeZone).localeCompare(calendarDateForItem(b, timeZone));
      if (dateOrder) return dateOrder;
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      const startOrder = a.start.localeCompare(b.start);
      return startOrder || a.title.localeCompare(b.title);
    });
}
