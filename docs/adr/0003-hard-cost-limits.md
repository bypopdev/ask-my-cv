# ADR 0003: Hard cost limits on a public endpoint

Status: accepted (2026-10)

## Context
The API is a public Lambda Function URL with no login. Anyone can script requests against it, and every request costs money.

## Decision
Three layers, from cheapest to broadest:
1. **Request validation** before any model call: question ≤ 500 characters, at most 6 history messages of ≤ 1,000 characters, roles must alternate. `max_tokens` caps the output.
2. **Per-visitor daily limit** (default 30 questions) in DynamoDB, keyed by a salted hash of the IP, so raw IPs are never stored.
3. **Global daily budget** (default $0.10): every answer records its cost from the token usage; once the day's spend reaches the cap, the API returns 429 until midnight UTC.

Above that, at the AWS account level (all in Terraform):
4. **AWS Budgets alerts** e-mail at 50% of the monthly budget and when the forecast exceeds it.
5. **Budget kill switch**: when actual monthly spend passes the budget, an AWS Budgets action attaches a deny-Bedrock policy to the Lambda role. This holds even if the application-level limits have a bug. Service resumes after the policy is detached.
6. **Reserved concurrency** (optional, `reserved_concurrency`) caps how many requests run at once.

## Consequences
- Worst case is about $3 a month of model spend, whatever the traffic.
- The budget check is not transactional: concurrent requests can overshoot the daily cap by a few cents. Acceptable at this scale.
- Rotating IPs can bypass the per-visitor limit, but not the global budget.
