import type Anthropic from "@anthropic-ai/sdk";
import type { MessagesClient } from "../src/assistant.js";

export function usage(partial: Partial<Anthropic.Usage> = {}): Anthropic.Usage {
  return {
    input_tokens: 3000,
    output_tokens: 200,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    ...partial,
  } as Anthropic.Usage;
}

export function message(text: string, stop_reason: Anthropic.StopReason = "end_turn"): Anthropic.Message {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "anthropic.claude-haiku-5-5",
    content: [{ type: "text", text, citations: null }],
    stop_reason,
    stop_sequence: null,
    usage: usage(),
  } as unknown as Anthropic.Message;
}

export function fakeClient(reply: Anthropic.Message | Error) {
  const calls: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const client: MessagesClient = {
    messages: {
      async create(params) {
        calls.push(params);
        if (reply instanceof Error) throw reply;
        return reply;
      },
    },
  };
  return { client, calls };
}
