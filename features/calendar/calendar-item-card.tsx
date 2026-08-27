import { ArrowUpRight, Bell, CalendarDays, MapPin, ReceiptText, Repeat2, WalletCards } from "lucide-react";
import Link from "next/link";

import { formatMoney } from "@/features/finance/money";
import { cn } from "@/lib/utils";

import { formatCalendarTime } from "./dates";
import type { CalendarItem } from "./types";

export function CalendarItemCard({ compact = false, item, open = false, timeZone }: { compact?: boolean; item: CalendarItem; open?: boolean; timeZone: string }) {
  const Icon = item.sourceType === "native" ? CalendarDays : item.sourceType === "bill" ? ReceiptText : WalletCards;
  const amount = item.amount && item.currency ? `${item.amount.startsWith("+") ? "+" : "-"}${formatMoney(item.amount.replace(/^[+-]/, ""), item.currency)} ${item.currency}` : null;
  const body = <>
    <div className="flex min-w-0 items-start gap-2">
      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", item.sourceType === "bill" ? "text-financial-negative" : item.sourceType === "income" ? "text-financial-positive" : "text-primary")} />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate font-semibold", compact ? "text-xs" : "text-sm")}>{item.title}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">{item.allDay ? "All day" : formatCalendarTime(item.start, timeZone)} · {item.type}{item.recurrence ? <><Repeat2 aria-label="Recurring" className="ml-1 size-3"/><span className="sr-only">Recurring</span></> : null}{item.reminderOffsets.length ? <><Bell aria-label="Reminder configured" className="size-3"/><span className="sr-only">Reminder configured</span></> : null}</p>
      </div>
      {amount ? <p className={cn("shrink-0 text-xs font-bold", item.sourceType === "bill" ? "text-financial-negative" : "text-financial-positive")}>{amount}</p> : null}
    </div>
  </>;
  if (compact) {
    const date = item.start.slice(0, 10);
    const href = item.sourceType === "native" ? item.sourceUrl : `/calendar?month=${date.slice(0, 7)}&date=${date}&view=month&item=${encodeURIComponent(item.id)}#selected-day`;
    return <Link aria-label={`View ${item.title}`} className="block rounded-md border bg-card p-2 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={href}>{body}</Link>;
  }
  return <details className="group rounded-xl border bg-card shadow-xs" open={open || undefined}><summary className="cursor-pointer list-none p-4 [&::-webkit-details-marker]:hidden">{body}</summary><div className="space-y-3 border-t px-4 py-3 text-sm">
    {item.location ? <p className="flex gap-2 text-muted-foreground"><MapPin className="mt-0.5 size-4 shrink-0" /> {item.location}</p> : null}
    {item.description ? <p className="leading-6 text-muted-foreground">{item.description}</p> : null}
    {item.recurrence ? <p className="flex items-center gap-2 capitalize text-muted-foreground"><Repeat2 className="size-4" /> Repeats {item.recurrence.frequency} · entire series editing</p> : null}
    {item.reminderOffsets.length ? <p className="flex items-center gap-2 text-muted-foreground"><Bell className="size-4" /> {item.reminderOffsets.length} event {item.reminderOffsets.length === 1 ? "reminder" : "reminders"} configured</p> : null}
    {item.sourceType !== "native" ? <p className="text-muted-foreground">Payment account: <span className="font-medium text-foreground">{String(item.metadata.accountName ?? "Unassigned")}</span></p> : null}
    <Link className="inline-flex min-h-10 items-center gap-1 font-semibold text-primary hover:underline" href={item.sourceUrl}>{item.isEditable ? "View event" : "View in Finance"}<ArrowUpRight className="size-4" /></Link>
  </div></details>;
}
