import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedAppContext } from "@/features/shared/server-context";
import { createGoal, setGoalLifecycleStatus, updateGoal, validateGoalMutation } from "./mutations";

const baseInput = { title: "Read books", description: "", category: "personal", status: "active", deadline: "2026-12-31", progressMode: "numeric", currentValue: "12.1250", targetValue: "20.0000", unitLabel: "books" };
const row = { id: "02c682b2-c324-4a49-913d-085d028768cd", title: "Read books", description: null, category: "personal", status: "active", deadline: "2026-12-31", progress_mode: "numeric", current_value_decimal: "12.1250", target_value_decimal: "20.0000", unit_label: "books", completed_at: null, archived_at: null, updated_at: "v1" };

function contextWith(results: { data: unknown; error: unknown }[]) {
  const filters: [string, unknown][] = []; let index = 0;
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn((key: string, value: unknown) => { filters.push([key, value]); return chain; });
  chain.is = vi.fn(() => chain);
  chain.single = vi.fn(async () => results[Math.min(index++, results.length - 1)]);
  chain.maybeSingle = vi.fn(async () => results[Math.min(index++, results.length - 1)]);
  const insert = vi.fn(() => chain); const update = vi.fn(() => chain);
  return { context: { user: { id: "user-a" }, supabase: { from: vi.fn(() => ({ insert, update, select: chain.select })) } } as unknown as AuthenticatedAppContext, filters, insert, update };
}

describe("Goal mutation services", () => {
  it("preserves exact percentage, numeric, decimal, and over-target values", () => {
    expect(validateGoalMutation({ ...baseInput, progressMode: "percentage", currentValue: "70.1250", targetValue: "", unitLabel: "" })).toMatchObject({ ok: true, data: { values: { current_value: "70.1250", target_value: null } } });
    expect(validateGoalMutation({ ...baseInput, currentValue: "20.0001" })).toMatchObject({ ok: true, data: { values: { current_value: "20.0001", target_value: "20.0000", status: "active" } } });
    expect(validateGoalMutation({ ...baseInput, currentValue: "0.00001" })).toMatchObject({ ok: false, error: { code: "validation" } });
  });

  it("creates only for the authenticated owner", async () => {
    const fake = contextWith([{ data: row, error: null }]);
    expect(await createGoal(baseInput, fake.context)).toMatchObject({ ok: true });
    expect(fake.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "user-a", current_value: "12.1250", target_value: "20.0000" }));
  });

  it("hides foreign Goals and rejects stale updates", async () => {
    const hidden = contextWith([{ data: null, error: null }]);
    expect(await updateGoal(row.id, baseInput, hidden.context)).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(hidden.filters).toContainEqual(["user_id", "user-a"]);
    const stale = contextWith([{ data: { id: row.id, updated_at: "v2" }, error: null }]);
    expect(await updateGoal(row.id, baseInput, stale.context, "v1")).toMatchObject({ ok: false, error: { code: "conflict" } });
  });

  it("updates exact progress without auto-completing and handles lifecycle separately", async () => {
    const progress = contextWith([{ data: { id: row.id, updated_at: "v1" }, error: null }, { data: { ...row, current_value_decimal: "25.0000", status: "active", updated_at: "v2" }, error: null }]);
    expect(await updateGoal(row.id, { ...baseInput, currentValue: "25.0000" }, progress.context, "v1")).toMatchObject({ ok: true, data: { current_value_decimal: "25.0000", status: "active" } });
    expect(progress.update).toHaveBeenCalledWith(expect.objectContaining({ current_value: "25.0000", status: "active" }));
    const lifecycle = contextWith([{ data: { id: row.id, status: "active", updated_at: "v1" }, error: null }, { data: { ...row, status: "completed", completed_at: "now", updated_at: "v2" }, error: null }]);
    expect(await setGoalLifecycleStatus(row.id, "completed", lifecycle.context, "v1")).toMatchObject({ ok: true, data: { status: "completed" } });
  });
});
