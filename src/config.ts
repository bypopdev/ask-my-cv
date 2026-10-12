export type Provider = "bedrock" | "anthropic";

export interface Config {
  /** Where answers come from first. */
  provider: Provider;
  bedrockRegion: string;
  /** Bedrock model id (used when provider is "bedrock"). */
  modelId: string;
  /** Claude API model id: the primary model when provider is "anthropic", otherwise the backup. */
  anthropicModelId: string;
  /** Use the Claude API as a backup when Bedrock fails; needs ANTHROPIC_API_KEY. */
  anthropicBackup: boolean;
  tableName: string;
  dailyBudgetUsd: number;
  perIpDailyLimit: number;
  ipHashSalt: string;
  /** USD per million tokens. Defaults follow Anthropic list prices; set the Bedrock rates for your region. */
  priceInputPerMTok: number;
  priceOutputPerMTok: number;
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid number in ${name}: ${raw}`);
  return value;
}

function provider(): Provider {
  const raw = process.env.LLM_PROVIDER ?? "bedrock";
  if (raw !== "bedrock" && raw !== "anthropic") throw new Error(`Invalid LLM_PROVIDER: ${raw} (use bedrock or anthropic)`);
  return raw;
}

export function loadConfig(): Config {
  return {
    provider: provider(),
    bedrockRegion: process.env.BEDROCK_REGION ?? process.env.AWS_REGION ?? "eu-central-1",
    modelId: process.env.MODEL_ID ?? "anthropic.claude-haiku-5-5",
    anthropicModelId: process.env.ANTHROPIC_MODEL_ID ?? "claude-haiku-5-5",
    anthropicBackup: (process.env.ANTHROPIC_API_KEY ?? "") !== "",
    tableName: process.env.TABLE_NAME ?? "",
    dailyBudgetUsd: num("DAILY_BUDGET_USD", 0.1),
    perIpDailyLimit: num("PER_IP_DAILY_LIMIT", 30),
    ipHashSalt: process.env.IP_HASH_SALT ?? "",
    priceInputPerMTok: num("PRICE_INPUT_PER_MTOK", 0.1),
    priceOutputPerMTok: num("PRICE_OUTPUT_PER_MTOK", 0.5),
  };
}
