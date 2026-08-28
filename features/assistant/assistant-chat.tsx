"use client";

import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Bot, Check, ExternalLink, RotateCcw, Send, Square, Trash2, UserRound, X } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { assistantMutationResponseSchema, type AssistantMessage, type AssistantReference, type AssistantStreamEvent } from "./contracts";
import { boundAssistantConversation } from "./conversation";
import { assistantLimits } from "./limits";
import { AssistantClientError, consumeAssistantStream } from "./stream-client";

const suggestions = ["What's on my schedule today?", "Create a task to buy groceries tomorrow.", "Create a goal to finish my portfolio by October 1.", "What bills are due soon?"];
type ChatMessage = AssistantMessage & {
  id: string;
  complete: boolean;
  references: AssistantReference[];
};
type ChatError = { message: string; code: string; requestId?: string };
type ConfirmationEvent = Extract<AssistantStreamEvent, { type: "confirmation" }>;
type ConfirmationState = ConfirmationEvent & {
  state: "pending" | "executing" | "completed" | "failed" | "cancelled";
  error?: string;
};

function mutationVerb(operation: string) {
  if (operation === "create_task") return "created the Task";
  if (operation === "set_task_status") return "updated the status of the Task";
  if (operation === "update_task") return "updated the Task";
  if (operation === "create_calendar_event") return "created the Calendar event";
  if (operation === "update_calendar_event") return "updated the Calendar event";
  if (operation === "create_goal") return "created the Goal";
  if (operation === "set_goal_status") return "updated the status of the Goal";
  if (operation === "update_goal_progress") return "updated the progress of the Goal";
  if (operation === "update_goal") return "updated the Goal";
  if (operation === "set_assessment_score") return "recorded the assessment score for";
  if (operation === "clear_assessment_score") return "cleared the assessment score for";
  if (operation === "set_assessment_status") return "updated the assessment status for";
  return "updated the assessment";
}

