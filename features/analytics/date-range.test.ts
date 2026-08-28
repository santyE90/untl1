import { describe, expect, it } from "vitest";
import { analyticsLocalDate, bucketDate, dateInRange, enumerateBuckets, getAnalyticsRange, parseAnalyticsRangeKey, previousAnalyticsRange, resolveAnalyticsRange } from "./date-range";

describe("Analytics date ranges", () => {
  it("builds supported inclusive ranges and defaults safely", () => {
    expect(getAnalyticsRange("last_7", "2026-08-28")).toMatchObject({ start: "2026-08-22", end: "2026-08-28", bucket: "day" });
    expect(getAnalyticsRange("last_30", "2026-08-28").start).toBe("2026-07-30");
    expect(getAnalyticsRange("last_90", "2026-08-28")).toMatchObject({ start: "2026-05-31", bucket: "week" });
    expect(getAnalyticsRange("this_month", "2026-08-28")).toMatchObject({ start: "2026-08-01", end: "2026-08-28" });
    expect(getAnalyticsRange("previous_month", "2026-03-02")).toMatchObject({ start: "2026-02-01", end: "2026-02-28" });
    expect(parseAnalyticsRangeKey("forever")).toBe("last_30");
  });
  it("uses deterministic weekly buckets and profile-local dates", () => {
    const range = { start: "2026-05-31", end: "2026-06-20", bucket: "week" as const };
    expect(bucketDate("2026-06-13", range)).toBe("2026-06-07");
    expect(enumerateBuckets(range)).toEqual(["2026-05-31", "2026-06-07", "2026-06-14"]);
    expect(analyticsLocalDate("2026-08-29T02:30:00Z", "America/Toronto")).toBe("2026-08-28");
  });

  it("accepts inclusive custom and same-day ranges", () => {
    const custom = resolveAnalyticsRange({ range: "custom", from: "2026-08-01", to: "2026-08-31" }, "2026-08-28");
    expect(custom).toMatchObject({ error: null, selectedKey: "custom", range: { start: "2026-08-01", end: "2026-08-31", bucket: "day" } });
    expect(dateInRange("2026-08-01", custom.range)).toBe(true);
    expect(dateInRange("2026-08-31", custom.range)).toBe(true);
    expect(resolveAnalyticsRange({ range: "custom", from: "2026-08-28", to: "2026-08-28" }, "2026-08-28").range).toMatchObject({ start: "2026-08-28", end: "2026-08-28", bucket: "day" });
  });

  it("falls back safely for missing, malformed, reversed, and repeated query values", () => {
    for (const query of [
      { range: "custom", from: "", to: "2026-08-28" },
      { range: "custom", from: "2026-02-30", to: "2026-03-01" },
      { range: "custom", from: "2026-08-29", to: "2026-08-28" },
      { range: "custom", from: ["2026-08-01", "2026-08-02"], to: "2026-08-28" },
    ]) {
      const result = resolveAnalyticsRange(query, "2026-08-28");
      expect(result.error).toBeTruthy();
      expect(result.range).toMatchObject({ key: "last_30", start: "2026-07-30", end: "2026-08-28" });
    }
  });

  it("allows at most 366 inclusive days", () => {
    expect(resolveAnalyticsRange({ range: "custom", from: "2025-01-01", to: "2026-01-01" }, "2026-08-28").error).toBeNull();
    const tooLong = resolveAnalyticsRange({ range: "custom", from: "2025-01-01", to: "2026-01-02" }, "2026-08-28");
    expect(tooLong.error).toContain("366 days");
    expect(tooLong.range.key).toBe("last_30");
  });

  it("selects deterministic daily, weekly, and monthly custom buckets", () => {
    const daily = resolveAnalyticsRange({ range: "custom", from: "2026-08-01", to: "2026-08-31" }, "2026-08-28").range;
    const weekly = resolveAnalyticsRange({ range: "custom", from: "2026-06-01", to: "2026-07-02" }, "2026-08-28").range;
    const monthly = resolveAnalyticsRange({ range: "custom", from: "2026-01-15", to: "2026-08-15" }, "2026-08-28").range;
    expect(daily.bucket).toBe("day"); expect(enumerateBuckets(daily)).toHaveLength(31);
    expect(weekly.bucket).toBe("week"); expect(bucketDate(weekly.start, weekly)).toBe(enumerateBuckets(weekly)[0]); expect(enumerateBuckets(weekly)).toContain(bucketDate(weekly.end, weekly));
    expect(monthly.bucket).toBe("month"); expect(enumerateBuckets(monthly)).toEqual(["2026-01-15", "2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01"]); expect(bucketDate(monthly.end, monthly)).toBe("2026-08-01");
    expect(new Set(enumerateBuckets(monthly)).size).toBe(enumerateBuckets(monthly).length);
  });
  it("calculates the immediately preceding equal-duration period across month boundaries", () => {
    expect(previousAnalyticsRange({ start: "2026-08-01", end: "2026-08-30" })).toEqual({ start: "2026-07-02", end: "2026-07-31" });
    expect(previousAnalyticsRange({ start: "2026-08-28", end: "2026-08-28" })).toEqual({ start: "2026-08-27", end: "2026-08-27" });
  });
});
