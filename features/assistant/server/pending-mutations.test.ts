import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedAppContext } from "@/features/shared/server-context";

const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), status: vi.fn(), createEvent: vi.fn(), updateEvent: vi.fn(), createGoal: vi.fn(), updateGoal: vi.fn(), goalStatus: vi.fn() }));
vi.mock("@/features/tasks/mutations", () => ({ createTask: mocks.create, updateTask: mocks.update, setTaskStatus: mocks.status }));
vi.mock("@/features/calendar/mutations", () => ({ createNativeCalendarEvent: mocks.createEvent, updateNativeCalendarEvent: mocks.updateEvent }));
vi.mock("@/features/goals/mutations", () => ({ createGoal: mocks.createGoal, updateGoal: mocks.updateGoal, setGoalLifecycleStatus: mocks.goalStatus }));
import { cancelPendingTaskMutation, consumePendingTaskMutation, registerPendingTaskMutation, resetPendingTaskMutationsForTests } from "./pending-mutations";

const preview = { operation: "create_task" as const, actionLabel: "Create task", subjectTitle: "Buy groceries", changes: [{ label: "Status", after: "Todo" }] };
const context = (id: string) => ({ user: { id } }) as AuthenticatedAppContext;
const success = { ok: true, data: { id: "02c682b2-c324-4a49-913d-085d028768cd", title: "Buy groceries", status: "todo" } };

describe("one-shot pending Task mutations", () => {
  beforeEach(() => { resetPendingTaskMutationsForTests(); for (const mock of [mocks.create, mocks.update, mocks.status, mocks.createEvent, mocks.updateEvent, mocks.createGoal, mocks.updateGoal, mocks.goalStatus]) mock.mockReset().mockResolvedValue(success); });
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
  it("uses the same one-shot boundary for Calendar creation and stale-safe updates", async () => {
    const create = registerPendingTaskMutation("user-a", { operation: "create_calendar_event", input: { title: "Dentist" } }, { ...preview, operation: "create_calendar_event", actionLabel: "Create Calendar event", subjectTitle: "Dentist" }, 1_000);
    expect(await consumePendingTaskMutation(create.token, context("user-a"), 2_000)).toMatchObject({ ok: true, data: { operation: "create_calendar_event" } });
    expect(await consumePendingTaskMutation(create.token, context("user-a"), 2_001)).toMatchObject({ ok: false });
    expect(mocks.createEvent).toHaveBeenCalledOnce();
    const update = registerPendingTaskMutation("user-a", { operation: "update_calendar_event", eventId: success.data.id, input: {}, expectedUpdatedAt: "v1" }, { ...preview, operation: "update_calendar_event", actionLabel: "Update Calendar event", subjectTitle: "Dentist" }, 3_000);
    await consumePendingTaskMutation(update.token, context("user-a"), 4_000);
    expect(mocks.updateEvent).toHaveBeenCalledWith(success.data.id, {}, context("user-a"), { expectedUpdatedAt: "v1", preserveReminders: true });
  });
  it("does not let another user confirm or a cancelled Calendar proposal execute", async () => {
    const foreign = registerPendingTaskMutation("user-a", { operation: "create_calendar_event", input: { title: "Private" } }, { ...preview, operation: "create_calendar_event", actionLabel: "Create Calendar event", subjectTitle: "Private" }, 1_000);
    expect(await consumePendingTaskMutation(foreign.token, context("user-b"), 2_000)).toMatchObject({ ok: false, error: { code: "not_found" } });
    const cancelled = registerPendingTaskMutation("user-a", { operation: "create_calendar_event", input: { title: "Cancelled" } }, { ...preview, operation: "create_calendar_event", actionLabel: "Create Calendar event", subjectTitle: "Cancelled" }, 3_000);
    expect(cancelPendingTaskMutation(cancelled.token, "user-a", 4_000)).toBe(true);
    expect(await consumePendingTaskMutation(cancelled.token, context("user-a"), 4_001)).toMatchObject({ ok: false });
    expect(mocks.createEvent).not.toHaveBeenCalled();
  });
  it("executes Goal create, update/progress, and status through the same one-shot boundary", async () => {
    const goalPreview = { ...preview, operation: "create_goal" as const, actionLabel: "Create Goal", subjectTitle: "Portfolio" };
    const create = registerPendingTaskMutation("user-a", { operation: "create_goal", input: { title: "Portfolio" } }, goalPreview, 1_000);
    expect(await consumePendingTaskMutation(create.token, context("user-a"), 2_000)).toMatchObject({ ok: true, data: { operation: "create_goal" } });
    expect(mocks.createGoal).toHaveBeenCalledOnce();
    const update = registerPendingTaskMutation("user-a", { operation: "update_goal_progress", goalId: success.data.id, input: { currentValue: "12" }, expectedUpdatedAt: "v1" }, { ...goalPreview, operation: "update_goal_progress", actionLabel: "Update Goal progress" }, 3_000);
    await consumePendingTaskMutation(update.token, context("user-a"), 4_000);
    expect(mocks.updateGoal).toHaveBeenCalledWith(success.data.id, { currentValue: "12" }, context("user-a"), "v1");
    const status = registerPendingTaskMutation("user-a", { operation: "set_goal_status", goalId: success.data.id, status: "completed", expectedUpdatedAt: "v2" }, { ...goalPreview, operation: "set_goal_status", actionLabel: "Mark Goal complete" }, 5_000);
    await consumePendingTaskMutation(status.token, context("user-a"), 6_000);
    expect(mocks.goalStatus).toHaveBeenCalledWith(success.data.id, "completed", context("user-a"), "v2");
  });
  it("rejects another user and cancellation before any Goal write", async () => {
    const goalPreview = { ...preview, operation: "create_goal" as const, actionLabel: "Create Goal", subjectTitle: "Private" };
    const foreign = registerPendingTaskMutation("user-a", { operation: "create_goal", input: {} }, goalPreview, 1_000);
    expect(await consumePendingTaskMutation(foreign.token, context("user-b"), 2_000)).toMatchObject({ ok: false, error: { code: "not_found" } });
    const cancelled = registerPendingTaskMutation("user-a", { operation: "create_goal", input: {} }, goalPreview, 3_000);
    expect(cancelPendingTaskMutation(cancelled.token, "user-a", 4_000)).toBe(true);
    expect(await consumePendingTaskMutation(cancelled.token, context("user-a"), 4_001)).toMatchObject({ ok: false });
    expect(mocks.createGoal).not.toHaveBeenCalled();
  });
});
