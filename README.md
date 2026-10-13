# ask-my-cv

A résumé assistant for your personal website: recruiters ask questions about your experience and get answers taken only from your CV. Put your CV in one folder, run it locally in two minutes, deploy it to AWS with Terraform.

It is built as a small production LLM system rather than a demo:

- **Grounded answers.** The model answers only from `profile/profile.md`, cites the sections it used, and says when the CV does not cover a question instead of guessing. Questions that assume more than the CV says ("did she win?" when it says "finalist") get corrected, not confirmed.
- **Evals.** A suite of test questions per profile plus generic security cases (prompt injection, fake chat history, prompt leak, role-play), graded by deterministic checks and an LLM judge for faithfulness. Runs in CI and fails the build on any security failure.
- **Guardrails.** Input validation, structured output re-validated on the server, a canary that detects system-prompt leaks, refusal handling, an optional rule that keeps an employer's internal details out of answers.
- **Cost control.** Per-visitor and global daily limits, cost per request in the metrics, an AWS Budgets alert with an automatic kill switch.
- **Two model providers.** Claude on Amazon Bedrock with the Anthropic API as an automatic backup, or the Anthropic API alone.
- **Observability.** One CloudWatch Embedded Metric Format line per request: status, provider, latency, tokens, cache reads, cost.
- **Infrastructure as code.** Terraform for everything; GitHub Actions deploys through OIDC, with no long-lived AWS keys.

## Quick start

Needs Node.js 22+ and an [Anthropic API key](https://console.anthropic.com/).

```bash
npm ci
export LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=sk-ant-...
npm run dev          # chat page and API on http://localhost:8080
```

The repository ships with a fictional example, Alex Novak, so this works before you change anything.

## Make it yours

Everything about the person is in `profile/`; nothing else in the repository needs to change.

| File | What to put there |
|---|---|
| `profile/profile.md` | Your CV as facts, in sections that start with `## [section-id] Title`. Only what you are happy to publish. |
| `profile/assistant.json` | Name, headline, contact link, other links, answer languages, suggested questions, and `confidential`: topics the assistant must not elaborate on (for example your employer's internal systems). |
| `profile/evals.json` | Test questions about your CV: facts it must get right, gaps it must admit, confidential details it must not guess. |

Then check the result:

```bash
npm test                     # validates the settings, the profile and the eval files
npm run ask -- "What does she work on?"
npm run eval                 # full suite with the LLM judge (about $0.10 per run)
```

Keep a real profile out of a public fork: run your own deployment from a private copy of this repository.

## Architecture

```
Browser ── CloudFront ── S3 (static chat page)
   │
   └── POST /  Lambda Function URL ── Lambda (Node.js 22, TypeScript)
                                         ├── DynamoDB      rate limits, daily spend
                                         ├── Amazon Bedrock (Claude Haiku 5.5)
                                         ├── Anthropic API backup when Bedrock fails
                                         └── CloudWatch    EMF metrics, logs
```

Request flow (`src/handler.ts`): validate input → per-visitor limit → daily budget → model call with the whole profile as a cached system block and a JSON schema for the reply → re-validate the JSON → record cost and metrics.

Design decisions:
1. [Whole profile in the prompt instead of RAG](docs/adr/0001-whole-profile-in-context-instead-of-rag.md)
2. [Structured output with an explicit status](docs/adr/0002-structured-output-with-status.md)
3. [Hard cost limits on a public endpoint](docs/adr/0003-hard-cost-limits.md)
4. [Anthropic API as a backup for Bedrock](docs/adr/0004-claude-api-backup.md)
5. [Everything about the person lives in `profile/`](docs/adr/0005-one-profile-folder.md)

## Repository layout

| Path | What |
|---|---|
| `profile/` | The person: CV facts, settings, profile-specific eval cases |
| `src/` | Lambda handler, prompt and schema, settings, providers and fallback, guardrails, limits, pricing, metrics |
| `evals/` | Generic security cases, grader, runner (`npm run eval`) |
| `test/` | Unit tests (`npm test`), no network or cloud access needed |
| `web/` | Chat page template, script and styles; `npm run build:site` renders it into `dist/site/` |
| `scripts/` | Local dev server, one-question CLI, build scripts |
| `infra/` | Terraform: Lambda, Function URL, DynamoDB, S3 + CloudFront, budget and kill switch |
| `infra/bootstrap/` | One-time: Terraform state bucket and GitHub OIDC roles |

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `LLM_PROVIDER` | `bedrock` | `bedrock`, or `anthropic` to use only the Anthropic API |
| `ANTHROPIC_API_KEY` | – | With `bedrock`, turns on the Anthropic API as a backup |
| `MODEL_ID` | `anthropic.claude-haiku-5-5` | Bedrock model id |
| `ANTHROPIC_MODEL_ID` | `claude-haiku-5-5` | Anthropic API model id |
| `BEDROCK_REGION` | `eu-central-1` | Region where the model is enabled in Bedrock |
| `DAILY_BUDGET_USD` | `0.1` | Model spend after which the API answers 429 until midnight UTC |
| `PER_IP_DAILY_LIMIT` | `30` | Questions per visitor per day |
| `JUDGE_MODEL_ID` | Sonnet 5.5 for the provider | Model that grades faithfulness in evals |

## Deploy to AWS

1. **Enable the models** in the Amazon Bedrock console for your region: Claude Haiku 5.5 (answers) and Claude Sonnet 5.5 (eval judge). Or skip Bedrock and set `LLM_PROVIDER=anthropic`.
2. **Bootstrap** once with your own AWS credentials:
   ```bash
   cd infra/bootstrap && terraform init && terraform apply -var="github_repo=<owner>/<repo>"
   ```
3. **GitHub settings** (Settings → Secrets and variables → Actions):
   - Variables from the bootstrap outputs: `AWS_DEPLOY_ROLE_ARN`, `AWS_EVAL_ROLE_ARN`, `TF_STATE_BUCKET`; optionally `AWS_REGION`, `BEDROCK_REGION`, `MODEL_ID`, `ANTHROPIC_MODEL_ID`, `LLM_PROVIDER`, `JUDGE_MODEL_ID`.
   - Secret `ALERT_EMAIL` for budget alerts (a secret, so it is masked in public logs).
   - Optional secret `ANTHROPIC_API_KEY`: the backup in the deployed Lambda, and the provider for evals when `LLM_PROVIDER=anthropic`.
4. **Push to `main`.** The Deploy workflow runs the tests, builds the Lambda and the page, applies Terraform and prints the site URL.
5. Confirm the AWS Budgets e-mail subscription.

## Cost

With default limits, model spend is capped at $0.10 a day by the application (about $3 a month at most), and an AWS Budgets action cuts off Bedrock once monthly spend passes `monthly_budget_usd` (default $5). The kill switch does not cover the Anthropic API backup, so set a monthly spend limit for that key in the Anthropic Console. Lambda, DynamoDB, CloudFront and S3 stay within the AWS free tier at this traffic. A full eval run costs about $0.10.

## License

MIT
