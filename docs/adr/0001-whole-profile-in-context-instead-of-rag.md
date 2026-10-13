# ADR 0001: Whole profile in the prompt instead of RAG

Status: accepted (2026-10)

## Context
The assistant answers questions about one person's CV. A typical source text (`profile/profile.md`) is 1,000–3,000 tokens.

## Decision
Send the whole profile in the system prompt on every request, marked for prompt caching. No embeddings, no vector database, no retrieval step.

## Why
- Retrieval exists to fit large corpora into a context window. This corpus is a few thousand tokens; the model's window is 1M.
- Retrieval adds failure modes that matter more than cost here: a missed chunk makes the model say "not in the profile" when it is, or answer from a partial picture.
- Fewer moving parts: no index to rebuild when the CV changes, nothing extra to deploy or pay for.
- Cost stays small: at Haiku prices a full request is a fraction of a cent, and cached reads cut the input part further. The cache only engages once the prefix passes the model's minimum cacheable length, so `CacheReadTokens` in the metrics shows whether it does.

## When to revisit
If the source grows beyond tens of thousands of tokens (for example, adding every project write-up and talk transcript), move to retrieval with an eval comparing both.
