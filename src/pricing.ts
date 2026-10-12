import type Anthropic from "@anthropic-ai/sdk";

export interface Prices {
  priceInputPerMTok: number;
  priceOutputPerMTok: number;
}

/** Cache reads bill at 10% of input, cache writes at 125% (5-minute cache). */
export function costUsd(usage: Anthropic.Usage, prices: Prices): number {
  const perToken = prices.priceInputPerMTok / 1_000_000;
  const input =
    usage.input_tokens * perToken +
    (usage.cache_read_input_tokens ?? 0) * perToken * 0.1 +
    (usage.cache_creation_input_tokens ?? 0) * perToken * 1.25;
  const output = usage.output_tokens * (prices.priceOutputPerMTok / 1_000_000);
  return input + output;
}
