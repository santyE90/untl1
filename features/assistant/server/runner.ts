import "server-only";

import OpenAI from "openai";
import type { Response, ResponseCreateParamsStreaming, ResponseFunctionToolCall, ResponseInputItem, ResponseOutputItem, ResponseOutputMessage, ResponseReasoningItem, ResponseStreamEvent } from "openai/resources/responses/responses";

import type { AssistantMessage, AssistantReference, AssistantStreamEvent } from "../contracts";
import { assistantLimits } from "../limits";
import type { AuthenticatedAppContext } from "@/features/shared/server-context";
import { assistantConfig, getOpenAIApiKey } from "./config";
import { assistantInstructions } from "./prompt";
import { assistantMutationToolDefinitions, assistantMutationToolNames } from "./mutation-tools";
import { proposeAssistantTaskMutation } from "./mutation-proposals";
import { uniqueReferences } from "./references";
import { assistantToolDefinitions, executeAssistantTool } from "./tools";

export type AssistantResponseClient = { create: (params: ResponseCreateParamsStreaming, options?: { signal?: AbortSignal }) => Promise<AsyncIterable<ResponseStreamEvent>> };

export class AssistantRuntimeError extends Error {
  constructor(public readonly code: "configuration" | "rate_limit" | "provider" | "malformed_response" | "tool_limit" | "aborted", message: string) { super(message); }
}

function openAIClient(): AssistantResponseClient {
  const client = new OpenAI({ apiKey: getOpenAIApiKey() });
  return { create: async (params, options) => client.responses.create(params, { signal: options?.signal }) };
}

function providerError(error: unknown): never {
  if (error instanceof AssistantRuntimeError) throw error;
  if (error instanceof OpenAI.APIUserAbortError) throw new AssistantRuntimeError("aborted", "Generation was stopped.");
  if (error instanceof OpenAI.RateLimitError) throw new AssistantRuntimeError("rate_limit", "The Assistant is temporarily unavailable because its OpenAI usage limit was reached.");
  if (error instanceof OpenAI.APIError) throw new AssistantRuntimeError("provider", "The AI service is currently unavailable. Your LifeStack data was not changed.");
  if (error instanceof Error && error.message.startsWith("OPENAI_API_KEY")) throw new AssistantRuntimeError("configuration", error.message);
  throw new AssistantRuntimeError("provider", "The Assistant could not complete the request. Your LifeStack data was not changed.");
}

function replayableOutput(item: ResponseOutputItem): item is ResponseOutputMessage | ResponseFunctionToolCall | ResponseReasoningItem {
  return item.type === "message" || item.type === "function_call" || item.type === "reasoning";
}

function modelResult(result: Awaited<ReturnType<typeof executeAssistantTool>>) {
  return result.ok ? { ok: true as const, data: result.data } : result;
}

export async function* streamAssistant({ messages, context, signal, client, onTool }: { messages: AssistantMessage[]; context: AuthenticatedAppContext; signal?: AbortSignal; client?: AssistantResponseClient; onTool?: (name: string) => void }): AsyncGenerator<AssistantStreamEvent> {
  let input: ResponseInputItem[] = messages.map((message) => ({ role: message.role, content: message.content }));
  let toolIterations = 0;
  let toolCalls = 0;
  let references: AssistantReference[] = [];
  let emittedText = false;

  try {
    const responseClient = client ?? openAIClient();
    while (true) {
      if (signal?.aborted) throw new AssistantRuntimeError("aborted", "Generation was stopped.");
      yield { type: "status", phase: "thinking" };
      const instructions = `${assistantInstructions}\nTrusted temporal context: the user's current local date is ${context.today}, and their IANA timezone is ${context.timeZone}.`;
      const stream = await responseClient.create({ model: assistantConfig.model, instructions, input, tools: [...assistantToolDefinitions, ...assistantMutationToolDefinitions], tool_choice: "auto", parallel_tool_calls: true, max_output_tokens: assistantConfig.maxOutputTokens, reasoning: { effort: assistantConfig.reasoningEffort }, store: false, stream: true }, { signal });
      let completed: Response | null = null;
      for await (const event of stream) {
        if (signal?.aborted) throw new AssistantRuntimeError("aborted", "Generation was stopped.");
        if (event.type === "response.output_text.delta") { emittedText = true; yield { type: "delta", text: event.delta }; }
        else if (event.type === "response.completed") completed = event.response;
        else if (event.type === "response.failed" || event.type === "error") throw new AssistantRuntimeError(event.type === "error" && event.code === "rate_limit_exceeded" ? "rate_limit" : "provider", "The AI service is currently unavailable. Your LifeStack data was not changed.");
      }
      if (!completed) throw new AssistantRuntimeError("malformed_response", "The Assistant stream ended before completion.");
      const calls = completed.output.filter((item) => item.type === "function_call");
      if (!calls.length) {
        if (!emittedText && completed.output_text.trim()) { emittedText = true; yield { type: "delta", text: completed.output_text }; }
        if (!emittedText) throw new AssistantRuntimeError("malformed_response", "The Assistant returned an empty response.");
        yield { type: "done", references: uniqueReferences(references, assistantLimits.maxReferences) };
        return;
      }
      if (toolIterations >= assistantConfig.maxToolIterations || toolCalls + calls.length > assistantConfig.maxToolCalls) throw new AssistantRuntimeError("tool_limit", "The Assistant reached its tool safety limit. Try a narrower question.");
      toolIterations += 1;
      toolCalls += calls.length;
      yield { type: "status", phase: "using_tools" };
      const mutationCalls = calls.filter((call) => assistantMutationToolNames.has(call.name));
      if (mutationCalls.length) {
        if (calls.length !== 1) throw new AssistantRuntimeError("malformed_response", "A Task change must be proposed separately from other tool calls.");
        const call = mutationCalls[0];
        onTool?.(call.name);
        const proposal = await proposeAssistantTaskMutation(call.name, call.arguments, context);
        if (proposal.ok) {
          yield { type: "confirmation", ...proposal.confirmation };
          yield { type: "done", references: [] };
          return;
        }
        input = [...input, ...completed.output.filter(replayableOutput), { type: "function_call_output", call_id: call.call_id, output: JSON.stringify(proposal) }];
        continue;
      }
      const executions = await Promise.all(calls.map(async (call) => {
        onTool?.(call.name);
        const result = await executeAssistantTool(call.name, call.arguments, context);
        if (result.ok && result.references) references = uniqueReferences([...references, ...result.references], assistantLimits.maxReferences);
        let output = JSON.stringify(modelResult(result));
        if (new TextEncoder().encode(output).byteLength > assistantLimits.maxToolResultBytes) output = JSON.stringify({ ok: false, error: { code: "result_too_large", message: "This result exceeded the Assistant's safe context limit. Ask a narrower question." } });
        return { type: "function_call_output" as const, call_id: call.call_id, output } satisfies ResponseInputItem.FunctionCallOutput;
      }));
      input = [...input, ...completed.output.filter(replayableOutput), ...executions];
    }
  } catch (error) {
    providerError(error);
  }
}
