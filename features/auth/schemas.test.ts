import { describe, expect, it } from "vitest";

import { loginSchema, signupSchema } from "./schemas";

describe("authentication schemas", () => {
  it("accepts a normalized email and valid password", () => {
    const result = loginSchema.parse({
      email: "  person@example.com ",
      password: "correct horse battery staple",
    });

    expect(result.email).toBe("person@example.com");
  });

  it("rejects malformed credentials", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "short" });

    expect(result.success).toBe(false);
  });

  it("trims and validates a signup display name", () => {
    const result = signupSchema.parse({
      displayName: "  Alex Morgan  ",
      email: "alex@example.com",
      password: "a secure password",
    });

    expect(result.displayName).toBe("Alex Morgan");
  });
});
