import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedAppContext } from "@/features/shared/server-context";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { handleAssistantCancellation, handleAssistantConfirmation } from "./confirmation-handler";

const context = { user: { id: "user-a" } } as AuthenticatedAppContext;
const token = "x".repeat(43);
const request = () => new Request("http://localhost/api/assistant/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
const task = { id: "02c682b2-c324-4a49-913d-085d028768cd", title: "Buy groceries", status: "todo", priority: "medium", due_date: "2026-08-28", due_at: null, estimated_effort_minutes: null, assessment_id: null, goal_id: null, updated_at: "now" };
const calendarEvent = { id: task.id, title: "Dentist", all_day: false, starts_at: "2026-08-28T18:00:00Z", ends_at: "2026-08-28T19:00:00Z", start_date: null, end_date: null, updated_at: "now" };
const goal = { id: task.id, title: "Finish portfolio", status: "active", progress_mode: "none", updated_at: "now" };

describe("Assistant confirmation HTTP boundary", () => {
  it("requires authentication and passes only the opaque token with trusted context", async () => {
    const consume = vi.fn();
    expect((await handleAssistantConfirmation(request(), { getContext: async () => null, consume })).status).toBe(401);
    expect(consume).not.toHaveBeenCalled();
    consume.mockResolvedValueOnce({ ok: true, data: { operation: "create_task", entity: task } });
    const response = await handleAssistantConfirmation(request(), { getContext: async () => context, consume, observe: vi.fn() });
    expect(response.status).toBe(200);
    expect(consume).toHaveBeenCalledWith(token, context);
    expect(await response.json()).toMatchObject({ ok: true, references: [{ type: "task" }] });
  });
  it("returns safe conflict/expired failures without retrying", async () => {
    const consume = vi.fn().mockResolvedValue({ ok: false, error: { code: "conflict", message: "The task changed after this proposal. Please review it again." } });
    expect((await handleAssistantConfirmation(request(), { getContext: async () => context, consume, observe: vi.fn() })).status).toBe(409);
    expect(consume).toHaveBeenCalledOnce();
  });
  it("returns a server-derived trusted Calendar reference", async () => {
    const consume = vi.fn().mockResolvedValue({ ok: true, data: { operation: "update_calendar_event", entity: calendarEvent } });
    const response = await handleAssistantConfirmation(request(), { getContext: async () => context, consume, observe: vi.fn() });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, operation: "update_calendar_event", references: [{ type: "calendar", id: task.id, href: `/calendar/events/${task.id}` }] });
  });
  it("returns a server-derived trusted Goal reference", async () => {
    const consume = vi.fn().mockResolvedValue({ ok: true, data: { operation: "update_goal_progress", entity: goal } });
    const response = await handleAssistantConfirmation(request(), { getContext: async () => context, consume, observe: vi.fn() });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, operation: "update_goal_progress", references: [{ type: "goal", id: task.id, href: `/goals/${task.id}` }] });
  });
  it("cancels through a separate authenticated request", async () => {
    const cancel = vi.fn().mockReturnValue(true);
    expect((await handleAssistantCancellation(request(), { getContext: async () => context, cancel, observe: vi.fn() })).status).toBe(200);
    expect(cancel).toHaveBeenCalledWith(token, "user-a");
  });
});
