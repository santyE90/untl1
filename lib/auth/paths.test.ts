import { describe, expect, it } from "vitest";

import { getSafeNextPath, isAuthPath, isProtectedPath } from "./paths";

describe("authentication route helpers", () => {
  it("recognizes protected application routes without prefix collisions", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/finance/accounts")).toBe(true);
    expect(isProtectedPath("/dashboard-public")).toBe(false);
  });

  it("recognizes only authentication pages", () => {
    expect(isAuthPath("/login")).toBe(true);
    expect(isAuthPath("/signup")).toBe(true);
    expect(isAuthPath("/auth/confirm")).toBe(false);
  });

  it("allows only internal protected post-login destinations", () => {
    expect(getSafeNextPath("/tasks?filter=due")).toBe("/tasks?filter=due");
    expect(getSafeNextPath("https://attacker.example")).toBe("/dashboard");
    expect(getSafeNextPath("//attacker.example")).toBe("/dashboard");
    expect(getSafeNextPath("/login")).toBe("/dashboard");
  });
});
