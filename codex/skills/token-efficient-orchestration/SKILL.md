---
name: token-efficient-orchestration
description: Use when coordinating Codex or Claude Code subagents, research runners, Obsidian project memory, CI verification, or long-running project work where context and token cost must be minimized. Enforces hub-and-spoke delegation, bounded retrieval, model routing, small prompts, no watcher loops by default, concise memory updates, and explicit completion gates.
---

# Token-Efficient Orchestration

Use this skill before spawning agents or updating orchestration memory.

For complex work, combine with `$orchestration-hub`.
For persistent repo memory, combine with `$local-memory-orchestration`.

## Architecture

- Use a hub-and-spoke pattern.
- The hub owns state, user decisions, model policy, and synthesis.
- Spokes get bounded tasks and return compact summaries.
- Do not allow peer-to-peer agent chat unless the user explicitly asks for an experiment.

## Defaults

- Prefer one local action over a subagent when the task is blocking, small, or tightly coupled.
- Spawn subagents only for bounded, non-overlapping work with clear file ownership.
- Do not start long-running watcher agents unless the user explicitly asks.
- Cap each agent prompt to the minimum needed context: task, repo/vault paths, allowed scope, required evidence, and stop conditions.
- Tell agents to re-query local knowledge for their exact task instead of inheriting broad parent context.
- Tell agents to update one concise agent note, not many dashboard/index files, unless status materially changed.
- Close completed agents promptly.
- Re-index memory after meaningful note/docs/code-map updates when a local index is configured.

## Model Budget

- Ask for model policy on substantial orchestration: `best`, `fit`, or `economy`.
- Default to `fit`: best model for hub synthesis and hard reasoning, cheaper capable models for extraction, docs, formatting, and deterministic checks.
- Escalate models for security, data loss, architecture, product strategy, conflicting evidence, or repeated failed cheap passes.
- De-escalate models for markdown writing, file inventory, formatting, and tasks with deterministic verification.

## Retrieval Budget

- First use `rg`, `rg --files`, or `~/.codex/scripts/codex-knowledge search`.
- Default search budget: `--limit 5 --max-chars 8000`.
- For small tasks: `--limit 3 --max-chars 4000`.
- Read file slices with `sed -n`, not whole large files.
- Stop reading when you can name the target files, test command, and risk.

## Subagent Prompt Contract

Include only:

- Task and ticket ID.
- Repo and vault paths.
- Allowed write scope and protected files.
- 3-6 required reads, not whole folder lists.
- Focused retrieval command.
- Exact verification command expectations.
- Vault note to update.
- Stop conditions: too broad, schema needed, remote state unavailable, or conflicting dirty files.

Avoid:

- Large copied handoffs.
- Full ticket indexes.
- Multiple redundant skills.
- Background monitoring instructions.
- Asking agents to keep watching unless explicitly needed.

## Vault Memory

- The vault should make future sessions cheaper: write concise state, links, evidence, and next actions.
- Prefer index notes over dense cross-linking.
- Use `Related` sections with 3-8 high-signal links.
- Record local verification separately from remote CI.
- Do not duplicate long command logs; summarize result and point to the command.

## Completion

Before reporting done:

- Verify every running agent is either still needed or closed.
- Report active agents by objective, not by transcript.
- Report exact local checks and remote-state limits.
