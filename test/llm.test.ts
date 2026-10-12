import { describe, expect, it, vi } from "vitest";
import type { Config } from "../src/config.js";
import { fakeClient, message } from "./fixtures.js";

vi.mock("@anthropic-ai/bedrock-sdk", () => ({
  AnthropicBedrockMantle: class {
    constructor(readonly options: unknown) {}
  },
}));
const { answerWithFallback, modelTargets } = await import("../src/llm.js");

const base: Config = {
  provider: "bedrock",
  bedrockRegion: "eu-central-1",
  modelId: "anthropic.claude-haiku-5-5",
  anthropicModelId: "claude-haiku-5-5",
  anthropicBackup: false,
  tableName: "t",
  dailyBudgetUsd: 0.1,
  perIpDailyLimit: 2,
  ipHashSalt: "salt",
  priceInputPerMTok: 0.1,
  priceOutputPerMTok: 0.5,
};
const good = JSON.stringify({ answer: "Since 2020.", status: "answered", sources: ["basics"] });
const refusal = message("", "refusal");
const request = { question: "Hi", history: [] };

describe("modelTargets", () => {
  it("uses only Bedrock without an API key", () => {
    expect(modelTargets(base).map((t) => [t.provider, t.model])).toEqual([["bedrock", "anthropic.claude-haiku-5-5"]]);
  });

  it("adds the Claude API as a backup after Bedrock", () => {
    const targets = modelTargets({ ...base, anthropicBackup: true });
    expect(targets.map((t) => [t.provider, t.model])).toEqual([
      ["bedrock", "anthropic.claude-haiku-5-5"],
      ["anthropic", "claude-haiku-5-5"],
    ]);
  });

  it("uses only the Claude API when it is the primary provider", () => {
    expect(modelTargets({ ...base, provider: "anthropic", anthropicBackup: true }).map((t) => t.provider)).toEqual(["anthropic"]);
  });
});

describe("answerWithFallback", () => {
  it("does not call the backup when the primary answers", async () => {
    const primary = fakeClient(message(good));
    const backup = fakeClient(message(good));
    const result = await answerWithFallback(
      [
        { provider: "bedrock", client: primary.client, model: "a" },
        { provider: "anthropic", client: backup.client, model: "b" },
      ],
      request,
    );
    expect(result.provider).toBe("bedrock");
    expect(backup.calls).toHaveLength(0);
  });

  it("keeps a refusal from the primary instead of retrying elsewhere", async () => {
    const primary = fakeClient(refusal);
    const backup = fakeClient(message(good));
    const result = await answerWithFallback(
      [
        { provider: "bedrock", client: primary.client, model: "a" },
        { provider: "anthropic", client: backup.client, model: "b" },
      ],
      request,
    );
    expect(result.status).toBe("refused");
    expect(backup.calls).toHaveLength(0);
  });

  it("reports each failure and rethrows the last error when all targets fail", async () => {
    const failures: string[] = [];
    const run = answerWithFallback(
      [
        { provider: "bedrock", client: fakeClient(new Error("first")).client, model: "a" },
        { provider: "anthropic", client: fakeClient(new Error("second")).client, model: "b" },
      ],
      request,
      (target) => failures.push(target.provider),
    );
    await expect(run).rejects.toThrow("second");
    expect(failures).toEqual(["bedrock", "anthropic"]);
  });
});
