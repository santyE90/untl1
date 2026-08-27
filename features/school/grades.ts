const SCALE = 10_000n;
const HUNDRED = 100n * SCALE;
const DECIMAL = /^(\d{1,8})(?:\.(\d{1,4}))?$/;
export type Exact = bigint;

export function parseExact(value: string | number): Exact {
  const match = DECIMAL.exec(String(value).trim());
  if (!match) throw new Error("Enter a non-negative number with up to four decimal places.");
  return BigInt(match[1]) * SCALE + BigInt((match[2] ?? "").padEnd(4, "0"));
}

export function exactToString(value: Exact) {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / SCALE}.${(absolute % SCALE).toString().padStart(4, "0")}`;
}

export function formatPercent(value: Exact | null, decimals = 1) {
  if (value === null) return "—";
  const places = Math.min(4, Math.max(0, decimals));
  const divisor = 10n ** BigInt(4 - places);
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  const rounded = (absolute + divisor / 2n) / divisor;
  if (!places) return `${sign}${rounded}%`;
  const base = 10n ** BigInt(places);
  return `${sign}${rounded / base}.${(rounded % base).toString().padStart(places, "0")}%`;
}

function divideRounded(numerator: bigint, denominator: bigint) {
  if (denominator === 0n) throw new Error("Cannot divide by zero.");
  const sign = numerator < 0n !== denominator < 0n ? -1n : 1n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  return sign * ((n + d / 2n) / d);
}

export type GradeAssessment = { id: string; name: string; weight: string; scoreEarned: string | null; scoreMax: string | null; status: string };

export function assessmentPercentage(item: GradeAssessment): Exact | null {
  if (item.status === "missed") return 0n;
  if (item.status !== "graded" || item.scoreEarned === null || item.scoreMax === null) return null;
  const maximum = parseExact(item.scoreMax);
  if (maximum <= 0n) return null;
  return divideRounded(parseExact(item.scoreEarned) * HUNDRED, maximum);
}

export function calculateCourseGrade(items: GradeAssessment[]) {
  let configuredWeight = 0n;
  let gradedWeight = 0n;
  let earnedCoursePoints = 0n;
  for (const item of items) {
    if (item.status === "exempt") continue;
    const weight = parseExact(item.weight);
    configuredWeight += weight;
    const percentage = assessmentPercentage(item);
    if (percentage !== null) {
      gradedWeight += weight;
      earnedCoursePoints += divideRounded(percentage * weight, HUNDRED);
    }
  }
  return {
    configuredWeight,
    gradedWeight,
    remainingConfiguredWeight: configuredWeight - gradedWeight,
    remainingCourseWeight: HUNDRED - gradedWeight,
    earnedCoursePoints,
    completedWorkGrade: gradedWeight ? divideRounded(earnedCoursePoints * HUNDRED, gradedWeight) : null,
    weightDelta: configuredWeight - HUNDRED,
  };
}

export function calculateRequiredGrade(currentPoints: Exact, assessmentWeight: Exact, target: Exact) {
  if (assessmentWeight <= 0n) return { required: null, reason: "Selected assessment has no weight." };
  const required = divideRounded((target - currentPoints) * HUNDRED, assessmentWeight);
  return { required, reason: required > HUNDRED ? "Target requires more than 100% on this assessment." : required < 0n ? "Target is already secured without points from this assessment." : null };
}

export function calculateScenario(currentPoints: Exact, assessmentWeight: Exact, score: Exact) {
  return currentPoints + divideRounded(score * assessmentWeight, HUNDRED);
}

export type TargetStanding = "missing_target" | "achievable" | "already_secured" | "impossible" | "no_remaining";

export function calculateRequiredRemainingAverage(earnedPoints: Exact, remainingWeight: Exact, target: Exact) {
  const pointsStillNeeded = target - earnedPoints;
  if (pointsStillNeeded <= 0n) return { requiredAverage: 0n, pointsStillNeeded: 0n, standing: "already_secured" as const };
  if (remainingWeight <= 0n) return { requiredAverage: null, pointsStillNeeded, standing: "no_remaining" as const };
  const requiredAverage = divideRounded(pointsStillNeeded * HUNDRED, remainingWeight);
  return { requiredAverage, pointsStillNeeded, standing: requiredAverage > HUNDRED ? "impossible" as const : "achievable" as const };
}

export function calculateCourseTarget(items: GradeAssessment[], targetValue: string | null) {
  const grade = calculateCourseGrade(items);
  if (!targetValue) return { ...grade, target: null, requiredAverage: null, pointsStillNeeded: null, standing: "missing_target" as TargetStanding };
  const target = parseExact(targetValue);
  return { ...grade, target, ...calculateRequiredRemainingAverage(grade.earnedCoursePoints, grade.remainingConfiguredWeight, target) };
}

export type ScenarioScore = { assessmentId: string; score: string };

export function calculateCourseScenario(items: GradeAssessment[], scenarios: ScenarioScore[]) {
  const grade = calculateCourseGrade(items);
  const scores = new Map(scenarios.map((scenario) => [scenario.assessmentId, parseExact(scenario.score)]));
  let scenarioPoints = grade.earnedCoursePoints;
  let scenarioWeight = grade.gradedWeight;
  for (const item of items) {
    if (item.status === "graded" || item.status === "missed" || item.status === "exempt") continue;
    const score = scores.get(item.id);
    if (score === undefined) continue;
    const weight = parseExact(item.weight);
    scenarioPoints = calculateScenario(scenarioPoints, weight, score);
    scenarioWeight += weight;
  }
  return { scenarioPoints, scenarioWeight, projectedFinalGrade: scenarioPoints, allConfiguredWeight: grade.configuredWeight };
}

export function solveScenarioAssessment(items: GradeAssessment[], scenarios: ScenarioScore[], solveAssessmentId: string, target: Exact) {
  const selected = items.find((item) => item.id === solveAssessmentId && !["graded", "missed", "exempt"].includes(item.status));
  if (!selected) return { required: null, reason: "Select an ungraded assessment." };
  const fixed = calculateCourseScenario(items, scenarios.filter((scenario) => scenario.assessmentId !== solveAssessmentId));
  return calculateRequiredGrade(fixed.scenarioPoints, parseExact(selected.weight), target);
}
