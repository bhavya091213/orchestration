# Orchestration Skills

Multi-agent orchestration skills for Claude Code and Codex.

This package is built around one idea: the lead agent should act like a team lead, not a group chat moderator. It plans, asks the user for real decisions, delegates bounded work to specialist spokes, and keeps token usage controlled through progressive disclosure.

## Why This Exists

Coding is only one part of shipping. A useful agent team also needs research, domain understanding, adversarial review, product judgment, planning, testing, and memory discipline.

These skills are designed for:

- hub-and-spoke orchestration
- online research with citations
- deep niche domain dives
- extreme human-in-the-loop planning
- Obsidian vault plus local retrieval memory
- adversarial steelman/skeptic review
- product and UX review
- token-efficient local knowledge retrieval
- hooks and lifecycle automation

## Install

Replace `your-github-user/orchestration` with your repository after you publish this folder.

### Codex

Install a single Codex skill globally:

```bash
npx degit your-github-user/orchestration/codex/skills/<skill-name> ~/.codex/skills/<skill-name>
```

Install a Codex skill into a project:

```bash
npx degit your-github-user/orchestration/codex/skills/<skill-name> .agents/skills/<skill-name>
```

Example:

```bash
npx degit your-github-user/orchestration/codex/skills/local-memory-orchestration ~/.codex/skills/local-memory-orchestration
```

Install Codex agent role templates:

```bash
npx degit your-github-user/orchestration/codex/agents ~/.codex/agents
```

Install Codex hook helpers:

```bash
npx degit your-github-user/orchestration/codex/scripts/ecc/hooks ~/.codex/scripts/ecc/hooks
```

### Claude Code

Install a single Claude Code skill globally:

```bash
npx degit your-github-user/orchestration/claude-code/skills/<skill-name> ~/.claude/skills/<skill-name>
```

Install a Claude Code skill into a project:

```bash
npx degit your-github-user/orchestration/claude-code/skills/<skill-name> .claude/skills/<skill-name>
```

Example:

```bash
npx degit your-github-user/orchestration/claude-code/skills/local-memory-orchestration ~/.claude/skills/local-memory-orchestration
```

Install Claude Code agent templates:

```bash
npx degit your-github-user/orchestration/claude-code/agents ~/.claude/agents
```

Install Claude Code hook helpers:

```bash
npx degit your-github-user/orchestration/claude-code/scripts/hooks ~/.claude/scripts/hooks
```

## Core Skills

### `orchestration-hub`

Coordinates work with a hub-and-spoke planner/executor split. The hub owns state, user interaction, model policy, and synthesis. Spokes do bounded work and return structured summaries.

```text
$orchestration-hub plan and coordinate this migration with fit-for-purpose model routing
/orchestration-hub plan and coordinate this migration with fit-for-purpose model routing
```

### `local-memory-orchestration`

Configures an Obsidian vault plus local retrieval database as persistent project memory. It supports repo, system, and session-level config and includes a dependency-free SQLite FTS5 baseline.

```text
$local-memory-orchestration configure repo memory and index this project
/local-memory-orchestration configure repo memory and index this project
```

Bootstrap a repo memory layer:

```bash
python3 codex/skills/local-memory-orchestration/scripts/memoryctl.py init --root . --scope repo
python3 codex/skills/local-memory-orchestration/scripts/memoryctl.py index --root .
python3 codex/skills/local-memory-orchestration/scripts/memoryctl.py search --root . "architecture decisions"
```

### `human-loop-planner`

Creates plans with explicit user gates, options, assumptions, and tradeoffs before implementation.

```text
$human-loop-planner plan this feature with approval checkpoints before code changes
/human-loop-planner plan this feature with approval checkpoints before code changes
```

### `online-research-runner`

Runs bounded web research with source quality tiers, citations, claim/evidence tables, and recency checks.

```text
$online-research-runner research current best practice for Claude Code subagents
/online-research-runner research current best practice for Claude Code subagents
```

### `deep-understanding-runner`

Deep dives into niche domains or unfamiliar systems and returns a reusable understanding memo.

```text
$deep-understanding-runner map the domain model before we plan implementation
/deep-understanding-runner map the domain model before we plan implementation
```

### `adversarial-pair-review`

Runs a steelman agent and a skeptic agent, then synthesizes a judge verdict.

```text
$adversarial-pair-review challenge this architecture before implementation
/adversarial-pair-review challenge this architecture before implementation
```

### `product-ux-review`

Reviews product workflows, dashboards, UX, and information architecture with implementation-ready recommendations.

```text
$product-ux-review audit this dashboard workflow before build
/product-ux-review audit this dashboard workflow before build
```

## Existing Included Skills

The export also includes the earlier orchestration and memory skills:

- `token-efficient-orchestration`
- `local-memory-orchestration`
- `local-knowledge-retrieval`
- `iterative-retrieval`
- `obsidian-markdown`
- `obsidian-bases`
- `obsidian-cli`
- `json-canvas`
- `dmux-workflows`
- `strategic-compact`
- `continuous-learning`
- `continuous-learning-v2`
- `configure-ecc`

## Model Policy

The orchestrator should ask which model policy to use for substantial work:

- `best`: strongest available model for hub and all spokes.
- `fit`: strongest model for hub and hard reasoning; cheaper capable models for extraction, docs, formatting, and mechanical checks.
- `economy`: cheapest acceptable models first, with escalation when quality or risk requires it.

Default: `fit`.

## Repository Layout

```text
orchestration/
├── codex/
│   ├── AGENTS.md
│   ├── agents/
│   ├── config.toml
│   ├── scripts/
│   └── skills/
├── claude-code/
│   ├── AGENTS.md
│   ├── agents/
│   ├── plugin.json
│   ├── scripts/
│   └── skills/
├── docs/
└── README.md
```

## Design Notes

- Skills use progressive disclosure: short `SKILL.md` files plus references loaded only when needed.
- Local memory uses the Obsidian vault as the human-readable source of truth and SQLite/vector retrieval as the fast index layer.
- Subagents are treated as isolated context windows. The hub gets final summaries, not raw transcripts.
- Hooks are included for lifecycle automation, but model behavior should not depend on hooks remembering strategy.
- Human gates are first-class. Product, cost, model-spend, and irreversible decisions should be explicit.

See `docs/research-notes.md` for source notes behind the design.
