export type CalendarSourceType = "native" | "bill" | "income" | "course_meeting" | "assessment" | "task";
export type NativeRecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";

export type CalendarItem = {
  id: string;
  sourceType: CalendarSourceType;
  sourceId: string;
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  category: string | null;
  type: string;
  description: string | null;
  location: string | null;
  amount: string | null;
  currency: string | null;
  isEditable: boolean;
  sourceUrl: string;
  recurrence: { frequency: NativeRecurrenceFrequency; occurrenceDate: string; isSeries: true } | null;
  reminderOffsets: number[];
  metadata: Record<string, string | boolean | null>;
};

export type NativeCalendarEvent = {
  id: string;
  title: string;
  eventType: string | null;
  allDay: boolean;
  startsAt: string | null;
  endsAt: string | null;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
  location: string | null;
  archivedAt: string | null;
  recurrenceFrequency: NativeRecurrenceFrequency | null;
  recurrenceUntil: string | null;
  recurrenceTimezone: string | null;
  reminderOffsets: number[];
};
