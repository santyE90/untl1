import { describe, expect, it } from "vitest";

import { accountUpdateSchema, billSchema, incomeSchema } from "@/features/finance/schemas";
import { meetingScheduleSchema } from "@/features/school/schemas";
import { isValidIanaTimeZone, supportedTimeZoneOptions, timeZoneLabel } from "@/features/shared/timezones";
import { themePreferenceSchema } from "./schemas";

describe("focused usability validation", () => {
  it("accepts independent meeting rows with different days and times", () => {
    const result = meetingScheduleSchema.safeParse([
      { meetingType: "lecture", weekday: 1, startTime: "09:00", endTime: "10:00", location: "A", effectiveStart: "2026-09-01", effectiveEnd: "2026-12-20", active: true },
      { meetingType: "lecture", weekday: 3, startTime: "13:00", endTime: "14:30", location: "B", effectiveStart: "2026-09-01", effectiveEnd: "2026-12-20", active: true },
    ]);
    expect(result.success).toBe(true);
  });

  it("rejects an invalid meeting row before a batch reaches the database", () => {
    const result = meetingScheduleSchema.safeParse([{ meetingType: "lab", weekday: 2, startTime: "12:00", endTime: "11:00", location: "", effectiveStart: "2026-09-01", effectiveEnd: "2026-12-20", active: true }]);
    expect(result.success).toBe(false);
  });

  it("limits account edits to safe metadata", () => {
    const result = accountUpdateSchema.parse({ name: "Daily", accountType: "chequing", customTypeName: "", institution: "Bank", creditLimit: "", includeInNetWorth: true, currency: "USD", openingBalance: "999" });
    expect(result).not.toHaveProperty("currency");
    expect(result).not.toHaveProperty("openingBalance");
  });

  it("validates editable recurring schedules", () => {
    const shared = { name: "Schedule", expectedAmount: "42.00", frequency: "monthly", anchorDate: "2026-08-01", reminderDays: "3", currency: "CAD" };
    expect(billSchema.safeParse({ ...shared, accountId: "", categoryId: "10000000-0000-4000-8000-000000000001", nextDueDate: "2026-09-01", autopay: false }).success).toBe(true);
    expect(incomeSchema.safeParse({ ...shared, destinationAccountId: "", categoryId: "", nextPayday: "bad-date" }).success).toBe(false);
  });

  it("offers broad labeled timezone options while preserving canonical values", () => {
    const options = supportedTimeZoneOptions();
    expect(options.length).toBeGreaterThan(100);
    expect(options.find((option) => option.value === "America/Toronto")?.label).toContain("Toronto");
    expect(timeZoneLabel("America/New_York")).toContain("Eastern Time");
    expect(isValidIanaTimeZone("Europe/London")).toBe(true);
  });

  it("accepts only the three persisted theme preferences", () => {
    expect(themePreferenceSchema.safeParse({ theme: "system" }).success).toBe(true);
    expect(themePreferenceSchema.safeParse({ theme: "dark" }).success).toBe(true);
    expect(themePreferenceSchema.safeParse({ theme: "sepia" }).success).toBe(false);
  });
});
