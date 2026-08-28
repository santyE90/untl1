export type AnalyticsRangeDto = { key: string; label: string; start: string; end: string; bucket: "day" | "week" | "month" };
export type FinanceTrendPoint = { date: string; currency: string; income: string; expenses: string };
export type TaskTrendPoint = { date: string; completed: number };
export type CourseStandingPoint = { courseId: string; code: string; name: string; completedWorkGrade: string | null; gradedWeight: string };
export type GoalProgressItem = { id: string; title: string; status: string; deadline: string | null; mode: string; progressPercent: string | null; progressLabel: string | null };
