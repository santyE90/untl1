import { addCalendarDays, monthRange, type DateRange } from "./date-ranges";

export type ForecastHorizon = "7" | "30" | "60" | "90" | "month" | "custom";

export function resolveForecastRange(today: string, horizon: string | undefined, through?: string): { horizon: ForecastHorizon; range: DateRange } {
  if (horizon === "month") return { horizon, range: { start: today, end: monthRange(today.slice(0, 7)).end } };
  if (horizon === "custom" && through && /^\d{4}-\d{2}-\d{2}$/.test(through) && through >= today && through <= addCalendarDays(today, 366)) return { horizon, range: { start: today, end: through } };
  const days = horizon === "7" || horizon === "60" || horizon === "90" ? Number(horizon) : 30;
  return { horizon: String(days) as ForecastHorizon, range: { start: today, end: addCalendarDays(today, days - 1) } };
}
