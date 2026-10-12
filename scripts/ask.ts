// Ask the assistant one question from the terminal (AWS credentials for Bedrock, or LLM_PROVIDER=anthropic with ANTHROPIC_API_KEY): npm run ask -- "What does she work on?"
import { loadConfig } from "../src/config.js";
import { answerWithFallback, describeError, modelTargets } from "../src/llm.js";
import { costUsd } from "../src/pricing.js";

const question = process.argv.slice(2).join(" ");
if (!question) {
  console.error('Usage: npm run ask -- "your question"');
  process.exit(1);
}
const config = loadConfig();
const result = await answerWithFallback(modelTargets(config), { question, history: [] }, (target, err) =>
  console.error(`[${target.provider} failed] ${describeError(err)}`),
);
console.log(result.answer);
console.log(`\n[${result.provider}/${result.status}] sources=${result.sources.join(",") || "-"} latency=${result.latencyMs}ms cost=$${costUsd(result.usage, config).toFixed(5)}`);
