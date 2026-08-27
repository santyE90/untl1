import { beforeEach, describe, expect, it } from "vitest";

import { acquireAssistantRequest, resetAssistantThrottleForTests } from "./throttle";

describe("Assistant request throttle", () => {
  beforeEach(() => resetAssistantThrottleForTests());

  it("allows one active request per user and releases the concurrency slot", () => {
    const first = acquireAssistantRequest("user-a", 1_000);
    expect(first.allowed).toBe(true);
    expect(acquireAssistantRequest("user-a", 1_001)).toMatchObject({ allowed: false });
    if (first.allowed) first.release();
    expect(acquireAssistantRequest("user-a", 2_500).allowed).toBe(true);
  });

  it("isolates users and limits rapid starts in the one-minute window", () => {
    expect(acquireAssistantRequest("user-b", 1_000).allowed).toBe(true);
    let now = 1_000;
    for (let index = 0; index < 6; index += 1) {
      const decision = acquireAssistantRequest("user-a", now);
      expect(decision.allowed).toBe(true);
      if (decision.allowed) decision.release();
      now += 1_500;
    }
    expect(acquireAssistantRequest("user-a", now)).toMatchObject({ allowed: false, retryAfterSeconds: expect.any(Number) });
    expect(acquireAssistantRequest("user-a", 61_001).allowed).toBe(true);
  });
});
