import { ArchiveRestore, ChevronLeft, ChevronRight, Plus, Settings2 } from "lucide-react";
import Link from "next/link";

import { addCalendarDays } from "../shared/date-ranges";
import { cn } from "@/lib/utils";

import { CalendarItemCard } from "./calendar-item-card";
import { calendarDateForItem } from "./projection";
import { dateForInstant, eachDate, formatCalendarDate, formatCalendarTime } from "./dates";
import { layoutTimedItems } from "./overlap-layout";
import type { CalendarItem } from "./types";
import { navigateCalendarDate, type CalendarViewName } from "./view-ranges";

const control = "inline-flex min-h-10 items-center justify-center rounded-lg border bg-card px-3 text-sm font-semibold shadow-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function itemsOnCalendarDate(items: CalendarItem[], date: string, timeZone: string) {
  return items.filter((item) => item.allDay
    ? item.start.slice(0, 10) <= date && (item.end ?? item.start).slice(0, 10) >= date
    : calendarDateForItem(item, timeZone) <= date && dateForItemEnd(item, timeZone) >= date);
}

function dateForItemEnd(item: CalendarItem, timeZone: string) {
  return dateForInstant(item.end ?? item.start, timeZone);
}

function viewUrl(view: CalendarViewName, date: string) { return `/calendar?date=${date}&view=${view}`; }

