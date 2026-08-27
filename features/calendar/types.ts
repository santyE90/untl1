export type CalendarSourceType = "native" | "bill" | "income" | "course_meeting" | "assessment" | "task" | "goal";
export type NativeRecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";

type CalendarMetadataBySource = {
  native: { archived?: boolean; recurring?: boolean; recurrenceTimezone?: string | null };
  bill: { accountName?: string; scheduled?: boolean };
  income: { accountName?: string; scheduled?: boolean };
  course_meeting: { courseCode?: string; colorKey?: string; academic?: boolean };
  assessment: { courseCode?: string; colorKey?: string; assessmentStatus?: string; academic?: boolean };
  task: { priority?: string; status?: string; assessmentId?: string | null; goalId?: string | null };
  goal: { category?: string; status?: string; progressMode?: string };
};

type CalendarItemBase = {
  id: string;
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
};

export type CalendarItemFor<Source extends CalendarSourceType> = CalendarItemBase & {
  sourceType: Source;
  metadata: CalendarMetadataBySource[Source];
};

export type CalendarItem = { [Source in CalendarSourceType]: CalendarItemFor<Source> }[CalendarSourceType];

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
