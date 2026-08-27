import { afterEach, describe, expect, it } from "vitest";

import { getOpenAIApiKey } from "./config";
import { assistantConfig } from "./config";
import { assistantLimits } from "../limits";

const original = process.env.OPENAI_API_KEY;
afterEach(() => { if (original === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = original; });

describe("Assistant server configuration", () => {
  it("fails clearly when the server key is missing without exposing a value", () => {
    delete process.env.OPENAI_API_KEY;
    expect(() => getOpenAIApiKey()).toThrow("OPENAI_API_KEY is required");
  });

  it("uses the centralized bounded output and tool limits", () => {
    expect(assistantConfig).toMatchObject({ model: "gpt-5-mini", reasoningEffort: "low", maxOutputTokens: assistantLimits.maxOutputTokens, maxToolIterations: assistantLimits.maxToolIterations, maxToolCalls: assistantLimits.maxToolCalls });
  });
});
