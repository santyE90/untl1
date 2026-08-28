import { assertCalendarDate, dateForInstant } from "@/features/calendar/dates";
import { monthRange, previousMonthKey } from "@/features/finance/date-ranges";
import { addCalendarDays } from "@/features/shared/date-ranges";

export const analyticsPresetRangeKeys = ["last_7", "last_30", "last_90", "this_month", "previous_month"] as const;
export type AnalyticsPresetRangeKey = (typeof analyticsPresetRangeKeys)[number];
export type AnalyticsRangeKey = AnalyticsPresetRangeKey | "custom";
export type AnalyticsBucket = "day" | "week" | "month";
export type AnalyticsRange = { key: AnalyticsRangeKey; label: string; start: string; end: string; bucket: AnalyticsBucket };

export const analyticsRangeOptions: Array<{ key: AnalyticsRangeKey; label: string }> = [
  { key: "last_7", label: "Last 7 days" }, { key: "last_30", label: "Last 30 days" }, { key: "last_90", label: "Last 90 days" }, { key: "this_month", label: "This month" }, { key: "previous_month", label: "Previous month" }, { key: "custom", label: "Custom" },
];

export const MAX_CUSTOM_ANALYTICS_DAYS = 366;

export function parseAnalyticsRangeKey(value: unknown): AnalyticsPresetRangeKey {
  return analyticsPresetRangeKeys.includes(value as AnalyticsPresetRangeKey) ? value as AnalyticsPresetRangeKey : "last_30";
}

export function getAnalyticsRange(key: AnalyticsPresetRangeKey, today: string): AnalyticsRange {
  const currentMonth = today.slice(0, 7);
  const range = key === "last_7" ? { start: addCalendarDays(today, -6), end: today }
    : key === "last_30" ? { start: addCalendarDays(today, -29), end: today }
      : key === "last_90" ? { start: addCalendarDays(today, -89), end: today }
        : key === "this_month" ? { ...monthRange(currentMonth), end: today }
          : monthRange(previousMonthKey(currentMonth));
  return { key, label: analyticsRangeOptions.find((item) => item.key === key)!.label, ...range, bucket: key === "last_90" ? "week" : "day" };
}

function safeDateInput(value: unknown) { return typeof value === "string" && value.length <= 10 ? value : ""; }
function inclusiveDays(start: string, end: string) { return Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000) + 1; }

export function resolveAnalyticsRange(query: { range?: unknown; from?: unknown; to?: unknown }, today: string): { range: AnalyticsRange; selectedKey: AnalyticsRangeKey; customFrom: string; customTo: string; error: string | null } {
  if (query.range !== "custom") {
    const key = parseAnalyticsRangeKey(query.range);
    return { range: getAnalyticsRange(key, today), selectedKey: key, customFrom: "", customTo: "", error: null };
  }
  const from = safeDateInput(query.from); const to = safeDateInput(query.to); const fallback = getAnalyticsRange("last_30", today);
  if (!from || !to) return { range: fallback, selectedKey: "custom", customFrom: from, customTo: to, error: "Choose both a From and To date. Showing the last 30 days for now." };
  try { assertCalendarDate(from); assertCalendarDate(to); } catch { return { range: fallback, selectedKey: "custom", customFrom: from, customTo: to, error: "Enter valid dates in YYYY-MM-DD format. Showing the last 30 days for now." }; }
  if (from > to) return { range: fallback, selectedKey: "custom", customFrom: from, customTo: to, error: "From must be on or before To. Showing the last 30 days for now." };
  const days = inclusiveDays(from, to);
  if (days > MAX_CUSTOM_ANALYTICS_DAYS) return { range: fallback, selectedKey: "custom", customFrom: from, customTo: to, error: `Custom ranges can include at most ${MAX_CUSTOM_ANALYTICS_DAYS} days. Showing the last 30 days for now.` };
  const bucket: AnalyticsBucket = days <= 31 ? "day" : days <= 120 ? "week" : "month";
  return { range: { key: "custom", label: "Custom", start: from, end: to, bucket }, selectedKey: "custom", customFrom: from, customTo: to, error: null };
}

export function dateInRange(date: string | null, range: { start: string; end: string }) { return Boolean(date && date >= range.start && date <= range.end); }
export function analyticsLocalDate(instant: string, timeZone: string) { return dateForInstant(instant, timeZone); }

function firstOfNextMonth(date: string) { const [year, month] = date.split("-").map(Number); return new Date(Date.UTC(year, month, 1, 12)).toISOString().slice(0, 10); }

export function bucketDate(date: string, range: { start: string; end: string; bucket: AnalyticsBucket }) {
  if (range.bucket === "day") return date;
  if (range.bucket === "month") { const monthStart = `${date.slice(0, 7)}-01`; return monthStart <= range.start ? range.start : monthStart; }
  const difference = Math.floor((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${range.start}T12:00:00Z`)) / 86_400_000);
  return addCalendarDays(range.start, Math.floor(difference / 7) * 7);
}

export function enumerateBuckets(range: { start: string; end: string; bucket: AnalyticsBucket }) {
  const values: string[] = [];
  if (range.bucket === "month") { for (let date = range.start; date <= range.end; date = firstOfNextMonth(date)) { values.push(date); if (date.slice(0, 7) === range.end.slice(0, 7)) break; } return values; }
  const step = range.bucket === "week" ? 7 : 1;
  for (let date = range.start; date <= range.end; date = addCalendarDays(date, step)) values.push(date);
  return values;
}
