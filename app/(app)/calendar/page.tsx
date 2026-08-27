import type { Metadata } from "next";
import { CalendarExperience } from "@/features/calendar/calendar-experience";
import { assertCalendarDate } from "@/features/calendar/dates";
import { getCalendarContext, getCalendarItems } from "@/features/calendar/queries";
import { rangeForCalendarView, type CalendarViewName } from "@/features/calendar/view-ranges";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; date?: string; view?: string; item?: string; error?: string; success?: string }> }) {
  const params = await searchParams;
  const context = await getCalendarContext();
  let selectedDate = params.date ?? (params.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month) ? `${params.month}-01` : context.today);
  try { assertCalendarDate(selectedDate); } catch { selectedDate = context.today; }
  const requestedView = params.view as CalendarViewName | undefined;
  const view: CalendarViewName = requestedView && ["month", "week", "day", "agenda"].includes(requestedView) ? requestedView : context.defaultView;
  const range = rangeForCalendarView(view, selectedDate, context.weekStartsOn);
  const items = await getCalendarItems(range, context);

  return <>
    {params.error ? <p className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{params.error}</p> : null}
    {params.success ? <p className="mb-4 rounded-lg bg-success/10 p-3 text-sm text-success" role="status">{params.success}</p> : null}
    <CalendarExperience items={items} range={range} selectedDate={selectedDate} selectedItemId={params.item} timeZone={context.timeZone} today={context.today} view={view} weekStartsOn={context.weekStartsOn} />
  </>;
}
