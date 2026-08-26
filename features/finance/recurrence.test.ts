import { describe, expect, it } from "vitest";

import { nextOccurrence } from "./recurrence";

describe("recurrence", () => {
  it("advances weekly and biweekly schedules", () => {
    expect(nextOccurrence("2026-08-26", "weekly")).toBe("2026-09-02");
    expect(nextOccurrence("2026-08-26", "biweekly")).toBe("2026-09-09");
  });

  it("clamps monthly dates at month end", () => {
    expect(nextOccurrence("2026-01-31", "monthly")).toBe("2026-02-28");
  });

  it("handles leap-day yearly recurrence", () => {
    expect(nextOccurrence("2028-02-29", "yearly")).toBe("2029-02-28");
  });
});
