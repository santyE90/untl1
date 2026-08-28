import { moneyToDecimal, parseMoney, type Money } from "@/features/finance/money";
import { assessmentPercentage, exactToString, type GradeAssessment } from "@/features/school/grades";
import { bucketDate, dateInRange, enumerateBuckets, type AnalyticsBucket } from "./date-range";

type Range = { start: string; end: string; bucket: AnalyticsBucket };
type FinanceInput = { id: string; accountId: string; amount: string; kind: string; status: string; date: string };

export function financeTrend(transactions: FinanceInput[], accountCurrencies: Map<string, string>, range: Range) {
  const totals = new Map<string, { income: Money; expenses: Money }>();
  for (const row of transactions) {
    if (!dateInRange(row.date, range) || row.status !== "posted" || !["income", "expense"].includes(row.kind)) continue;
    const currency = accountCurrencies.get(row.accountId); if (!currency) continue;
    const key = `${currency}:${bucketDate(row.date, range)}`; const current = totals.get(key) ?? { income: 0n, expenses: 0n }; const amount = parseMoney(row.amount);
    if (row.kind === "income") current.income += amount; else current.expenses += amount < 0n ? -amount : amount;
    totals.set(key, current);
  }
  const currencies = [...new Set(accountCurrencies.values())].sort();
  return currencies.flatMap((currency) => enumerateBuckets(range).map((date) => { const value = totals.get(`${currency}:${date}`) ?? { income: 0n, expenses: 0n }; return { date, currency, income: moneyToDecimal(value.income), expenses: moneyToDecimal(value.expenses) }; }));
}

export function taskAnalytics(tasks: Array<{ status: string; priority: string; createdDate: string; completedDate: string | null; overdue: boolean; effortMinutes: number | null; archived: boolean }>, range: Range) {
  const visible = tasks.filter((task) => !task.archived); const created = visible.filter((task) => dateInRange(task.createdDate, range)); const completed = visible.filter((task) => task.status === "completed" && dateInRange(task.completedDate, range));
  const counts = new Map<string, number>(); for (const task of completed) counts.set(bucketDate(task.completedDate!, range), (counts.get(bucketDate(task.completedDate!, range)) ?? 0) + 1);
  return { created: created.length, completed: completed.length, currentlyOverdue: visible.filter((task) => task.status !== "completed" && task.overdue).length, completedEffortMinutes: completed.reduce((total, task) => total + (task.effortMinutes ?? 0), 0), completedByPriority: ["urgent", "high", "medium", "low"].map((priority) => ({ priority, count: completed.filter((task) => task.priority === priority).length })), trend: enumerateBuckets(range).map((date) => ({ date, completed: counts.get(date) ?? 0 })) };
}

export function schoolStatusAnalytics(assessments: Array<{ status: string; localDate: string; grade: GradeAssessment }>, range: Range) {
  const relevant = assessments.filter((item) => dateInRange(item.localDate, range));
  const statuses = ["graded", "submitted", "missed", "exempt", "upcoming"].map((status) => ({ status, count: relevant.filter((item) => item.status === status).length }));
  const results = relevant.flatMap((item) => { if (item.status === "exempt") return []; const percent = assessmentPercentage(item.grade); return percent === null ? [] : [{ date: item.localDate, name: item.grade.name, percentage: exactToString(percent), status: item.status }]; });
  return { statuses, graded: relevant.filter((item) => item.status === "graded").length, outcomes: relevant.filter((item) => ["graded", "submitted", "missed", "exempt"].includes(item.status)).length, results };
}

export function goalModeSummary(goals: Array<{ archived: boolean; status: string; completedDate: string | null; deadline: string | null; progressMode: string; progressPercent: string | null }>, range: Range, today: string, deadlineEnd: string) {
  const visible = goals.filter((goal) => !goal.archived);
  return { active: visible.filter((goal) => goal.status === "active").length, completed: visible.filter((goal) => goal.status === "completed" && dateInRange(goal.completedDate, range)).length, approaching: visible.filter((goal) => goal.status === "active" && goal.deadline && goal.deadline >= today && goal.deadline <= deadlineEnd).length, measured: visible.filter((goal) => goal.progressMode !== "none" && goal.progressPercent !== null).length, unmeasured: visible.filter((goal) => goal.progressMode === "none").length };
}