function periodLabel(view: CalendarViewName, selectedDate: string, range: { start: string; end: string }) {
  if (view === "month") return formatCalendarDate(`${selectedDate.slice(0, 7)}-01`, { month: "long", year: "numeric" });
  if (view === "day") return formatCalendarDate(selectedDate, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  return `${formatCalendarDate(range.start, { month: "short", day: "numeric" })} – ${formatCalendarDate(range.end, { month: "short", day: "numeric", year: "numeric" })}`;
}

export function CalendarExperience({ items, range, selectedDate, selectedItemId, timeZone, today, view, weekStartsOn }: { items: CalendarItem[]; range: { start: string; end: string }; selectedDate: string; selectedItemId?: string; timeZone: string; today: string; view: CalendarViewName; weekStartsOn: number }) {
  const previous = navigateCalendarDate(view, selectedDate, -1);
  const next = navigateCalendarDate(view, selectedDate, 1);
  return <div className="space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-primary">Your connected timeline</p><h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Calendar</h1><p className="mt-2 text-sm text-muted-foreground">Native series and authoritative Finance schedules, projected only when needed.</p></div><div className="flex gap-2"><Link aria-label="Calendar settings and archive" className={control} href="/calendar/settings"><Settings2 className="size-4" /></Link><Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground" href={`/calendar/new?date=${selectedDate}`}><Plus className="size-4" /> Add event</Link></div></header>
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-xs"><Link aria-label={`Previous ${view}`} className={control} href={viewUrl(view, previous)}><ChevronLeft className="size-4" /></Link><Link aria-label={`Next ${view}`} className={control} href={viewUrl(view, next)}><ChevronRight className="size-4" /></Link><Link className={control} href={viewUrl(view, today)}>Today</Link><h2 className="min-w-48 flex-1 text-center text-lg font-bold">{periodLabel(view, selectedDate, range)}</h2><nav aria-label="Calendar views" className="flex max-w-full overflow-x-auto rounded-lg border p-1">{(["month","week","day","agenda"] as const).map((name) => <Link aria-current={view === name ? "page" : undefined} className={cn("rounded-md px-3 py-1.5 text-sm font-semibold capitalize", view === name ? "bg-primary text-primary-foreground" : "text-muted-foreground")} href={viewUrl(name, selectedDate)} key={name}>{name}</Link>)}</nav></div>
    {view === "month" ? <MonthView items={items} range={range} selectedDate={selectedDate} selectedItemId={selectedItemId} timeZone={timeZone} today={today} weekStartsOn={weekStartsOn} /> : null}
    {view === "week" ? <WeekView items={items} range={range} selectedDate={selectedDate} timeZone={timeZone} today={today} /> : null}
    {view === "day" ? <DayView date={selectedDate} items={items} timeZone={timeZone} today={today} /> : null}
    {view === "agenda" ? <AgendaView items={items} range={range} timeZone={timeZone} today={today} /> : null}
  </div>;
}

function MonthView({ items, range, selectedDate, selectedItemId, timeZone, today, weekStartsOn }: { items: CalendarItem[]; range: { start: string; end: string }; selectedDate: string; selectedItemId?: string; timeZone: string; today: string; weekStartsOn: number }) {
  const dates = eachDate(range); const month = selectedDate.slice(0, 7); const selectedItems = itemsOnCalendarDate(items, selectedDate, timeZone);
  const labels = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((_, index, days) => days[(index + weekStartsOn) % 7]);
  const selectedIndex = Math.max(0, dates.indexOf(selectedDate)); const stripStart = Math.max(0, Math.min(selectedIndex - 3, dates.length - 14));
  return <><div className="md:hidden"><DateStrip dates={dates.slice(stripStart, stripStart + 14)} items={items} selectedDate={selectedDate} timeZone={timeZone} today={today} view="month" /><DayAgenda date={selectedDate} items={selectedItems} selectedItemId={selectedItemId} timeZone={timeZone} today={today} /></div><div className="hidden gap-5 md:grid xl:grid-cols-[minmax(0,1fr)_22rem]"><section aria-label="Month grid" className="overflow-hidden rounded-2xl border bg-card shadow-sm"><div className="grid grid-cols-7 border-b bg-muted/50">{labels.map((label) => <div className="py-3 text-center text-xs font-bold text-muted-foreground" key={label}>{label}</div>)}</div><div className="grid grid-cols-7">{dates.map((date) => { const dateItems = itemsOnCalendarDate(items, date, timeZone); return <div className={cn("min-h-28 border-b border-r p-2", !date.startsWith(month) && "bg-muted/35 text-muted-foreground", date === selectedDate && "bg-accent/40")} key={date}><Link aria-label={`Select ${formatCalendarDate(date)}`} className={cn("mb-2 flex size-8 items-center justify-center rounded-full text-sm font-semibold", date === today && "bg-primary text-primary-foreground")} href={viewUrl("month", date)}>{Number(date.slice(8))}</Link><div className="space-y-1">{dateItems.slice(0,3).map((item) => <CalendarItemCard compact item={item} key={item.id} timeZone={timeZone} />)}{dateItems.length > 3 ? <Link className="text-xs font-semibold text-primary" href={viewUrl("day", date)}>+{dateItems.length - 3} more</Link> : null}</div></div>;})}</div></section><DayAgenda date={selectedDate} id="selected-day" items={selectedItems} selectedItemId={selectedItemId} timeZone={timeZone} today={today} /></div></>;
}

function DateStrip({ dates, items, selectedDate, timeZone, today, view }: { dates: string[]; items: CalendarItem[]; selectedDate: string; timeZone: string; today: string; view: CalendarViewName }) {
  return <div className="flex gap-2 overflow-x-auto pb-3">{dates.map((date) => <Link aria-current={date === selectedDate ? "date" : undefined} className={cn("flex min-w-16 flex-col items-center rounded-xl border px-2 py-3", date === selectedDate ? "border-primary bg-primary text-primary-foreground" : "bg-card", date === today && date !== selectedDate && "border-primary/50")} href={viewUrl(view, date)} key={date}><span className="text-xs">{formatCalendarDate(date, { weekday: "short" })}</span><span className="mt-1 text-lg font-bold">{Number(date.slice(8))}</span>{itemsOnCalendarDate(items, date, timeZone).length ? <span className="mt-1 size-1.5 rounded-full bg-current" /> : null}</Link>)}</div>;
}

function DayAgenda({ date, id, items, selectedItemId, timeZone, today }: { date: string; id?: string; items: CalendarItem[]; selectedItemId?: string; timeZone: string; today: string }) {
  return <aside className="scroll-mt-8 space-y-3" id={id}><div><h2 className="text-lg font-bold">{formatCalendarDate(date, { weekday: "long", month: "long", day: "numeric" })}</h2>{date === today ? <p className="text-xs font-bold uppercase tracking-wide text-primary">Today</p> : null}</div>{items.length ? items.map((item) => <CalendarItemCard item={item} key={item.id} open={item.id === selectedItemId} timeZone={timeZone} />) : <EmptyState text="Nothing scheduled for this day." />}</aside>;
}

function WeekView({ items, range, selectedDate, timeZone, today }: { items: CalendarItem[]; range: { start: string; end: string }; selectedDate: string; timeZone: string; today: string }) {
  const dates = eachDate(range);
  return <><div className="md:hidden"><DateStrip dates={dates} items={items} selectedDate={selectedDate} timeZone={timeZone} today={today} view="week" /><DayAgenda date={selectedDate} items={itemsOnCalendarDate(items, selectedDate, timeZone)} timeZone={timeZone} today={today} /></div><section className="hidden overflow-x-auto rounded-2xl border bg-card shadow-sm md:block" aria-label="Week schedule"><div className="min-w-[56rem]"><div className="grid grid-cols-[4rem_repeat(7,minmax(0,1fr))] border-b"><div className="p-2" />{dates.map((date) => <Link className={cn("border-l p-3 text-center", date === today && "bg-accent/40")} href={viewUrl("day", date)} key={date}><span className="block text-xs font-bold text-muted-foreground">{formatCalendarDate(date,{weekday:"short"})}</span><span className={cn("mx-auto mt-1 flex size-8 items-center justify-center rounded-full font-bold", date === today && "bg-primary text-primary-foreground")}>{Number(date.slice(8))}</span></Link>)}</div><div className="grid grid-cols-[4rem_repeat(7,minmax(0,1fr))] border-b bg-muted/25"><div className="p-2 text-xs font-bold text-muted-foreground">All day</div>{dates.map((date) => <div className="min-h-16 space-y-1 border-l p-1" key={date}>{itemsOnCalendarDate(items,date,timeZone).filter((item) => item.allDay).map((item) => <CalendarItemCard compact item={item} key={item.id} timeZone={timeZone} />)}</div>)}</div><div className="grid grid-cols-[4rem_repeat(7,minmax(0,1fr))]"><TimeLabels />{dates.map((date) => <TimelineColumn date={date} items={items} key={date} timeZone={timeZone} />)}</div></div></section></>;
}

function DayView({ date, items, timeZone, today }: { date: string; items: CalendarItem[]; timeZone: string; today: string }) {
  const dayItems = itemsOnCalendarDate(items,date,timeZone); const allDay = dayItems.filter((item) => item.allDay); const outside = layoutTimedItems(dayItems,date,timeZone).filter((item) => item.startMinute < 360 || item.startMinute >= 1380 || item.endMinute > 1380);
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]"><section className="overflow-hidden rounded-2xl border bg-card shadow-sm"><div className="border-b bg-muted/30 p-4"><h2 className="font-bold">{formatCalendarDate(date,{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</h2>{date===today?<p className="text-xs font-bold uppercase text-primary">Today</p>:null}</div>{allDay.length?<div className="space-y-2 border-b p-3"><p className="text-xs font-bold uppercase text-muted-foreground">All day</p>{allDay.map((item)=><CalendarItemCard compact item={item} key={item.id} timeZone={timeZone}/>)}</div>:null}<div className="grid grid-cols-[4rem_1fr]"><TimeLabels/><TimelineColumn date={date} items={items} timeZone={timeZone}/></div>{outside.length?<div className="border-t p-4"><p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Outside 6 AM–11 PM</p><div className="space-y-2">{outside.map(({item})=><CalendarItemCard item={item} key={item.id} timeZone={timeZone}/>)}</div></div>:null}</section><DayAgenda date={date} items={dayItems} timeZone={timeZone} today={today}/></div>;
}

