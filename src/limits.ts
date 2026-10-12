import { ConditionalCheckFailedException, DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

export interface Limiter {
  /** Counts one request for this visitor today; false once the daily limit is reached. */
  takeRequest(visitor: string, day: string, limit: number): Promise<boolean>;
  /** Spend recorded today, in USD. */
  spentToday(day: string): Promise<number>;
  recordSpend(day: string, usd: number): Promise<void>;
}

const MICRO = 1_000_000;
const TWO_DAYS_S = 2 * 24 * 3600;

export class DynamoLimiter implements Limiter {
  constructor(
    private readonly table: string,
    private readonly db = new DynamoDBClient({}),
  ) {}

  private ttl(): string {
    return String(Math.floor(Date.now() / 1000) + TWO_DAYS_S);
  }

  async takeRequest(visitor: string, day: string, limit: number): Promise<boolean> {
    try {
      await this.db.send(
        new UpdateItemCommand({
          TableName: this.table,
          Key: { pk: { S: `ip#${day}#${visitor}` } },
          UpdateExpression: "ADD hits :one SET expires_at = :ttl",
          ConditionExpression: "attribute_not_exists(hits) OR hits < :limit",
          ExpressionAttributeValues: { ":one": { N: "1" }, ":limit": { N: String(limit) }, ":ttl": { N: this.ttl() } },
        }),
      );
      return true;
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) return false;
      throw err;
    }
  }

  async spentToday(day: string): Promise<number> {
    const out = await this.db.send(
      new GetItemCommand({ TableName: this.table, Key: { pk: { S: `budget#${day}` } }, ConsistentRead: true }),
    );
    return Number(out.Item?.micro_usd?.N ?? 0) / MICRO;
  }

  async recordSpend(day: string, usd: number): Promise<void> {
    await this.db.send(
      new UpdateItemCommand({
        TableName: this.table,
        Key: { pk: { S: `budget#${day}` } },
        UpdateExpression: "ADD micro_usd :spend SET expires_at = :ttl",
        ExpressionAttributeValues: { ":spend": { N: String(Math.ceil(usd * MICRO)) }, ":ttl": { N: this.ttl() } },
      }),
    );
  }
}

export class MemoryLimiter implements Limiter {
  readonly hits = new Map<string, number>();
  readonly spend = new Map<string, number>();

  async takeRequest(visitor: string, day: string, limit: number): Promise<boolean> {
    const key = `${day}#${visitor}`;
    const count = this.hits.get(key) ?? 0;
    if (count >= limit) return false;
    this.hits.set(key, count + 1);
    return true;
  }

  async spentToday(day: string): Promise<number> {
    return this.spend.get(day) ?? 0;
  }

  async recordSpend(day: string, usd: number): Promise<void> {
    this.spend.set(day, (this.spend.get(day) ?? 0) + usd);
  }
}
