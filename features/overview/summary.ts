import { calendarItemOccursOnDate } from "../calendar/projection";
import type { CalendarItem, CalendarSourceType } from "../calendar/types";
import type { DateRange } from "../shared/date-ranges";

export function summarizeCalendarOverview(items: CalendarItem[], range: DateRange, today: string, timeZone: string) {
  const countsBySource = items.reduce<Partial<Record<CalendarSourceType, number>>>((counts, item) => {
    counts[item.sourceType] = (counts[item.sourceType] ?? 0) + 1;
    return counts;
  }, {});
  return {
    range,
    today,
    timeZone,
    items,
    todayItems: items.filter((item) => calendarItemOccursOnDate(item, today, timeZone)),
    countsBySource,
  };
}
