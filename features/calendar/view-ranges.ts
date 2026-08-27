import { addCalendarDays } from "../shared/date-ranges";
import { assertCalendarDate, monthGridRange } from "./dates";

export type CalendarViewName = "month" | "week" | "day" | "agenda";

export function weekRange(date: string, weekStartsOn = 0) {
  assertCalendarDate(date);
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const start = addCalendarDays(date, -((day - weekStartsOn + 7) % 7));
  return { start, end: addCalendarDays(start, 6) };
}

export function rangeForCalendarView(view: CalendarViewName, selectedDate: string, weekStartsOn = 0) {
  if (view === "month") return monthGridRange(selectedDate.slice(0, 7), weekStartsOn);
  if (view === "week") return weekRange(selectedDate, weekStartsOn);
  if (view === "day") return { start: selectedDate, end: selectedDate };
  return { start: selectedDate, end: addCalendarDays(selectedDate, 89) };
}

export function navigateCalendarDate(view: CalendarViewName, selectedDate: string, direction: -1 | 1) {
  if (view === "day") return addCalendarDays(selectedDate, direction);
  if (view === "week") return addCalendarDays(selectedDate, direction * 7);
  if (view === "agenda") return addCalendarDays(selectedDate, direction * 30);
  const date = new Date(`${selectedDate.slice(0, 7)}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + direction);
  return date.toISOString().slice(0, 10);
}