function TimeLabels(){return <div className="relative h-[714px] border-r bg-muted/20">{Array.from({length:18},(_,index)=>index+6).map((hour)=><span className="absolute right-2 -translate-y-1/2 text-[0.65rem] text-muted-foreground" key={hour} style={{top:`${((hour-6)/17)*100}%`}}>{new Intl.DateTimeFormat("en-CA",{hour:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(2026,0,1,hour)))}</span>)}</div>}

function TimelineColumn({date,items,timeZone}:{date:string;items:CalendarItem[];timeZone:string}){const positioned=layoutTimedItems(items,date,timeZone).filter((entry)=>entry.startMinute>=360&&entry.startMinute<1380);return <div className="relative h-[714px] border-l bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_41px,var(--border)_42px)]">{positioned.map((entry)=>{const top=((entry.startMinute-360)/1020)*100;const height=Math.max(((Math.min(entry.endMinute,1380)-entry.startMinute)/1020)*100,2.5);return <Link className="absolute overflow-hidden rounded-md border border-primary/30 bg-accent/80 p-1 text-[0.68rem] shadow-xs hover:z-20 hover:border-primary focus:z-20" href={entry.item.sourceUrl} key={entry.item.id} style={{top:`${top}%`,height:`${height}%`,left:`calc(${(entry.column/entry.columnCount)*100}% + 2px)`,width:`calc(${100/entry.columnCount}% - 4px)`}}><span className="block truncate font-bold">{entry.item.title}</span><span className="block truncate">{formatCalendarTime(entry.item.start,timeZone)}</span></Link>})}</div>}

function AgendaView({items,range,timeZone,today}:{items:CalendarItem[];range:{start:string;end:string};timeZone:string;today:string}){const dates=eachDate(range);const populated=dates.map((date)=>({date,items:itemsOnCalendarDate(items,date,timeZone)})).filter((group)=>group.items.length);return <section className="mx-auto max-w-3xl space-y-7">{populated.length?populated.map((group)=>{const tomorrow=addCalendarDays(today,1);const heading=group.date===today?"Today":group.date===tomorrow?"Tomorrow":formatCalendarDate(group.date,{weekday:"long",month:"long",day:"numeric"});return <div className="grid gap-3 sm:grid-cols-[9rem_1fr]" key={group.date}><div><h2 className="font-bold">{heading}</h2><p className="text-xs text-muted-foreground">{formatCalendarDate(group.date,{year:"numeric"})}</p></div><div className="space-y-3">{group.items.map((item)=><CalendarItemCard item={item} key={item.id} timeZone={timeZone}/>)}</div></div>}):<EmptyState text="No items in the next 90 days."/>}<p className="text-center text-xs text-muted-foreground">Agenda is intentionally bounded to {formatCalendarDate(range.start)} through {formatCalendarDate(range.end)}.</p></section>}

function EmptyState({text}:{text:string}){return <div className="rounded-xl border border-dashed bg-muted/30 p-8 text-center"><ArchiveRestore className="mx-auto size-5 text-muted-foreground"/><p className="mt-2 text-sm font-semibold">{text}</p></div>}
