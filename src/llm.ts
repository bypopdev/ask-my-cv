import { AnthropicBedrockMantle } from "@anthropic-ai/bedrock-sdk";
import Anthropic from "@anthropic-ai/sdk";
import { answerQuestion, type AssistantResult, type MessagesClient } from "./assistant.js";
import type { Config, Provider } from "./config.js";
import type { ChatRequest } from "./guardrails.js";

/** One place answers can come from. Bedrock and the Claude API use different model ids. */
export interface ModelTarget {
  provider: Provider;
  client: MessagesClient;
  model: string;
}

/**
 * Primary model first, then the backup. The Claude API backup is used only when the primary is
 * Bedrock and ANTHROPIC_API_KEY is set. With a backup, Bedrock retries once instead of twice so a
 * failing primary does not eat the Lambda timeout.
 */
export function modelTargets(config: Config): ModelTarget[] {
  const anthropic = (): ModelTarget => ({ provider: "anthropic", client: new Anthropic(), model: config.anthropicModelId });
  if (config.provider === "anthropic") return [anthropic()];
  const bedrock: ModelTarget = {
    provider: "bedrock",
    client: new AnthropicBedrockMantle({ awsRegion: config.bedrockRegion, maxRetries: config.anthropicBackup ? 1 : 2 }),
    model: config.modelId,
  };
  return config.anthropicBackup ? [bedrock, anthropic()] : [bedrock];
}

export type FallbackResult = AssistantResult & { provider: Provider };

/**
 * Tries each target in order and returns the first answer. Any error moves on to the next target:
 * a blocked account, missing model access, throttling and outages all surface as different errors
 * per provider, and the backup costs nothing when it is not needed. Refusals and invalid output are
 * answers, not errors, so they never trigger the backup.
 */
export async function answerWithFallback(
  targets: ModelTarget[],
  request: ChatRequest,
  onFailure: (target: ModelTarget, err: unknown) => void = () => {},
): Promise<FallbackResult> {
  let lastError: unknown = new Error("No model configured.");
  for (const target of targets) {
    try {
      return { ...(await answerQuestion(target.client, target.model, request)), provider: target.provider };
    } catch (err) {
      lastError = err;
      onFailure(target, err);
    }
  }
  throw lastError;
}

/** Short, secret-free description of a failed call for the logs. */
export function describeError(err: unknown): string {
  if (err instanceof Anthropic.APIConnectionError) return `${err.constructor.name}: ${err.message}`;
  if (err instanceof Anthropic.APIError) return `${err.constructor.name} (${err.status ?? "no status"}): ${err.message}`;
  return err instanceof Error ? `${err.constructor.name}: ${err.message}` : String(err);
}
