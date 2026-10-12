import type Anthropic from "@anthropic-ai/sdk";

export interface RequestRecord {
  status: string;
  /** Which model answered (bedrock or anthropic); absent when no model was called. */
  provider?: string;
  latencyMs: number;
  costUsd: number;
  usage?: Anthropic.Usage;
  question?: string;
}

/** One CloudWatch Embedded Metric Format line: metrics without extra API calls or agents. */
export function emfLine(record: RequestRecord, now = Date.now()): string {
  const usage = record.usage;
  return JSON.stringify({
    _aws: {
      Timestamp: now,
      CloudWatchMetrics: [
        {
          Namespace: "AskMyCv",
          Dimensions: [["Status"], ["Provider"]],
          Metrics: [
            { Name: "Requests", Unit: "Count" },
            { Name: "LatencyMs", Unit: "Milliseconds" },
            { Name: "CostMicroUsd", Unit: "Count" },
            { Name: "InputTokens", Unit: "Count" },
            { Name: "OutputTokens", Unit: "Count" },
            { Name: "CacheReadTokens", Unit: "Count" },
          ],
        },
      ],
    },
    Status: record.status,
    Provider: record.provider ?? "none",
    Requests: 1,
    LatencyMs: record.latencyMs,
    CostMicroUsd: Math.round(record.costUsd * 1_000_000),
    InputTokens: usage?.input_tokens ?? 0,
    OutputTokens: usage?.output_tokens ?? 0,
    CacheReadTokens: usage?.cache_read_input_tokens ?? 0,
    // Kept for the "what did people ask that the profile can't answer" review; no IPs are logged.
    Question: record.question?.slice(0, 300),
  });
}
