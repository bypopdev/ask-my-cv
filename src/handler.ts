import { createHash } from "node:crypto";
import type { LambdaFunctionURLEvent } from "aws-lambda";
import { loadConfig, type Config } from "./config.js";
import { validateRequest } from "./guardrails.js";
import { DynamoLimiter, type Limiter } from "./limits.js";
import { answerWithFallback, describeError, modelTargets, type ModelTarget } from "./llm.js";
import { emfLine } from "./metrics.js";
import { costUsd } from "./pricing.js";
import { SETTINGS } from "./settings.js";

export interface Deps {
  config: Config;
  /** Primary model first, then the backup. */
  targets: ModelTarget[];
  limiter: Limiter;
  log: (line: string) => void;
  today: () => string;
}

export interface HttpResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

function json(statusCode: number, body: unknown): HttpResult {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

function visitorId(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export function createHandler(deps: Deps) {
  return async (event: LambdaFunctionURLEvent): Promise<HttpResult> => {
    const { config, targets, limiter, log } = deps;
    if (event.requestContext.http.method !== "POST") return json(405, { error: "Use POST." });

    let body: unknown;
    try {
      const raw = event.isBase64Encoded ? Buffer.from(event.body ?? "", "base64").toString("utf8") : event.body;
      body = JSON.parse(raw ?? "");
    } catch {
      return json(400, { error: "Body must be valid JSON." });
    }
    const validation = validateRequest(body);
    if (!validation.ok) return json(400, { error: validation.error });

    const day = deps.today();
    const visitor = visitorId(event.requestContext.http.sourceIp, config.ipHashSalt);
    if (!(await limiter.takeRequest(visitor, day, config.perIpDailyLimit))) {
      log(emfLine({ status: "rate_limited", latencyMs: 0, costUsd: 0 }));
      return json(429, { error: `Daily question limit reached. Please come back tomorrow or contact ${SETTINGS.name} on ${SETTINGS.contact.label}.` });
    }
    if ((await limiter.spentToday(day)) >= config.dailyBudgetUsd) {
      log(emfLine({ status: "budget_exhausted", latencyMs: 0, costUsd: 0 }));
      return json(429, { error: `The assistant has reached today's budget. Please come back tomorrow or contact ${SETTINGS.name} on ${SETTINGS.contact.label}.` });
    }

    try {
      const result = await answerWithFallback(targets, validation.value, (target, err) =>
        console.error(`model call failed on ${target.provider}: ${describeError(err)}`),
      );
      const cost = costUsd(result.usage, config);
      await limiter.recordSpend(day, cost);
      log(emfLine({ status: result.status, provider: result.provider, latencyMs: result.latencyMs, costUsd: cost, usage: result.usage, question: validation.value.question }));
      return json(200, { answer: result.answer, status: result.status, sources: result.sources });
    } catch (err) {
      log(emfLine({ status: "error", latencyMs: 0, costUsd: 0 }));
      return json(502, { error: "The assistant is temporarily unavailable. Please try again later." });
    }
  };
}

const config = loadConfig();
export const handler = createHandler({
  config,
  targets: modelTargets(config),
  limiter: new DynamoLimiter(config.tableName),
  log: (line) => console.log(line),
  today: () => new Date().toISOString().slice(0, 10),
});
