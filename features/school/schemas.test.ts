import { describe, expect, it } from "vitest";

import { assessmentSchema, courseSchema, meetingSchema, resourceSchema, termSchema } from "./schemas";

describe("School input validation", () => {
  it("rejects reversed term and meeting ranges", () => {
    expect(termSchema.safeParse({ name: "Fall", academicYear: "2026", startDate: "2026-12-01", endDate: "2026-09-01" }).success).toBe(false);
    expect(meetingSchema.safeParse({ courseId: crypto.randomUUID(), meetingType: "lecture", weekdays: ["1"], startTime: "11:00", endTime: "10:00", location: "", effectiveStart: "2026-09-01", effectiveEnd: "2026-12-01" }).success).toBe(false);
  });

  it("requires a coherent assessment timing shape and grade pair", () => {
    const base = { courseId: crypto.randomUUID(), name: "Final", assessmentType: "final_exam", timingType: "scheduled", dueLocal: "", startsLocal: "2026-12-10T09:00", endsLocal: "2026-12-10T08:00", eventDate: "", weight: "40", scoreEarned: "40", scoreMax: "", status: "graded", location: "", notes: "" };
    expect(assessmentSchema.safeParse(base).success).toBe(false);
  });

  it("rejects invalid targets and accepts a valid course", () => {
    const parsed = courseSchema.safeParse({ termId: crypto.randomUUID(), code: "CSC101", name: "Computing", instructor: "", section: "", location: "", courseUrl: "", notes: "", colorKey: "plum", targetGrade: "101" });
    expect(parsed.success).toBe(false);
    expect(courseSchema.safeParse({ termId: crypto.randomUUID(), code: "CSC101", name: "Computing", instructor: "", section: "", location: "", courseUrl: "", notes: "", colorKey: "plum", targetGrade: "85" }).success).toBe(true);
  });

  it("validates optional effort and HTTP course-resource links", () => {
    expect(resourceSchema.safeParse({ courseId: crypto.randomUUID(), label: "Syllabus", url: "javascript:alert(1)", resourceType: "syllabus", sortOrder: 0 }).success).toBe(false);
    expect(resourceSchema.safeParse({ courseId: crypto.randomUUID(), label: "Repository", url: "https://github.com/example/course", resourceType: "repository", sortOrder: 2 }).success).toBe(true);
    const base = { courseId: crypto.randomUUID(), name: "Essay", assessmentType: "assignment", timingType: "all_day", dueLocal: "", startsLocal: "", endsLocal: "", eventDate: "2026-10-01", weight: "10", scoreEarned: "", scoreMax: "", status: "upcoming", location: "", notes: "" };
    expect(assessmentSchema.safeParse({ ...base, effortHours: "-2" }).success).toBe(false);
    expect(assessmentSchema.safeParse({ ...base, effortHours: "5.5" }).success).toBe(true);
  });
});
