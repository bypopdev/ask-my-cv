# ADR 0002: Structured output with an explicit status

Status: accepted (2026-10)

## Context
A résumé assistant that invents a technology or rounds a number up does more harm than one that says "I don't know". We need to tell those cases apart in code, not by reading prose.

## Decision
The model must reply with JSON matching a schema (`src/prompt.ts`): `answer`, `status` (`answered`, `not_in_profile`, `off_topic`) and `sources` (ids of profile sections, constrained to an enum). The server re-validates the JSON (`parseAnswer`) and replaces anything unexpected with a fixed fallback message.

## Consequences
- Evals check refusals and topic boundaries deterministically through `status`, and use the LLM judge only for faithfulness.
- Metrics count `not_in_profile` answers, which shows what recruiters ask that the CV does not cover.
- `sources` lets the judge and future UI trace each answer to a section. It is a model claim, so the judge still checks the answer against the whole profile.