export function AssistantChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [phase, setPhase] = useState<"thinking" | "using_tools">("thinking");
  const [error, setError] = useState<ChatError | null>(null);
  const [contextTrimmed, setContextTrimmed] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const retryHistoryRef = useRef<AssistantMessage[] | null>(null);
  const retryVisibleRef = useRef<ChatMessage[] | null>(null);
  const stickToBottomRef = useRef(true);
  const confirmationLocked = confirmation?.state === "pending" || confirmation?.state === "executing";

  useEffect(() => {
    if (stickToBottomRef.current)
      viewportRef.current?.scrollTo({
        top: viewportRef.current.scrollHeight,
        behavior: pending ? "auto" : "smooth",
      });
  }, [messages, pending, confirmation]);
  const updateAssistant = (id: string, updater: (message: ChatMessage) => ChatMessage) => setMessages((current) => current.map((message) => (message.id === id ? updater(message) : message)));

  async function runRequest(history: AssistantMessage[], visibleBase?: ChatMessage[]) {
    if (pendingRef.current || confirmationLocked) return;
    pendingRef.current = true;
    setPending(true);
    setPhase("thinking");
    setError(null);
    stickToBottomRef.current = true;
    const bounded = boundAssistantConversation(history);
    setContextTrimmed(bounded.trimmed);
    const assistantId = crypto.randomUUID();
    const visibleHistory =
      visibleBase ??
      history.map((message) => ({
        ...message,
        id: crypto.randomUUID(),
        complete: true,
        references: [],
      }));
    setMessages([
      ...visibleHistory,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        complete: false,
        references: [],
      },
    ]);
    retryHistoryRef.current = history;
    retryVisibleRef.current = visibleHistory;
    const abortController = new AbortController();
    abortRef.current = abortController;
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: bounded.messages }),
        signal: abortController.signal,
      });
      await consumeAssistantStream(response, (event) => {
        if (event.type === "status") setPhase(event.phase);
        else if (event.type === "delta")
          updateAssistant(assistantId, (message) => ({
            ...message,
            content: message.content + event.text,
          }));
        else if (event.type === "confirmation") {
          setConfirmation({ ...event, state: "pending" });
          updateAssistant(assistantId, (message) => ({
            ...message,
            content: message.content || "Review this LifeStack change before it is applied.",
          }));
        } else if (event.type === "done")
          updateAssistant(assistantId, (message) => ({
            ...message,
            complete: true,
            references: event.references,
          }));
      });
      retryHistoryRef.current = null;
      retryVisibleRef.current = null;
      inputRef.current?.focus();
    } catch (caught) {
      if (abortController.signal.aborted) setMessages((current) => current.flatMap((message) => (message.id !== assistantId ? [message] : message.content ? [{ ...message, complete: false }] : [])));
      else {
        const failure = caught instanceof AssistantClientError ? caught : new AssistantClientError("The Assistant could not complete the request. Your LifeStack data was not changed.");
        setError({
          message: failure.message,
          code: failure.code,
          requestId: failure.requestId,
        });
        setMessages((current) => current.flatMap((message) => (message.id !== assistantId ? [message] : message.content ? [{ ...message, complete: false }] : [])));
      }
    } finally {
      if (abortRef.current === abortController) abortRef.current = null;
      pendingRef.current = false;
      setPending(false);
    }
  }

  function submitMessage(content: string) {
    const value = content.trim();
    if (!value || pendingRef.current || confirmationLocked) return;
    const history = messages.filter((message) => message.complete).map(({ role, content }) => ({ role, content }) satisfies AssistantMessage);
    const next = [...history, { role: "user" as const, content: value }];
    const visible = [
      ...messages,
      {
        id: crypto.randomUUID(),
        role: "user" as const,
        content: value,
        complete: true,
        references: [],
      },
    ];
    setDraft("");
    void runRequest(next, visible);
  }

  async function cancelConfirmation(clearAfter = false) {
    const current = confirmation;
    if (!current || current.state === "completed" || current.state === "cancelled") {
      if (clearAfter) setMessages([]);
      return;
    }
    setConfirmation({ ...current, state: "executing" });
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-LifeStack-Assistant-Action": "cancel",
        },
        body: JSON.stringify({ token: current.token }),
        keepalive: clearAfter,
      });
      if (!response.ok && response.status !== 404) throw new Error();
      if (clearAfter) {
        setConfirmation(null);
        setMessages([]);
      } else setConfirmation({ ...current, state: "cancelled" });
    } catch {
      if (clearAfter) {
        setConfirmation(null);
        setMessages([]);
      } else
        setConfirmation({
          ...current,
          state: "failed",
          error: "The proposal could not be cancelled. It will expire automatically.",
        });
    }
  }

  async function confirmMutation() {
    const current = confirmation;
    if (!current || current.state !== "pending") return;
    setConfirmation({ ...current, state: "executing" });
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-LifeStack-Assistant-Action": "confirm",
        },
        body: JSON.stringify({ token: current.token }),
      });
      const parsed = assistantMutationResponseSchema.safeParse(await response.json());
      if (!parsed.success) throw new AssistantClientError("The confirmed change could not be completed.", "server", response.headers.get("X-Assistant-Request-ID") ?? undefined);
      if (!parsed.data.ok) throw new AssistantClientError(parsed.data.error.message, parsed.data.error.code, response.headers.get("X-Assistant-Request-ID") ?? undefined);
      const mutation = parsed.data;
      const entity = mutation.entity;
      const verb = mutationVerb(mutation.operation);
      setMessages((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Done — I ${verb} “${entity.title}”.`,
          complete: true,
          references: mutation.references,
        },
      ]);
      setConfirmation({ ...current, state: "completed" });
      inputRef.current?.focus();
    } catch (caught) {
      const failure = caught instanceof AssistantClientError ? caught : new AssistantClientError("The confirmed change could not be completed. It was not retried.");
      setConfirmation({ ...current, state: "failed", error: failure.message });
    }
  }

  async function clearConversation() {
    abortRef.current?.abort();
    await cancelConfirmation(true);
    retryHistoryRef.current = null;
    retryVisibleRef.current = null;
    setConfirmation(null);
    setMessages([]);
    setError(null);
    setDraft("");
    setContextTrimmed(false);
  }
  const retry = () => {
    const history = retryHistoryRef.current;
    const visible = retryVisibleRef.current;
    if (history && visible) void runRequest(history, visible);
  };
  const onScroll = () => {
    const viewport = viewportRef.current;
    if (viewport) stickToBottomRef.current = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 96;
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  return (
    <div className="flex min-h-[calc(100dvh-12rem)] flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <p className="text-xs text-muted-foreground">Task, native Calendar, Goal, and assessment writes require confirmation · Conversation is session-local</p>
        <Button disabled={!messages.length && !pending && !confirmation} onClick={() => void clearConversation()} size="sm" type="button" variant="ghost">
          <Trash2 /> New chat
        </Button>
      </div>
      <div aria-live="polite" className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6" onScroll={onScroll} ref={viewportRef}>
        {contextTrimmed ? <p className="mx-auto w-fit rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">Using the most recent bounded conversation context.</p> : null}
        {!messages.length ? (
          <div className="mx-auto flex min-h-[24rem] max-w-2xl flex-col items-center justify-center text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-accent text-primary">
              <Bot />
            </span>
            <h2 className="mt-5 text-xl font-semibold">Ask about your LifeStack</h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">I can inspect LifeStack and prepare individual Task, native Calendar, Goal, or School assessment changes for your confirmation.</p>
            <div className="mt-7 grid w-full gap-2 sm:grid-cols-2">
              {suggestions.map((suggestion) => (
                <button className="rounded-xl border bg-background px-4 py-3 text-left text-sm hover:bg-muted/45 disabled:opacity-50" disabled={pending || confirmationLocked} key={suggestion} onClick={() => submitMessage(suggestion)} type="button">
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`} key={message.id}>
              {message.role === "assistant" ? (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                  <Bot className="size-4" />
                </span>
              ) : null}
              <div className="max-w-[90%] sm:max-w-[75%]">
                <div className={message.role === "user" ? "rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground" : "whitespace-pre-wrap break-words rounded-2xl rounded-bl-md bg-muted px-4 py-3 text-sm leading-6"}>{message.content || (pending ? <span className="animate-pulse text-muted-foreground">{phase === "using_tools" ? "Checking LifeStack…" : "Thinking…"}</span> : null)}</div>
                {message.references.length ? (
                  <div aria-label="Related LifeStack records" className="mt-2 flex flex-wrap gap-2">
                    {message.references.map((reference) => (
                      <Link className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-primary hover:bg-muted" href={reference.href} key={`${reference.type}:${reference.id}`}>
                        <ExternalLink className="size-3" />
                        {reference.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
                {!message.complete && message.content && !pending ? <p className="mt-1 text-xs text-muted-foreground">Generation stopped before completion.</p> : null}
              </div>
              {message.role === "user" ? (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                  <UserRound className="size-4" />
                </span>
              ) : null}
            </div>
          ))
        )}
      </div>
      <div className="border-t bg-background/80 p-3 sm:p-4">
        {confirmation ? (
          <div className="mx-auto mb-3 max-w-4xl rounded-xl border border-primary/30 bg-accent/30 p-4" role="group" aria-label="LifeStack change confirmation">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Confirmation required</p>
                <h3 className="mt-1 font-semibold">{confirmation.preview.actionLabel}</h3>
                <p className="text-sm text-muted-foreground">{confirmation.preview.subjectTitle}</p>
              </div>
              <span className="rounded-full border bg-background px-2 py-1 text-xs capitalize">{confirmation.state}</span>
            </div>
            <dl className="mt-3 space-y-2">
              {confirmation.preview.changes.map((change) => (
                <div className="grid gap-0.5 text-sm sm:grid-cols-[8rem_1fr]" key={change.label}>
                  <dt className="font-medium">{change.label}</dt>
                  <dd className="break-words text-muted-foreground">
                    {change.before !== undefined ? (
                      <>
                        <span className="line-through">{change.before}</span>
                        <span aria-hidden="true"> → </span>
                      </>
                    ) : null}
                    {change.after}
                  </dd>
                </div>
              ))}
            </dl>
            {confirmation.error ? (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {confirmation.error}
              </p>
            ) : null}
            {confirmation.state === "pending" ? (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button onClick={() => void confirmMutation()} type="button">
                  <Check /> Confirm
                </Button>
                <Button onClick={() => void cancelConfirmation()} type="button" variant="outline">
                  <X /> Cancel
                </Button>
              </div>
            ) : null}
            {confirmation.state === "executing" ? (
              <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">
                Processing the confirmed change…
              </p>
            ) : null}
          </div>
        ) : null}
        {error ? (
          <div className="mx-auto mb-3 flex max-w-4xl flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between" role="alert">
            <span>
              {error.message}
              {error.requestId ? ` Reference: ${error.requestId.slice(0, 8)}` : ""}
            </span>
            <Button onClick={retry} size="sm" type="button" variant="outline">
              <RotateCcw /> Retry
            </Button>
          </div>
        ) : null}
        <form
          className="mx-auto flex max-w-4xl items-end gap-2"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            submitMessage(draft);
          }}
          ref={formRef}
        >
          <label className="sr-only" htmlFor="assistant-message">
            Message the LifeStack Assistant
          </label>
          <textarea className="min-h-12 max-h-40 flex-1 resize-y rounded-xl border bg-card px-4 py-3 text-sm outline-none focus-visible:ring-2 disabled:opacity-60" disabled={pending || confirmationLocked} id="assistant-message" maxLength={assistantLimits.maxUserMessageChars} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} placeholder="Ask about LifeStack or prepare a Task, Calendar, Goal, or assessment change…" ref={inputRef} rows={1} value={draft} />
          {pending ? (
            <Button aria-label="Stop generating" className="size-12 rounded-xl" onClick={() => abortRef.current?.abort()} size="icon" type="button" variant="outline">
              <Square />
            </Button>
          ) : (
            <Button aria-label="Send message" className="size-12 rounded-xl" disabled={!draft.trim() || confirmationLocked} size="icon" type="submit">
              <Send />
            </Button>
          )}
        </form>
        <p className="mt-2 text-center text-[0.6875rem] text-muted-foreground">Supported Task, native Calendar, Goal, and assessment changes execute only after Confirm · Finance remains read-only</p>
      </div>
    </div>
  );
}
