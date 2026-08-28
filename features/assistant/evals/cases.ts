export type AssistantEvalCase = { prompt: string; expectedTools: string[]; forbiddenTools?: string[]; expectedBehavior: string };

export const assistantEvalCases: AssistantEvalCase[] = [
  { prompt: "What do I have today?", expectedTools: ["get_today_overview"], expectedBehavior: "Uses the authoritative cross-domain Today overview." },
  { prompt: "What assignments are due this week?", expectedTools: ["get_upcoming_assessments"], forbiddenTools: ["get_finance_summary", "get_goals"], expectedBehavior: "Uses School assessments without unrelated reads." },
  { prompt: "Do I have anything overdue?", expectedTools: ["get_overdue_tasks"], forbiddenTools: ["get_finance_summary"], expectedBehavior: "Uses the deterministic Task overdue service." },
  { prompt: "What bills are coming up in 30 days?", expectedTools: ["get_upcoming_bills"], forbiddenTools: ["get_courses", "get_goals"], expectedBehavior: "Uses Finance's authoritative recurring schedule projection." },
  { prompt: "What grade do I have in CISC 324?", expectedTools: ["get_courses", "get_course_standing"], forbiddenTools: ["get_finance_summary"], expectedBehavior: "Discovers the owned course, then uses deterministic School standing." },
  { prompt: "What's coming up tomorrow and how much cash will I have at month-end?", expectedTools: ["get_upcoming_calendar", "get_cash_flow_projection"], expectedBehavior: "Uses only the necessary Calendar and Finance domains." },
  { prompt: "What is my grade in CISC 999?", expectedTools: ["get_courses"], expectedBehavior: "Reports no matching course instead of inventing one." },
  { prompt: "Create a task to buy groceries tomorrow.", expectedTools: ["create_task"], expectedBehavior: "Prepares a date-only create confirmation without executing it." },
  { prompt: "Make my report task urgent.", expectedTools: ["get_tasks", "update_task"], expectedBehavior: "Resolves exactly one Task and prepares an update confirmation." },
  { prompt: "Mark the groceries task complete.", expectedTools: ["get_tasks", "set_task_status"], expectedBehavior: "Resolves exactly one Task and prepares a status confirmation." },
  { prompt: "Delete my task.", expectedTools: [], expectedBehavior: "Refuses unsupported Task deletion." },
  { prompt: "Add a dentist appointment Friday from 2 to 3 PM.", expectedTools: ["create_calendar_event"], expectedBehavior: "Resolves exact local times and prepares a native timed-event confirmation." },
  { prompt: "Add Reading Week on October 12.", expectedTools: ["create_calendar_event"], expectedBehavior: "Prepares a date-only native all-day-event confirmation when the date is unambiguous." },
  { prompt: "Dentist at 2 PM Friday.", expectedTools: [], expectedBehavior: "Asks for the required end time instead of assuming a duration." },
  { prompt: "Move my dentist appointment to 4 PM.", expectedTools: ["get_upcoming_calendar", "update_calendar_event"], expectedBehavior: "Resolves exactly one native event and prepares a stale-safe update confirmation, retaining its authoritative duration only when exact endpoints can be resolved." },
  { prompt: "Move my assignment deadline to Friday.", expectedTools: ["get_upcoming_calendar"], forbiddenTools: ["update_calendar_event"], expectedBehavior: "Recognizes the School projection and refuses a Calendar-native mutation." },
  { prompt: "Delete my dentist event.", expectedTools: [], expectedBehavior: "Refuses unsupported Calendar deletion." },
  { prompt: "Make this repeat every week.", expectedTools: [], expectedBehavior: "Refuses unsupported Calendar recurrence changes." },
  { prompt: "Add a $20 transaction.", expectedTools: [], expectedBehavior: "Refuses Finance writes." },
  { prompt: "Change my goal to completed", expectedTools: [], expectedBehavior: "Explains that writes are unsupported and does not call a tool." },
];
