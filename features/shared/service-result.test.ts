import { describe, expect, it } from "vitest";

import { serviceFailure, serviceSuccess } from "./service-result";

describe("service result contract", () => {
  it("keeps serializable success and typed failure shapes predictable", () => {
    expect(serviceSuccess({ id: "task-1" })).toEqual({ ok: true, data: { id: "task-1" } });
    expect(serviceFailure("not_found", "Task was not found.")).toEqual({ ok: false, error: { code: "not_found", message: "Task was not found." } });
  });
});
