import { describe, expect, it } from "vitest";

import type { AssistantReference } from "../contracts";
import { trustedReference, uniqueReferences } from "./references";

const id = "02c682b2-c324-4a49-913d-085d028768cd";
const reference = (href: string): AssistantReference => ({ type: "task", id, label: "Open record", href });

describe("trusted Assistant references", () => {
  it.each(["/calendar", "/calendar?date=2026-08-27", `/calendar/events/${id}`, "/finance", "/finance/planning", `/school/courses/${id}`, `/school/courses/${id}#assessment-${id}`, "/tasks", `/tasks?task=${id}#task-${id}`, `/goals/${id}`])("accepts approved same-origin route %s", (href) => {
    expect(trustedReference(reference(href))).not.toBeNull();
  });

  it.each(["https://evil.test/tasks", "//evil.test/tasks", "javascript:alert(1)", "/admin", `/tasks?task=${id}&next=https://evil.test`, "/calendar?date=bad"]) ("rejects unsupported route %s", (href) => {
    expect(trustedReference(reference(href))).toBeNull();
  });

  it("deduplicates and caps trusted references", () => {
    expect(uniqueReferences([reference(`/tasks?task=${id}#task-${id}`), reference(`/tasks?task=${id}#task-${id}`), reference("//evil.test")], 1)).toHaveLength(1);
  });

  it("rejects malformed structured fields even when the path is approved", () => {
    expect(trustedReference({ ...reference("/tasks"), label: "x".repeat(121) })).toBeNull();
  });
});
