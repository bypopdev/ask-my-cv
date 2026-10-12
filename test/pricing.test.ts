import { describe, expect, it } from "vitest";
import { MemoryLimiter } from "../src/limits.js";
import { costUsd } from "../src/pricing.js";
import { usage } from "./fixtures.js";

describe("costUsd", () => {
  it("prices cache reads and writes", () => {
    const prices = { priceInputPerMTok: 1, priceOutputPerMTok: 5 };
    const cost = costUsd(usage({ input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 2000, cache_creation_input_tokens: 400 }), prices);
    expect(cost).toBeCloseTo(0.001 + 0.0002 + 0.0005 + 0.0005);
  });
});

describe("MemoryLimiter", () => {
  it("counts requests per visitor and day", async () => {
    const limiter = new MemoryLimiter();
    expect(await limiter.takeRequest("a", "d1", 1)).toBe(true);
    expect(await limiter.takeRequest("a", "d1", 1)).toBe(false);
    expect(await limiter.takeRequest("b", "d1", 1)).toBe(true);
    expect(await limiter.takeRequest("a", "d2", 1)).toBe(true);
  });

  it("adds up spend per day", async () => {
    const limiter = new MemoryLimiter();
    await limiter.recordSpend("d1", 0.02);
    await limiter.recordSpend("d1", 0.03);
    expect(await limiter.spentToday("d1")).toBeCloseTo(0.05);
    expect(await limiter.spentToday("d2")).toBe(0);
  });
});
