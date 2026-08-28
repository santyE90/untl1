import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedAppContext } from "@/features/shared/server-context";

const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), status: vi.fn() }));
vi.mock("@/features/tasks/mutations", () => ({ createTask: mocks.create, updateTask: mocks.update, setTaskStatus: mocks.status }));
import { cancelPendingTaskMutation, consumePendingTaskMutation, registerPendingTaskMutation, resetPendingTaskMutationsForTests } from "./pending-mutations";

const preview = { operation: "create_task" as const, actionLabel: "Create task", taskTitle: "Buy groceries", changes: [{ label: "Status", after: "Todo" }] };
const context = (id: string) => ({ user: { id } }) as AuthenticatedAppContext;
const success = { ok: true, data: { id: "02c682b2-c324-4a49-913d-085d028768cd", title: "Buy groceries", status: "todo" } };

describe("one-shot pending Task mutations", () => {
  beforeEach(() => { resetPendingTaskMutationsForTests(); mocks.create.mockReset().mockResolvedValue(success); });
  it("does not write at proposal time and executes exactly once after confirmation", async () => {
    const proposal = registerPendingTaskMutation("user-a", { operation: "create_task", input: { title: "Buy groceries" } }, preview, 1_000);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(await consumePendingTaskMutation(proposal.token, context("user-a"), 2_000)).toMatchObject({ ok: true });
    expect(await consumePendingTaskMutation(proposal.token, context("user-a"), 2_001)).toMatchObject({ ok: false, error: { code: "not_found" } });
    expect(mocks.create).toHaveBeenCalledOnce();
  });
  it("rejects the wrong user, modified tokens, expiry, and cancelled proposals", async () => {
    const wrongUser = registerPendingTaskMutation("user-a", { operation: "create_task", input: {} }, preview, 1_000);
    expect(await consumePendingTaskMutation(wrongUser.token, context("user-b"), 2_000)).toMatchObject({ ok: false });
    expect(await consumePendingTaskMutation(`${wrongUser.token}x`, context("user-a"), 2_000)).toMatchObject({ ok: false });
    const expired = registerPendingTaskMutation("user-a", { operation: "create_task", input: {} }, preview, 1_000);
    expect(await consumePendingTaskMutation(expired.token, context("user-a"), 700_000)).toMatchObject({ ok: false });
    const cancelled = registerPendingTaskMutation("user-a", { operation: "create_task", input: {} }, preview, 1_000);
    expect(cancelPendingTaskMutation(cancelled.token, "user-a", 2_000)).toBe(true);
    expect(await consumePendingTaskMutation(cancelled.token, context("user-a"), 2_001)).toMatchObject({ ok: false });
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
