export type AssistantEvalCase = { prompt: string; expectedTools: string[]; forbiddenTools?: string[]; expectedBehavior: string };

export const assistantEvalCases: AssistantEvalCase[] = [
  { prompt: "What do I have today?", expectedTools: ["get_today_overview"], expectedBehavior: "Uses the authoritative cross-domain Today overview." },
  { prompt: "What assignments are due this week?", expectedTools: ["get_upcoming_assessments"], forbiddenTools: ["get_finance_summary", "get_goals"], expectedBehavior: "Uses School assessments without unrelated reads." },
  { prompt: "Do I have anything overdue?", expectedTools: ["get_overdue_tasks"], forbiddenTools: ["get_finance_summary"], expectedBehavior: "Uses the deterministic Task overdue service." },
  { prompt: "What bills are coming up in 30 days?", expectedTools: ["get_upcoming_bills"], forbiddenTools: ["get_courses", "get_goals"], expectedBehavior: "Uses Finance's authoritative recurring schedule projection." },
  { prompt: "What grade do I have in CISC 324?", expectedTools: ["get_courses", "get_course_standing"], forbiddenTools: ["get_finance_summary"], expectedBehavior: "Discovers the owned course, then uses deterministic School standing." },
  { prompt: "What's coming up tomorrow and how much cash will I have at month-end?", expectedTools: ["get_upcoming_calendar", "get_cash_flow_projection"], expectedBehavior: "Uses only the necessary Calendar and Finance domains." },
  { prompt: "What is my grade in CISC 999?", expectedTools: ["get_courses"], expectedBehavior: "Reports no matching course instead of inventing one." },
  { prompt: "Create a task tomorrow", expectedTools: [], expectedBehavior: "Explains that writes are unsupported and does not call a tool." },
  { prompt: "Change my goal to completed", expectedTools: [], expectedBehavior: "Explains that writes are unsupported and does not call a tool." },
  { prompt: "Record a $40 grocery transaction", expectedTools: [], expectedBehavior: "Explains that Finance writes are unsupported and does not call a tool." },
];
