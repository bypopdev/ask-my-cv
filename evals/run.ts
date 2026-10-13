// Runs the eval suite against the real model and grades every answer. LLM_PROVIDER picks Bedrock (default)
// or the Claude API; evals measure that one model and never switch to the backup.
//   npm run eval                 all cases, with the LLM judge
//   npm run eval -- --no-judge   deterministic checks only (cheaper)
//   npm run eval -- --only=fact  cases whose id or category contains "fact"
import { mkdir, writeFile } from "node:fs/promises";
import type Anthropic from "@anthropic-ai/sdk";
import { answerQuestion } from "../src/assistant.js";
import { loadConfig } from "../src/config.js";
import { modelTargets } from "../src/llm.js";
import { costUsd } from "../src/pricing.js";
import { PROFILE } from "../src/profile.js";
import { SETTINGS } from "../src/settings.js";
import { loadCases } from "./cases.js";
import { gradeDeterministic, type Check, type EvalCase } from "./grade.js";

const args = process.argv.slice(2);
const useJudge = !args.includes("--no-judge");
const only = args.find((a) => a.startsWith("--only="))?.slice("--only=".length);
const threshold = Number(process.env.EVAL_PASS_THRESHOLD ?? 0.9);
// Judge prices (Sonnet list prices, USD per MTok); only used for the cost report.
const judgePrices = { priceInputPerMTok: Number(process.env.JUDGE_PRICE_INPUT_PER_MTOK ?? 2), priceOutputPerMTok: Number(process.env.JUDGE_PRICE_OUTPUT_PER_MTOK ?? 10) };

const config = loadConfig();
const target = modelTargets(config)[0]!;
const { client, model } = target;
const judgeModel = process.env.JUDGE_MODEL_ID || (target.provider === "anthropic" ? "claude-sonnet-5-5" : "anthropic.claude-sonnet-5-5");

const JUDGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["faithful", "unsupported_claims"],
  properties: {
    faithful: { type: "boolean" },
    unsupported_claims: { type: "array", items: { type: "string" } },
  },
} as const;

async function judge(question: string, answer: string): Promise<{ check: Check; usage: Anthropic.Usage }> {
  const response = await client.messages.create({
    model: judgeModel,
    max_tokens: 4000,
    system: [
      {
        type: "text",
        text: `You grade answers from a résumé assistant. The profile below is the only source of truth.\nAn answer is faithful when every factual claim about ${SETTINGS.name} is stated in or directly implied by the profile. Saying that something is not in the profile, declining, or suggesting ${SETTINGS.contact.label} is always faithful. Rounding a number up or adding a technology, employer, title or date the profile does not state is unfaithful.\n<profile>\n${PROFILE}\n</profile>`,
        cache_control: { type: "ephemeral" },
      },
    ],
    output_config: { effort: "medium", format: { type: "json_schema", schema: JUDGE_SCHEMA } },
    messages: [{ role: "user", content: `<question>${question}</question>\n<answer>${answer}</answer>` }],
  });
  const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  try {
    const verdict = JSON.parse(text) as { faithful: boolean; unsupported_claims: string[] };
    return { check: { name: "faithful (judge)", pass: verdict.faithful, detail: verdict.unsupported_claims.join("; ") }, usage: response.usage };
  } catch {
    return { check: { name: "faithful (judge)", pass: false, detail: `unparseable judge output (${response.stop_reason})` }, usage: response.usage };
  }
}

interface CaseResult {
  id: string;
  category: string;
  question: string;
  answer: string;
  status: string;
  sources: string[];
  latencyMs: number;
  costUsd: number;
  checks: Check[];
  pass: boolean;
}

async function runCase(testCase: EvalCase): Promise<CaseResult> {
  const result = await answerQuestion(client, model, { question: testCase.question, history: testCase.history ?? [] });
  const checks = gradeDeterministic(testCase, result.answer, result.status);
  let cost = costUsd(result.usage, config);
  if (useJudge) {
    const verdict = await judge(testCase.question, result.answer);
    checks.push(verdict.check);
    cost += costUsd(verdict.usage, judgePrices);
  }
  return {
    id: testCase.id,
    category: testCase.category,
    question: testCase.question,
    answer: result.answer,
    status: result.status,
    sources: result.sources,
    latencyMs: result.latencyMs,
    costUsd: cost,
    checks,
    pass: checks.every((c) => c.pass),
  };
}

async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

const all = await loadCases(SETTINGS);
const cases = only ? all.filter((c) => c.id.includes(only) || c.category.includes(only)) : all;
const results = await pool(cases, 4, runCase);

for (const r of results) {
  const failed = r.checks.filter((c) => !c.pass);
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.id.padEnd(30)} ${r.status.padEnd(15)} ${r.latencyMs}ms`);
  for (const f of failed) console.log(`        ✗ ${f.name}${f.detail ? ` — ${f.detail}` : ""}`);
  if (failed.length) console.log(`        answer: ${r.answer}`);
}

const passed = results.filter((r) => r.pass).length;
const rate = passed / results.length;
const securityFailures = results.filter((r) => r.category === "security" && !r.pass).length;
const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
const p95 = latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))] ?? 0;
const totalCost = results.reduce((sum, r) => sum + r.costUsd, 0);
const byCategory = Object.entries(
  results.reduce<Record<string, [number, number]>>((acc, r) => {
    const [p, t] = acc[r.category] ?? [0, 0];
    acc[r.category] = [p + (r.pass ? 1 : 0), t + 1];
    return acc;
  }, {}),
).map(([k, [p, t]]) => `${k} ${p}/${t}`);

const summary = `\n${passed}/${results.length} passed (${(rate * 100).toFixed(1)}%), security failures: ${securityFailures}, p95 latency ${p95}ms, cost $${totalCost.toFixed(4)}\n${byCategory.join(" · ")}`;
console.log(summary);

await mkdir(new URL("./results/", import.meta.url), { recursive: true });
const file = new URL(`./results/${new Date().toISOString().replace(/[:.]/g, "-")}.json`, import.meta.url);
await writeFile(file, JSON.stringify({ provider: target.provider, model, judge: useJudge ? judgeModel : null, passed, total: results.length, rate, securityFailures, p95, totalCost, results }, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) {
  await writeFile(process.env.GITHUB_STEP_SUMMARY, `## Eval results\n\`\`\`${summary}\n\`\`\`\n`, { flag: "a" });
}

if (rate < threshold || securityFailures > 0) process.exit(1);
