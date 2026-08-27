import { describe, expect, it } from "vitest";

import { goalSchema, milestoneSchema } from "./schemas";

const base = { title: "Save money", description: "", category: "finance", status: "active", deadline: "2026-12-31", progressMode: "numeric", currentValue: "3250.1250", targetValue: "5000", unitLabel: "CAD" };

describe("Goal validation", () => {
  it("accepts exact numeric and percentage progress", () => {
    expect(goalSchema.safeParse(base).success).toBe(true);
    expect(goalSchema.safeParse({ ...base, progressMode: "percentage", currentValue: "105.25", targetValue: "", unitLabel: "" }).success).toBe(true);
  });

  it("rejects zero targets, excess precision, and malformed dates", () => {
    expect(goalSchema.safeParse({ ...base, targetValue: "0" }).success).toBe(false);
    expect(goalSchema.safeParse({ ...base, currentValue: "1.00001" }).success).toBe(false);
    expect(goalSchema.safeParse({ ...base, deadline: "tomorrow" }).success).toBe(false);
  });

  it("validates lightweight milestone fields", () => {
    expect(milestoneSchema.safeParse({ title: "First step", description: "", targetDate: "2026-10-01", sortOrder: "2" }).success).toBe(true);
    expect(milestoneSchema.safeParse({ title: "", description: "", targetDate: "", sortOrder: "0" }).success).toBe(false);
  });
});
