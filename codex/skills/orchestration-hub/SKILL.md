---
name: orchestration-hub
description: Coordinate multi-agent work with a hub-and-spoke planner/executor split, model routing, human approval gates, token budgets, and concise agent handoffs. Use when a task needs several agents, research plus implementation, planning before execution, domain exploration, adversarial review, or long-running work that must stay organized and cost-aware.
---

# Orchestration Hub

Act as the hub. Own the plan, user interaction, state, and final synthesis. Spoke agents do bounded work and return structured summaries; they do not chat with each other.

## Start

For non-trivial work, ask one compact setup question unless the user already answered it:

```markdown
Model policy?
- Best available models for every agent
- Fit-for-purpose models with escalation only when needed
- Cheapest acceptable models unless quality is at risk
```

Default to `fit-for-purpose` when the user says to proceed.

## Workflow

1. Classify the task: `single-agent`, `planner-only`, `hub-spoke`, `parallel-research`, `deep-dive`, or `adversarial-review`.
2. Set a token budget: `small`, `standard`, or `deep`.
3. Configure or load local memory if the repository uses an Obsidian vault or local retrieval database. Use `$local-memory-orchestration` when rules are missing.
4. Retrieve local context first with bounded search. Prefer file paths, headings, and short excerpts over copied documents.
5. Create a spoke roster only for independent work.
6. Give each spoke a one-page prompt: objective, allowed scope, memory retrieval command, context pointers, output contract, stop conditions.
7. Pause for the user before irreversible changes, large model spend, vague product choices, or implementation after a plan.
8. Synthesize spoke outputs into decisions, next actions, and evidence. Do not paste raw transcripts.
9. After meaningful work, update memory and re-index changed notes/docs/code when configured.

## Delegation Rules

- Use one local pass when the task is small or tightly coupled.
- Use parallel spokes only when outputs can be merged without write conflicts.
- Use deep-runner agents for unfamiliar domains, niche technical topics, or research that needs a mental model before action.
- Use adversarial pair review when a decision is expensive, risky, or likely biased by optimism.
- Keep the hub responsible for final judgment. Spokes provide evidence, not authority.

## Output Contract

For user-facing updates, use:

```markdown
Status: [current phase]
Decision needed: [only if blocked or approval is useful]
What changed: [short]
Evidence: [files, commands, links]
Next: [one or more concrete actions]
```

For spoke prompts and returns, see `references/output-contracts.md`.

## References

Read only what applies:

- `references/hub-and-spoke.md` for planner/executor architecture and spoke limits.
- `references/model-routing.md` for model policy and escalation rules.
- `references/human-gates.md` for approval checkpoints and question design.
- `references/output-contracts.md` for compact agent prompt and result templates.
