import { describe, expect, it } from "vitest";
import { answerQuestion, parseAnswer } from "../src/assistant.js";
import { ANSWER_SCHEMA, CANARY } from "../src/prompt.js";
import { fakeClient, message } from "./fixtures.js";

const request = { question: "What did she change in the payouts service?", history: [] };
const good = JSON.stringify({ answer: "She moved payout batching to an outbox pattern.", status: "answered", sources: ["ledgerline.payouts"] });

describe("parseAnswer", () => {
  it("accepts a valid answer", () => {
    expect(parseAnswer(good)).toEqual({ answer: "She moved payout batching to an outbox pattern.", status: "answered", sources: ["ledgerline.payouts"] });
  });

  it.each([
    ["not json"],
    [JSON.stringify({ answer: "", status: "answered", sources: [] })],
    [JSON.stringify({ answer: "x", status: "maybe", sources: [] })],
    [JSON.stringify({ answer: "x", status: "answered", sources: ["made.up"] })],
    [JSON.stringify({ answer: `leak ${CANARY}`, status: "answered", sources: [] })],
  ])("rejects %s", (text) => {
    expect(parseAnswer(text)).toBeNull();
  });
});

describe("answerQuestion", () => {
  it("sends the profile as a cached system block and asks for structured JSON", async () => {
    const { client, calls } = fakeClient(message(good));
    const result = await answerQuestion(client, "anthropic.claude-haiku-5-5", request);

    expect(result.status).toBe("answered");
    const params = calls[0]!;
    expect(params.model).toBe("anthropic.claude-haiku-5-5");
    expect(params.output_config).toEqual({ effort: "low", format: { type: "json_schema", schema: ANSWER_SCHEMA } });
    const system = params.system as Array<{ text: string; cache_control?: unknown }>;
    expect(system[1]!.text).toContain("<profile>");
    expect(system[1]!.cache_control).toEqual({ type: "ephemeral" });
    expect(params.messages).toEqual([{ role: "user", content: "What did she change in the payouts service?" }]);
  });

  it("maps a refusal to a safe fallback", async () => {
    const { client } = fakeClient(message("", "refusal"));
    const result = await answerQuestion(client, "m", request);
    expect(result.status).toBe("refused");
    expect(result.sources).toEqual([]);
  });

  it("never returns truncated output", async () => {
    const { client } = fakeClient(message(good.slice(0, 20), "max_tokens"));
    expect((await answerQuestion(client, "m", request)).status).toBe("invalid_output");
  });
});
