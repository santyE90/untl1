import type { GoalRecord, GoalWithRelations } from "./types";

const SCALE = 10_000n;
const HUNDRED = 100n * SCALE;
const DECIMAL = /^(\d{1,16})(?:\.(\d{1,4}))?$/;

export type GoalExact = bigint;

export function parseGoalExact(value: string): GoalExact {
  const match = DECIMAL.exec(value.trim());
  if (!match) throw new Error("Enter a non-negative number with up to four decimal places.");
  return BigInt(match[1]) * SCALE + BigInt((match[2] ?? "").padEnd(4, "0"));
}

export function goalExactToDecimal(value: GoalExact) {
  const whole = value / SCALE;
  const fraction = (value % SCALE).toString().padStart(4, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

function divideRounded(numerator: bigint, denominator: bigint) {
  if (denominator <= 0n) throw new Error("Goal target must be greater than zero.");
  return (numerator + denominator / 2n) / denominator;
}

export function goalProgress(goal: Pick<GoalRecord, "progress_mode" | "current_value_decimal" | "target_value_decimal" | "unit_label">) {
  if (goal.progress_mode === "none" || goal.current_value_decimal === null) return null;
  const current = parseGoalExact(goal.current_value_decimal);
  const target = goal.progress_mode === "numeric" && goal.target_value_decimal ? parseGoalExact(goal.target_value_decimal) : null;
  const percent = goal.progress_mode === "percentage" ? current : divideRounded(current * HUNDRED, target!);
  return { current, target, percent, exceeded: percent > HUNDRED };
}

export const getGoalProgress = goalProgress;

export function formatGoalPercent(value: GoalExact) {
  const roundedTenths = (value + 500n) / 1000n;
  return `${roundedTenths / 10n}.${roundedTenths % 10n}%`;
}

export function formatGoalValue(value: GoalExact, unit: string | null) {
  const decimal = goalExactToDecimal(value);
  if (unit?.toUpperCase() === "CAD") {
    const cents = (value + 50n) / 100n;
    const whole = cents / 100n;
    const fraction = (cents % 100n).toString().padStart(2, "0");
    return `$${new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 }).format(whole)}.${fraction} CAD`;
  }
  return unit ? `${decimal} ${unit}` : decimal;
}

export function goalProgressSummary(goal: Pick<GoalRecord, "progress_mode" | "current_value_decimal" | "target_value_decimal" | "unit_label">) {
  const progress = goalProgress(goal);
  if (!progress) return null;
  if (goal.progress_mode === "percentage") return formatGoalPercent(progress.current);
  return `${formatGoalValue(progress.current, goal.unit_label)} / ${formatGoalValue(progress.target!, goal.unit_label)} · ${formatGoalPercent(progress.percent)}`;
}

export function summarizeGoal(goal: GoalWithRelations) {
  const milestones = goal.milestones.filter((milestone) => !milestone.archived_at);
  const tasks = goal.tasks.filter((task) => !task.archived_at);
  return {
    milestoneTotal: milestones.length,
    milestonesCompleted: milestones.filter((milestone) => milestone.is_completed).length,
    taskTotal: tasks.length,
    tasksCompleted: tasks.filter((task) => task.status === "completed").length,
    openTasks: tasks.filter((task) => task.status !== "completed").length,
    progress: goalProgress(goal),
    progressSummary: goalProgressSummary(goal),
  };
}

export function sortGoals<T extends GoalRecord>(goals: T[]) {
  return [...goals].sort((a, b) => {
    if (a.status !== b.status) return a.status === "active" ? -1 : 1;
    const deadline = (a.deadline ?? "9999-12-31").localeCompare(b.deadline ?? "9999-12-31");
    return deadline || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
  });
}

export function summarizeGoals(goals: GoalWithRelations[], today: string) {
  const visible = goals.filter((goal) => !goal.archived_at);
  const active = sortGoals(visible.filter((goal) => goal.status === "active"));
  return {
    active: active.length,
    completed: visible.filter((goal) => goal.status === "completed").length,
    overdue: active.filter((goal) => goal.deadline && goal.deadline < today).length,
    upcomingDeadlines: active.filter((goal) => goal.deadline && goal.deadline >= today),
  };
}

export function formatGoalCategory(category: string) {
  return category === "health_fitness" ? "Health/Fitness" : category.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
