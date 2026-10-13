# ADR 0004: Claude API as a backup for Bedrock

Status: accepted (2026-10)

## Context
Answers come from Claude Haiku on Amazon Bedrock. When Bedrock is unavailable to the account (model access not granted, account restrictions, throttling, a regional outage), the assistant returns 502 and the page is useless. The same model is also offered directly through the Claude API.

## Decision
- `src/llm.ts` builds an ordered list of model targets: Bedrock first, then the Claude API when `ANTHROPIC_API_KEY` is set. `LLM_PROVIDER=anthropic` makes the Claude API the only target (local runs and evals without AWS).
- Any error from a target moves on to the next one. Errors differ by provider (an AWS access error, a 403, a network failure), and the backup costs nothing unless the primary fails, so there is no allow-list of error types.
- Refusals and invalid JSON are answers, not errors: they never trigger the backup.
- With a backup configured, the Bedrock client retries once instead of twice, so a failing primary leaves enough of the 30-second Lambda timeout for the backup.
- Each answer is tagged with the provider that produced it (`Provider` in the EMF metrics), and every failed attempt is logged without secrets.
- Evals measure one provider (`LLM_PROVIDER`) and never fall back, so results are comparable between runs.

## Consequences
- The application-level limits (per-visitor limit, $0.10 daily budget) apply to both providers.
- The AWS Budgets kill switch only denies Bedrock; it does not stop the Claude API backup. Set a monthly spend limit for the key in the Claude Console as the account-level cap for that path.
- The key is passed to Lambda as an environment variable from a GitHub secret. It is encrypted at rest by Lambda but visible to anyone with access to the function configuration and stored in the Terraform state. Moving it to SSM Parameter Store (SecureString) is the next step if the account gets more users.
- Two model ids to keep in sync (`MODEL_ID` for Bedrock, `ANTHROPIC_MODEL_ID` for the Claude API).
