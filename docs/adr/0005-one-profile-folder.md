# ADR 0005: Everything about the person lives in `profile/`

Status: accepted (2026-10)

## Context
The assistant started as one person's chatbot, with the name, contact link and confidentiality rule written into the prompt, the page and the eval cases. Anyone reusing it had to edit code in a dozen places, and personal details leaked into files that should be generic.

## Decision
Three files in `profile/` describe the person, and nothing else in the repository does:
- `profile.md`: the facts, in sections with ids that answers cite.
- `assistant.json`: name, headline, contact channel, links, answer languages, the confidentiality rule, suggested questions. It is validated at build time (`src/settings.ts`), so a typo fails CI instead of producing odd answers.
- `evals.json`: test questions about this profile (facts, gaps, confidential probes).

The code builds the system prompt, the error messages, the chat page (`scripts/site.mjs`) and the generic security evals (`evals/generic.json`, with `{name}` filled in) from these files.

## Consequences
- Running it for someone else means replacing one folder; the repository ships a fictional example so it works out of the box.
- A private deployment can keep its real `profile/` in a separate, private repository and reuse the code unchanged.
- The prompt is generated, so prompt changes are tested once (`test/settings.test.ts`) for every profile.
