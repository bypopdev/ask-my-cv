import type Anthropic from "@anthropic-ai/sdk";
import type { ChatRequest } from "./guardrails.js";
import { ANSWER_SCHEMA, CANARY, STATUSES, systemBlocks, type AnswerStatus, type StructuredAnswer } from "./prompt.js";
import { sectionIds } from "./profile.js";
import { SETTINGS } from "./settings.js";

/** The slice of the SDK client the assistant needs; lets tests pass a fake. */
export interface MessagesClient {
  messages: {
    create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
  };
}

export type Outcome = AnswerStatus | "refused" | "invalid_output";

export interface AssistantResult {
  answer: string;
  status: Outcome;
  sources: string[];
  usage: Anthropic.Usage;
  latencyMs: number;
}

export const MAX_OUTPUT_TOKENS = 2000;

const FALLBACK: Record<"refused" | "invalid_output", string> = {
  refused: `I can't help with that. Ask me about ${SETTINGS.name}'s experience, projects or skills.`,
  invalid_output: `Sorry, I couldn't produce a reliable answer. Please try rephrasing, or contact ${SETTINGS.name} on ${SETTINGS.contact.label}.`,
};

const KNOWN_SECTIONS = new Set(sectionIds());

/** Parses and checks the model's JSON; anything unexpected becomes null rather than reaching the visitor. */
export function parseAnswer(text: string): StructuredAnswer | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const { answer, status, sources } = data as Record<string, unknown>;
  if (typeof answer !== "string" || answer.trim() === "") return null;
  if (!STATUSES.includes(status as AnswerStatus)) return null;
  if (!Array.isArray(sources) || !sources.every((s) => typeof s === "string" && KNOWN_SECTIONS.has(s))) return null;
  if (answer.includes(CANARY)) return null;
  return { answer: answer.trim(), status: status as AnswerStatus, sources: sources as string[] };
}

export async function answerQuestion(
  client: MessagesClient,
  modelId: string,
  request: ChatRequest,
): Promise<AssistantResult> {
  const started = Date.now();
  const response = await client.messages.create({
    model: modelId,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: systemBlocks(),
    output_config: { effort: "low", format: { type: "json_schema", schema: ANSWER_SCHEMA } },
    messages: [...request.history, { role: "user", content: request.question }],
  });
  const latencyMs = Date.now() - started;
  const base = { usage: response.usage, latencyMs };

  if (response.stop_reason === "refusal") {
    return { ...base, answer: FALLBACK.refused, status: "refused", sources: [] };
  }
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
  const parsed = response.stop_reason === "end_turn" ? parseAnswer(text) : null;
  if (!parsed) {
    return { ...base, answer: FALLBACK.invalid_output, status: "invalid_output", sources: [] };
  }
  return { ...base, ...parsed };
}
