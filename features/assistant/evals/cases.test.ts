import { describe, expect, it } from "vitest";

import { assistantToolDefinitions } from "../server/tools";
import { assistantMutationToolDefinitions } from "../server/mutation-tools";
import { assistantEvalCases } from "./cases";

describe("Assistant deterministic evaluation catalog", () => {
  const registry = new Set([...assistantToolDefinitions, ...assistantMutationToolDefinitions].map((tool) => tool.name));

  it("covers representative single-domain, cross-domain, missing-data, and mutation requests", () => {
    expect(assistantEvalCases).toHaveLength(14);
    expect(assistantEvalCases.some((item) => item.expectedTools.length > 1)).toBe(true);
    expect(assistantEvalCases.filter((item) => item.expectedTools.length === 0)).toHaveLength(4);
    expect(assistantEvalCases.some((item) => item.expectedBehavior.includes("no matching"))).toBe(true);
  });

  it("expects only registered read tools and keeps simple prompts selective", () => {
    for (const item of assistantEvalCases) {
      expect(item.expectedTools.every((name) => registry.has(name))).toBe(true);
      expect(item.expectedTools.length).toBeLessThanOrEqual(2);
      expect(item.forbiddenTools?.some((name) => item.expectedTools.includes(name)) ?? false).toBe(false);
    }
  });
});
