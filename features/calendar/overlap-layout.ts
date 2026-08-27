import { dateForInstant, instantToLocalInput } from "./dates";
import type { CalendarItem } from "./types";

export type PositionedCalendarItem = { item: CalendarItem; startMinute: number; endMinute: number; column: number; columnCount: number };

export function layoutTimedItems(items: CalendarItem[], date: string, timeZone: string): PositionedCalendarItem[] {
  const candidates = items.filter((item) => !item.allDay && dateForInstant(item.start, timeZone) <= date && dateForInstant(item.end ?? item.start, timeZone) >= date).map((item) => {
    const startLocal = instantToLocalInput(item.start, timeZone);
    const endLocal = instantToLocalInput(item.end ?? item.start, timeZone);
    const startMinute = startLocal.slice(0, 10) < date ? 0 : Number(startLocal.slice(11, 13)) * 60 + Number(startLocal.slice(14, 16));
    let endMinute = Number(endLocal.slice(11, 13)) * 60 + Number(endLocal.slice(14, 16));
    if (endLocal.slice(0, 10) > date) endMinute = 1440;
    return { item, startMinute, endMinute: Math.max(endMinute, startMinute + 15) };
  }).sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute || a.item.id.localeCompare(b.item.id));

  const positioned: PositionedCalendarItem[] = [];
  let group: typeof candidates = [];
  let groupEnd = -1;
  const flush = () => {
    if (!group.length) return;
    const columnEnds: number[] = [];
    const assigned = group.map((candidate) => {
      let column = columnEnds.findIndex((end) => end <= candidate.startMinute);
      if (column === -1) column = columnEnds.length;
      columnEnds[column] = candidate.endMinute;
      return { ...candidate, column };
    });
    const columnCount = columnEnds.length;
    positioned.push(...assigned.map((item) => ({ ...item, columnCount })));
    group = [];
    groupEnd = -1;
  };
  for (const candidate of candidates) {
    if (group.length && candidate.startMinute >= groupEnd) flush();
    group.push(candidate);
    groupEnd = Math.max(groupEnd, candidate.endMinute);
  }
  flush();
  return positioned;
}
