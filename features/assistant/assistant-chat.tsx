"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { Bot, ExternalLink, RotateCcw, Send, Square, Trash2, UserRound } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { AssistantMessage, AssistantReference, AssistantStreamEvent } from "./contracts";
import { boundAssistantConversation } from "./conversation";
import { assistantLimits } from "./limits";
import { AssistantClientError, consumeAssistantStream } from "./stream-client";

const suggestions = ["What's on my schedule today?", "What assignments are coming up?", "Do I have any overdue tasks?", "What bills are due soon?"];
type ChatMessage = AssistantMessage & { id: string; complete: boolean; references: AssistantReference[] };
type ChatError = { message: string; code: string; requestId?: string };

export function AssistantChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [phase, setPhase] = useState<"thinking" | "using_tools">("thinking");
  const [error, setError] = useState<ChatError | null>(null);
  const [contextTrimmed, setContextTrimmed] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const retryHistoryRef = useRef<AssistantMessage[] | null>(null);
  const retryVisibleRef = useRef<ChatMessage[] | null>(null);
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    viewportRef.current?.scrollTo({ top: viewportRef.current.scrollHeight, behavior: pending ? "auto" : "smooth" });
  }, [messages, pending]);

  function updateAssistant(id: string, updater: (message: ChatMessage) => ChatMessage) {
    setMessages((current) => current.map((message) => message.id === id ? updater(message) : message));
  }

  async function runRequest(history: AssistantMessage[], visibleBase?: ChatMessage[]) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setPhase("thinking");
    setError(null);
    stickToBottomRef.current = true;
    const bounded = boundAssistantConversation(history);
    setContextTrimmed(bounded.trimmed);
    const assistantId = crypto.randomUUID();
    const visibleHistory: ChatMessage[] = visibleBase ?? history.map((message) => ({ ...message, id: crypto.randomUUID(), complete: true, references: [] }));
    setMessages([...visibleHistory, { id: assistantId, role: "assistant", content: "", complete: false, references: [] }]);
    retryHistoryRef.current = history;
    retryVisibleRef.current = visibleHistory;
    const abortController = new AbortController();
    abortRef.current = abortController;
    try {
      const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: bounded.messages }), signal: abortController.signal });
      await consumeAssistantStream(response, (event: AssistantStreamEvent) => {
        if (event.type === "status") setPhase(event.phase);
        else if (event.type === "delta") updateAssistant(assistantId, (message) => ({ ...message, content: message.content + event.text }));
        else if (event.type === "done") updateAssistant(assistantId, (message) => ({ ...message, complete: true, references: event.references }));
      });
      retryHistoryRef.current = null;
      retryVisibleRef.current = null;
      inputRef.current?.focus();
    } catch (caught) {
      if (abortController.signal.aborted) {
        setMessages((current) => current.flatMap((message) => message.id !== assistantId ? [message] : message.content ? [{ ...message, complete: false }] : []));
      } else {
        const clientError = caught instanceof AssistantClientError ? caught : new AssistantClientError("The Assistant could not complete the request. Your LifeStack data was not changed.");
        setError({ message: clientError.message, code: clientError.code, requestId: clientError.requestId });
        setMessages((current) => current.flatMap((message) => message.id !== assistantId ? [message] : message.content ? [{ ...message, complete: false }] : []));
      }
    } finally {
      if (abortRef.current === abortController) abortRef.current = null;
      pendingRef.current = false;
      setPending(false);
    }
  }

  function submitMessage(content: string) {
    const value = content.trim();
    if (!value || pendingRef.current) return;
    const history = messages.filter((message) => message.complete).map(({ role, content: messageContent }) => ({ role, content: messageContent } satisfies AssistantMessage));
    const next = [...history, { role: "user" as const, content: value }];
    const visible = [...messages, { id: crypto.randomUUID(), role: "user" as const, content: value, complete: true, references: [] }];
    setDraft("");
    void runRequest(next, visible);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); submitMessage(draft); }
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); formRef.current?.requestSubmit(); } }
  function clearConversation() { abortRef.current?.abort(); retryHistoryRef.current = null; retryVisibleRef.current = null; setMessages([]); setError(null); setDraft(""); setContextTrimmed(false); }
  function retry() { const history = retryHistoryRef.current; const visible = retryVisibleRef.current; if (history && visible) void runRequest(history, visible); }
  function onScroll() { const viewport = viewportRef.current; if (viewport) stickToBottomRef.current = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 96; }

  return (
    <div className="flex min-h-[calc(100dvh-12rem)] flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <p className="text-xs text-muted-foreground">Read-only · Session-local conversation</p>
        <Button disabled={!messages.length && !pending} onClick={clearConversation} size="sm" type="button" variant="ghost"><Trash2 /> New chat</Button>
      </div>
      <div aria-live="polite" className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6" onScroll={onScroll} ref={viewportRef}>
        {contextTrimmed ? <p className="mx-auto w-fit rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">Using the most recent {assistantLimits.maxConversationMessages} messages for context.</p> : null}
        {!messages.length ? <div className="mx-auto flex min-h-[24rem] max-w-2xl flex-col items-center justify-center text-center"><span className="flex size-14 items-center justify-center rounded-2xl bg-accent text-primary"><Bot className="size-7" /></span><h2 className="mt-5 text-xl font-semibold">Ask about your LifeStack</h2><p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">I can inspect your Calendar, Finance, School, Tasks, and Goals. I cannot change your data.</p><div className="mt-7 grid w-full gap-2 sm:grid-cols-2">{suggestions.map((suggestion) => <button className="rounded-xl border bg-background px-4 py-3 text-left text-sm transition-colors hover:border-primary/40 hover:bg-muted/45 disabled:opacity-50" disabled={pending} key={suggestion} onClick={() => submitMessage(suggestion)} type="button">{suggestion}</button>)}</div></div> : messages.map((message) => (
          <div className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`} key={message.id}>
            {message.role === "assistant" ? <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary"><Bot className="size-4" /></span> : null}
            <div className="max-w-[90%] sm:max-w-[75%]"><div className={message.role === "user" ? "rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground" : "whitespace-pre-wrap break-words rounded-2xl rounded-bl-md bg-muted px-4 py-3 text-sm leading-6"}>{message.content || (pending ? <span className="animate-pulse text-muted-foreground">{phase === "using_tools" ? "Checking LifeStack…" : "Thinking…"}</span> : null)}</div>{message.references.length ? <div aria-label="Related LifeStack records" className="mt-2 flex flex-wrap gap-2">{message.references.map((reference) => <Link className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-primary hover:bg-muted" href={reference.href} key={`${reference.type}:${reference.id}`}><ExternalLink className="size-3" />{reference.label}</Link>)}</div> : null}{!message.complete && message.content && !pending ? <p className="mt-1 text-xs text-muted-foreground">Generation stopped before completion.</p> : null}</div>
            {message.role === "user" ? <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground"><UserRound className="size-4" /></span> : null}
          </div>
        ))}
      </div>
      <div className="border-t bg-background/80 p-3 sm:p-4">
        {error ? <div className="mb-3 flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between" role="alert"><span>{error.message}{error.requestId ? <span className="ml-1 text-xs opacity-70">Reference: {error.requestId.slice(0, 8)}</span> : null}</span><Button onClick={retry} size="sm" type="button" variant="outline"><RotateCcw /> Retry</Button></div> : null}
        <form className="mx-auto flex max-w-4xl items-end gap-2" onSubmit={onSubmit} ref={formRef}><label className="sr-only" htmlFor="assistant-message">Message the LifeStack Assistant</label><textarea className="min-h-12 max-h-40 flex-1 resize-y rounded-xl border bg-card px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:opacity-60" disabled={pending} id="assistant-message" maxLength={assistantLimits.maxUserMessageChars} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} placeholder="Ask about your day, tasks, classes, bills, or goals…" ref={inputRef} rows={1} value={draft} />{pending ? <Button aria-label="Stop generating" className="size-12 rounded-xl" onClick={() => abortRef.current?.abort()} size="icon" type="button" variant="outline"><Square /></Button> : <Button aria-label="Send message" className="size-12 rounded-xl" disabled={!draft.trim()} size="icon" type="submit"><Send /></Button>}</form>
        <p className="mt-2 text-center text-[0.6875rem] text-muted-foreground">Enter to send · Shift+Enter for a new line · No LifeStack data can be changed</p>
      </div>
    </div>
  );
}
