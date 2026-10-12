import type { LambdaFunctionURLEvent } from "aws-lambda";
import { describe, expect, it, vi } from "vitest";
import type { Config } from "../src/config.js";
import { MemoryLimiter } from "../src/limits.js";
import { fakeClient, message } from "./fixtures.js";

vi.mock("@anthropic-ai/bedrock-sdk", () => ({ AnthropicBedrockMantle: class {} }));
const { createHandler } = await import("../src/handler.js");

const config: Config = {
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

function event(body: unknown, method = "POST", ip = "203.0.113.7"): LambdaFunctionURLEvent {
  return {
    body: typeof body === "string" ? body : JSON.stringify(body),
    isBase64Encoded: false,
    requestContext: { http: { method, sourceIp: ip } },
  } as unknown as LambdaFunctionURLEvent;
}

function setup(reply = message(good)) {
  const limiter = new MemoryLimiter();
  const lines: string[] = [];
  const { client, calls } = fakeClient(reply);
  const targets = [{ provider: "bedrock" as const, client, model: config.modelId }];
  const handler = createHandler({ config, targets, limiter, log: (l) => lines.push(l), today: () => "2026-10-12" });
  return { handler, limiter, lines, calls };
}

describe("handler", () => {
  it("answers and records spend and metrics", async () => {
    const { handler, limiter, lines } = setup();
    const res = await handler(event({ question: "How long at Ledgerline?" }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ answer: "Since 2020.", status: "answered", sources: ["basics"] });
    expect(await limiter.spentToday("2026-10-12")).toBeCloseTo(3000 * 0.1e-6 + 200 * 0.5e-6);
    const metric = JSON.parse(lines[0]!);
    expect(metric.Status).toBe("answered");
    expect(metric.Provider).toBe("bedrock");
    expect(JSON.stringify(metric)).not.toContain("203.0.113.7");
  });

  it("rejects bad input before calling the model", async () => {
    const { handler, calls } = setup();
    expect((await handler(event("{oops"))).statusCode).toBe(400);
    expect((await handler(event({ question: "" }))).statusCode).toBe(400);
    expect((await handler(event({ question: "x" }, "GET"))).statusCode).toBe(405);
    expect(calls).toHaveLength(0);
  });

  it("enforces the per-visitor daily limit", async () => {
    const { handler, calls } = setup();
    await handler(event({ question: "1" }));
    await handler(event({ question: "2" }));
    expect((await handler(event({ question: "3" }))).statusCode).toBe(429);
    expect((await handler(event({ question: "4" }, "POST", "198.51.100.1"))).statusCode).toBe(200);
    expect(calls).toHaveLength(3);
  });

  it("stops calling the model once the daily budget is spent", async () => {
    const { handler, limiter, calls } = setup();
    await limiter.recordSpend("2026-10-12", 0.1);
    const res = await handler(event({ question: "Hi" }));
    expect(res.statusCode).toBe(429);
    expect(calls).toHaveLength(0);
  });

  it("returns 502 when every model call fails", async () => {
    const limiter = new MemoryLimiter();
    const { client } = fakeClient(new Error("boom"));
    const { client: backup } = fakeClient(new Error("also down"));
    const targets = [
      { provider: "bedrock" as const, client, model: config.modelId },
      { provider: "anthropic" as const, client: backup, model: config.anthropicModelId },
    ];
    const handler = createHandler({ config, targets, limiter, log: () => {}, today: () => "d" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await handler(event({ question: "Hi" }))).statusCode).toBe(502);
  });

  it("answers from the backup when the primary model fails", async () => {
    const limiter = new MemoryLimiter();
    const lines: string[] = [];
    const { client, calls } = fakeClient(new Error("AccessDeniedException"));
    const { client: backup, calls: backupCalls } = fakeClient(message(good));
    const targets = [
      { provider: "bedrock" as const, client, model: config.modelId },
      { provider: "anthropic" as const, client: backup, model: config.anthropicModelId },
    ];
    const handler = createHandler({ config, targets, limiter, log: (l) => lines.push(l), today: () => "2026-10-12" });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await handler(event({ question: "Hi" }));
    expect(res.statusCode).toBe(200);
    expect(calls[0]?.model).toBe("anthropic.claude-haiku-5-5");
    expect(backupCalls[0]?.model).toBe("claude-haiku-5-5");
    expect(JSON.parse(lines[0]!).Provider).toBe("anthropic");
    expect(errors).toHaveBeenCalledWith(expect.stringContaining("bedrock"));
    expect(await limiter.spentToday("2026-10-12")).toBeGreaterThan(0);
  });
});
