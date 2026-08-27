import { describe, expect, it } from "vitest";

import { calculateCourseGrade, calculateCourseScenario, calculateCourseTarget, calculateRequiredGrade, calculateRequiredRemainingAverage, calculateScenario, exactToString, formatPercent, parseExact, solveScenarioAssessment } from "./grades";

describe("exact academic grade calculations", () => {
  it("calculates a completed-work grade separately from earned course points", () => {
    const grade = calculateCourseGrade([
      { id: "a", name: "Essay", weight: "25", scoreEarned: "42", scoreMax: "50", status: "graded" },
      { id: "b", name: "Exam", weight: "50", scoreEarned: null, scoreMax: null, status: "upcoming" },
    ]);
    expect(exactToString(grade.completedWorkGrade!)).toBe("84.0000");
    expect(exactToString(grade.earnedCoursePoints)).toBe("21.0000");
    expect(exactToString(grade.gradedWeight)).toBe("25.0000");
  });

  it("excludes submitted and exempt assessments from the completed-work denominator", () => {
    const grade = calculateCourseGrade([
      { id: "a", name: "Quiz", weight: "20", scoreEarned: "18", scoreMax: "20", status: "submitted" },
      { id: "b", name: "Participation", weight: "10", scoreEarned: null, scoreMax: null, status: "exempt" },
    ]);
    expect(grade.completedWorkGrade).toBeNull();
    expect(exactToString(grade.configuredWeight)).toBe("20.0000");
  });

  it("preserves decimal weights without floating point drift", () => {
    const grade = calculateCourseGrade([
      { id: "a", name: "Quiz", weight: "33.3333", scoreEarned: "2", scoreMax: "3", status: "graded" },
    ]);
    expect(exactToString(grade.gradedWeight)).toBe("33.3333");
    expect(exactToString(grade.completedWorkGrade!)).toBe("66.6667");
  });

  it("warns through the weight delta when configured weights do not total 100", () => {
    expect(exactToString(calculateCourseGrade([{ id: "a", name: "Final", weight: "110", scoreEarned: null, scoreMax: null, status: "upcoming" }]).weightDelta)).toBe("10.0000");
  });

  it("calculates required and what-if grades from exact weighted points", () => {
    const required = calculateRequiredGrade(parseExact("42"), parseExact("30"), parseExact("70"));
    expect(exactToString(required.required!)).toBe("93.3333");
    expect(exactToString(calculateScenario(parseExact("42"), parseExact("30"), parseExact("80")))).toBe("66.0000");
  });

  it("reports impossible and already-secured targets", () => {
    expect(calculateRequiredGrade(parseExact("20"), parseExact("20"), parseExact("90")).reason).toContain("more than 100%");
    expect(calculateRequiredGrade(parseExact("90"), parseExact("20"), parseExact("80")).reason).toContain("already secured");
  });

  it("calculates the exact average required across all configured remaining work", () => {
    expect(exactToString(calculateRequiredRemainingAverage(parseExact("52"), parseExact("40"), parseExact("85")).requiredAverage!)).toBe("82.5000");
  });

  it("distinguishes already-secured, impossible, and exhausted remaining weight", () => {
    expect(calculateRequiredRemainingAverage(parseExact("86"), parseExact("10"), parseExact("85")).standing).toBe("already_secured");
    expect(calculateRequiredRemainingAverage(parseExact("40"), parseExact("20"), parseExact("85")).standing).toBe("impossible");
    expect(calculateRequiredRemainingAverage(parseExact("70"), 0n, parseExact("85")).standing).toBe("no_remaining");
  });

  it("treats missed work as a fixed zero and exempt work as absent", () => {
    const grade = calculateCourseGrade([
      { id: "missed", name: "Quiz", weight: "10", scoreEarned: null, scoreMax: null, status: "missed" },
      { id: "exempt", name: "Lab", weight: "20", scoreEarned: null, scoreMax: null, status: "exempt" },
      { id: "final", name: "Final", weight: "70", scoreEarned: null, scoreMax: null, status: "upcoming" },
    ]);
    expect(exactToString(grade.gradedWeight)).toBe("10.0000");
    expect(exactToString(grade.earnedCoursePoints)).toBe("0.0000");
    expect(exactToString(grade.configuredWeight)).toBe("80.0000");
  });

  it("models multiple hypothetical assessments without changing actual grades", () => {
    const items = [
      { id: "graded", name: "Essay", weight: "30", scoreEarned: "27", scoreMax: "30", status: "graded" },
      { id: "midterm", name: "Midterm", weight: "30", scoreEarned: null, scoreMax: null, status: "upcoming" },
      { id: "final", name: "Final", weight: "40", scoreEarned: null, scoreMax: null, status: "upcoming" },
    ];
    const scenario = calculateCourseScenario(items, [{ assessmentId: "midterm", score: "80" }, { assessmentId: "final", score: "85" }]);
    expect(exactToString(scenario.projectedFinalGrade)).toBe("85.0000");
    expect(items[1].scoreEarned).toBeNull();
  });

  it("solves one remaining assessment while other scenarios stay fixed", () => {
    const items = [
      { id: "graded", name: "Essay", weight: "30", scoreEarned: "27", scoreMax: "30", status: "graded" },
      { id: "midterm", name: "Midterm", weight: "30", scoreEarned: null, scoreMax: null, status: "upcoming" },
      { id: "final", name: "Final", weight: "40", scoreEarned: null, scoreMax: null, status: "upcoming" },
    ];
    const solved = solveScenarioAssessment(items, [{ assessmentId: "midterm", score: "80" }], "final", parseExact("85"));
    expect(exactToString(solved.required!)).toBe("85.0000");
  });

  it("retains incomplete and overconfigured weight warnings alongside target math", () => {
    const incomplete = calculateCourseTarget([{ id: "a", name: "Final", weight: "80", scoreEarned: null, scoreMax: null, status: "upcoming" }], "70");
    const over = calculateCourseTarget([{ id: "a", name: "Final", weight: "110", scoreEarned: null, scoreMax: null, status: "upcoming" }], "70");
    expect(exactToString(incomplete.weightDelta)).toBe("-20.0000");
    expect(exactToString(over.weightDelta)).toBe("10.0000");
  });

  it("formats display precision consistently at rounding and negative boundaries", () => {
    expect(formatPercent(parseExact("86.44"))).toBe("86.4%");
    expect(formatPercent(parseExact("86.45"))).toBe("86.5%");
    expect(formatPercent(-parseExact("2.34"))).toBe("-2.3%");
  });
});
