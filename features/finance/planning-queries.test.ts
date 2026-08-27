import { describe, expect, it } from "vitest";

import { resolveForecastRange } from "./forecast-range";

describe("forecast horizons", () => {
  it("uses inclusive bounded day horizons", () => {
    expect(resolveForecastRange("2026-08-27", "7")).toEqual({ horizon: "7", range: { start: "2026-08-27", end: "2026-09-02" } });
    expect(resolveForecastRange("2026-08-27", "90").range.end).toBe("2026-11-24");
  });

  it("supports month-end and bounded custom dates", () => {
    expect(resolveForecastRange("2026-08-27", "month").range.end).toBe("2026-08-31");
    expect(resolveForecastRange("2026-08-27", "custom", "2026-12-31").range.end).toBe("2026-12-31");
    expect(resolveForecastRange("2026-08-27", "custom", "2030-01-01").horizon).toBe("30");
  });
});
