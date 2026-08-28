import { describe, expect, it, vi } from "vitest";

import type { AuthenticatedAppContext } from "../shared/server-context";
import { createTask, setTaskStatus, updateTask, validateTaskMutation } from "./mutations";

const baseInput = { title: "Buy groceries", description: "", status: "todo", priority: "medium", dueKind: "date", dueDate: "2026-08-28", dueLocal: "", estimatedEffortMinutes: "", assessmentId: "", goalId: "" };
const record = { id: "02c682b2-c324-4a49-913d-085d028768cd", title: "Buy groceries", status: "todo", priority: "medium", due_date: "2026-08-28", due_at: null, estimated_effort_minutes: null, assessment_id: null, goal_id: null, updated_at: "2026-08-27T20:00:00Z" };

function contextWithResult(result: { data: unknown; error: unknown }) {
  const filters: [string, unknown][] = [];
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "is", "not"]) chain[method] = vi.fn(() => chain);
  chain.eq = vi.fn((field: string, value: unknown) => { filters.push([field, value]); return chain; });
  chain.maybeSingle = vi.fn(async () => result);
  chain.single = vi.fn(async () => result);
  const insert = vi.fn(() => chain); const update = vi.fn(() => chain);
  const context = { user: { id: "user-a" }, timeZone: "America/Toronto", supabase: { from: vi.fn(() => ({ insert, update, select: chain.select })) } } as unknown as AuthenticatedAppContext;
  return { context, filters, insert, update };
}

describe("authenticated Task mutation services", () => {
  it("creates date-only and timed Tasks with authoritative timezone conversion", async () => {
    const date = contextWithResult({ data: record, error: null });
    expect(await createTask(baseInput, date.context)).toMatchObject({ ok: true, data: { due_date: "2026-08-28" } });
    expect(date.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "user-a", due_date: "2026-08-28", due_at: null }));
    const timed = contextWithResult({ data: { ...record, due_date: null, due_at: "2026-08-28T13:30:00.000Z" }, error: null });
    await createTask({ ...baseInput, dueKind: "timed", dueDate: "", dueLocal: "2026-08-28T09:30", priority: "urgent", estimatedEffortMinutes: 30 }, timed.context);
    expect(timed.insert).toHaveBeenCalledWith(expect.objectContaining({ due_date: null, due_at: "2026-08-28T13:30:00.000Z", priority: "urgent", estimated_effort_minutes: 30 }));
  });

  it("cannot update or complete an ownership-hidden Task", async () => {
    const hiddenUpdate = contextWithResult({ data: null, error: null });
    expect(await updateTask(record.id, baseInput, hiddenUpdate.context)).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(hiddenUpdate.filters).toContainEqual(["user_id", "user-a"]);
    const hiddenStatus = contextWithResult({ data: null, error: null });
    expect(await setTaskStatus(record.id, "completed", hiddenStatus.context)).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(hiddenStatus.filters).toContainEqual(["user_id", "user-a"]);
  });

  it("rejects stale optimistic updates and inaccessible relationship IDs", async () => {
    const stale = contextWithResult({ data: null, error: null });
    expect(await updateTask(record.id, baseInput, stale.context, record.updated_at)).toMatchObject({ ok: false, error: { code: "conflict" } });
    expect(stale.filters).toContainEqual(["updated_at", record.updated_at]);
    const relation = contextWithResult({ data: null, error: null });
    expect(await validateTaskMutation({ ...baseInput, goalId: "02c682b2-c324-4a49-913d-085d028768cd" }, relation.context)).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(relation.filters).toContainEqual(["user_id", "user-a"]);
  });

  it("supports owned Goal/Assessment links and all enabled status targets", async () => {
    const linked = contextWithResult({ data: record, error: null });
    await createTask({ ...baseInput, assessmentId: record.id, goalId: record.id }, linked.context);
    expect(linked.insert).toHaveBeenCalledWith(expect.objectContaining({ assessment_id: record.id, goal_id: record.id }));
    for (const status of ["in_progress", "completed", "todo"] as const) {
      const transition = contextWithResult({ data: { ...record, status }, error: null });
      expect(await setTaskStatus(record.id, status, transition.context)).toMatchObject({ ok: true, data: { status } });
      expect(transition.update).toHaveBeenCalledWith({ status });
    }
  });
});
