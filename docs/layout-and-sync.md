# Repository Layout & Sync Model

This repo is a packaged snapshot of three live config directories. Each top-level
directory maps 1:1 onto a home-directory target:

| Repo directory | Installs to | Owner |
|---|---|---|
| `shared/` | `~/.agents/` | both tools — the source of truth |
| `claude-code/` | `~/.claude/` | Claude Code |
| `codex/` | `~/.codex/` | Codex CLI |
| `docs/` | — | this documentation, not installed |

The organising principle: **anything tool-neutral lives in `shared/` and is
rendered into both tools.** Tool-specific material stays in its own tree.

---

## Directory tree

```
orchestration/
├── shared/                      → ~/.agents/
│   ├── RULES.md                   shared operating rules (source of truth)
│   ├── mcp-servers.json           MCP server definitions for both tools
│   ├── skill-lock.json            provenance for externally-sourced skills
│   ├── bin/                       sync-agents
│   └── skills/                    62 tool-neutral skills
├── claude-code/                 → ~/.claude/
│   ├── CLAUDE.md                  7 lines; imports RULES.md
│   ├── settings.example.json
│   ├── agents/                    32 subagent definitions
│   ├── commands/                  57 slash commands
│   ├── rules/                     common/ + cpp, golang, kotlin, perl, php,
│   │                              python, swift, typescript
│   ├── hooks/                     hooks.json + README.md
│   ├── scripts/                   hooks/, codex-review-pipeline/,
│   │                              setup-package-manager.js
│   └── skills/                    15 Claude-only skills (incl. learned/)
├── codex/                       → ~/.codex/
│   ├── AGENTS.md                  122 lines; hosts the synced rules block
│   ├── config.example.toml
│   ├── hooks.json
│   ├── agents/                    11 role .toml files
│   ├── prompts/                   codex-agents/, codex-commands/,
│   │                              codex-rules/, openai-codex-plugin/
│   ├── scripts/                   14 codex-* wrappers + ecc/
│   ├── skills/                    14 Codex variants of the Claude-only skills
│   └── workflows/                 claude-to-codex-equivalents.md
└── docs/                          this directory
```

---

## The skill symlink model

Skills exist in three places and are wired differently depending on whether they
are tool-neutral.

**Shared skills (62)** live once in `~/.agents/skills/` and are **symlinked** into
both tools:

```
~/.claude/skills/api-design -> ../../.agents/skills/api-design
~/.codex/skills/api-design  -> ../../.agents/skills/api-design
```

Relative links, so the pair survives a move of the home directory. Editing
`~/.agents/skills/<name>/SKILL.md` immediately changes the skill in both tools —
there is no copy step and no drift.

**Platform-specific skills stay real directories.** The same name can exist in
both trees with genuinely different content, because the harnesses differ. Compare
the two `strategic-compact` variants:

| | `claude-code/skills/strategic-compact` | `codex/skills/strategic-compact` |
|---|---|---|
| description | "Suggests manual context compaction at logical intervals…" | "Preserve important context at phase boundaries by writing Codex memory snapshots…" |
| mechanism | lifecycle hooks + `/compact` | explicit writes to `.codex/memory/` or `~/.codex/memory/snapshots/` |
| `origin` | `ECC` | `ECC migrated to Codex` |

Same split for `continuous-learning` (`~/.claude/skills/learned/` vs
`~/.codex/skills/learned/`) and `continuous-learning-v2`
(`~/.claude/homunculus/` vs `~/.codex/homunculus/`).

The 14 names present in both tool trees —  `ai-regression-testing`,
`configure-ecc`, `continuous-learning`, `continuous-learning-v2`, `eval-harness`,
`frontend-slides`, `iterative-retrieval`, `laravel-verification`,
`mcp-server-patterns`, `plankton-code-quality`, `project-guidelines-example`,
`skill-stocktake`, `strategic-compact`, `verification-loop` — are real
directories on both sides, not links. `claude-code/skills/` has one extra:
`learned/`, the output directory for the continuous-learning system.

`shared/skill-lock.json` records provenance for skills pulled from external
repositories (source repo, `sourceUrl`, `skillPath`, `skillFolderHash`,
`installedAt`/`updatedAt`) — e.g. `remotion-best-practices` from
`remotion-dev/skills`, `find-skills` from `vercel-labs/skills`, `neon` and
`neon-postgres` from `neondatabase/agent-skills`.

---

## How `RULES.md` reaches both tools

`shared/RULES.md` is 68 lines and states its own status up front:

> Tool-neutral operating rules for any coding agent (Claude Code, Codex CLI,
> etc.). **This file is the single source of truth**; tool-specific files import
> or sync from it.

Its five sections: **A.** Session Pre-Flight · **B.** Orchestrator Pattern ·
**C.** Model / Effort Routing · **D.** Context Budget · **E.** Never Delete.

Two different delivery mechanisms, because the two harnesses differ:

### Claude Code — native import

`~/.claude/CLAUDE.md` is deliberately tiny (7 lines) and pulls the rules in at
load time:

```markdown
# Global Instructions

Shared cross-tool rules live in ~/.agents/RULES.md and are imported below.

@~/.agents/RULES.md

See ~/.claude/rules/common/agents.md and performance.md for the fuller agent/model guidance.
```

The `@~/.agents/RULES.md` line is a Claude Code file import. Nothing is copied —
edit `RULES.md` and the next session sees it. No sync command needed.

### Codex CLI — marker block, refreshed by `sync-agents rules`

Codex has no import directive, so the rules text is **materialised** into
`~/.codex/AGENTS.md` between markers:

```
<!-- BEGIN SHARED RULES (synced from ~/.agents/RULES.md) -->
...68 lines of RULES.md...
<!-- END SHARED RULES -->
```

In `codex/AGENTS.md` this block sits at lines 53-122 — Codex-specific guidance
lives above it, the shared block is appended below. Running:

```bash
~/.agents/bin/sync-agents rules
```

replaces everything between the markers. If the markers are absent it appends the
block and reports `append block (markers absent)`. If the rendered text already
matches it prints `already in sync` and exits 0. `--dry-run` reports the action
and the RULES.md line count without writing.

**Consequence:** editing `RULES.md` is enough for Claude Code, but Codex needs
`sync-agents rules` afterwards or `AGENTS.md` goes stale.

---

## How MCP servers reach both tools

`shared/mcp-servers.json` is the source of truth, with a `_comment` field saying
so. Schema per entry: `type` (`stdio` | `http`), `command`/`args`/`env` for
stdio, `url` for http, and `targets` listing which tools get it.

Current servers, all targeting both tools: `context7`, `exa` (http),
`github`, `headroom`, `memory`, `playwright`, `sequential-thinking`, `trello`.

```bash
~/.agents/bin/sync-agents mcp          # default subcommand
```

renders each entry into **both**:

- `~/.codex/config.toml` as `[mcp_servers.<name>]` tables — a text-level edit
  that preserves the rest of the file, with `tomllib` used only for reading and
  validation, and a `.bak-sync` backup alongside.
- Claude Code's user-scope MCP list via the `claude mcp` CLI. The comment in
  `mcp-servers.json` is emphatic: **"Never hand-edit `~/.claude.json` — Claude
  Code rewrites it."**

The loader validates before touching anything: `type` must be `stdio` or `http`,
stdio entries need a `command`, http entries need a `url`, and `targets` must be
a list. A bad entry aborts the run with `error: <name>: …`.

---

## `sync-agents` reference

[`shared/bin/sync-agents`](../shared/bin/sync-agents) is a 391-line Python 3
script (needs `tomllib`, i.e. Python 3.11+). Running it with no subcommand, or
with only flags, defaults to `mcp`.

| Subcommand | Flags | Does |
|---|---|---|
| `mcp` (default) | `--dry-run`, `--prune` | render `mcp-servers.json` into `~/.codex/config.toml` and Claude's user scope |
| `rules` | `--dry-run` | refresh the SHARED RULES block in `~/.codex/AGENTS.md` |
| `status` | — | table of which servers each tool currently has, plus drift |

```bash
sync-agents                 # == sync-agents mcp
sync-agents mcp --dry-run   # print the plan, change nothing
sync-agents mcp --prune     # also remove servers not in mcp-servers.json
sync-agents rules
sync-agents status
```

`--dry-run` prints a `PLAN (dry run)` block instead of `APPLIED`; nothing is
written. `--prune` is opt-in and scoped: on the Claude side it only considers
user-scope server names, so project-scoped servers are never touched.

`status` output looks like:

```
server               claude  codex   targets
-------------------  ------  ------  -------
context7             yes     yes     claude,codex
exa                  yes     yes     claude,codex
...

in codex but not in mcp-servers.json: <names>
in claude user scope but not in mcp-servers.json: <names>
```

Those two trailing lines are the drift report — they tell you what `--prune`
would remove.

`mcp` exits 1 if any server failed to apply; `rules` exits 1 if
`~/.agents/RULES.md` does not exist.

---

## Installing

```bash
./install.sh --all          # shared + claude-code + codex
./install.sh --shared       # ~/.agents only
./install.sh --claude       # ~/.claude only
./install.sh --codex        # ~/.codex only
./install.sh --dry-run      # print the plan, change nothing
```

Config files ship as `*.example.*` — `claude-code/settings.example.json` and
`codex/config.example.toml` — so installing never clobbers live credentials or
machine-specific settings. Copy and edit rather than symlinking those two.

After a fresh install, run the sync pass once so Codex picks up the rules block
and both tools get the MCP list:

```bash
~/.agents/bin/sync-agents rules
~/.agents/bin/sync-agents mcp
~/.agents/bin/sync-agents status     # verify
```

---

## Never delete

`shared/RULES.md` § E is a standing rule for every agent and for the tooling:

> - Never run `rm` / `rm -rf`, directly or via a subagent. Relocate with `mv`
>   instead.
> - If something must be retired, `mv` it into a backup location (e.g.
>   `~/.agents/backups/retired-<what>/`) and say so in the report.
> - Put this rule verbatim in every subagent brief that touches the filesystem.

The tooling follows it rather than exempting itself:

- The installer **backs up** anything it would overwrite into
  `~/.agents/backups/` instead of removing it.
- `sync-agents mcp` writes `~/.codex/config.toml.bak-sync` before editing.
- `sync-agents mcp --prune` removes *table entries from a config file* — a config
  edit, not a filesystem delete — and only for user-scope names present in the
  tool but absent from `mcp-servers.json`. It is opt-in for that reason.

`~/.agents/backups/` is a real, populated directory on a live install. Retired
config is relocated there, never deleted, so a bad sync or install is always
reversible.

---

## Editing checklist

| You changed | Then run |
|---|---|
| `shared/RULES.md` | `sync-agents rules` (Claude picks it up automatically) |
| `shared/mcp-servers.json` | `sync-agents mcp` |
| `shared/skills/<name>/` | nothing — symlinked live into both tools |
| `claude-code/skills/<name>/` | nothing — Claude-only, real directory |
| `codex/skills/<name>/` | nothing — Codex-only, real directory |
| `claude-code/agents/`, `commands/`, `rules/` | nothing — read at session start |
| `codex/agents/*.toml` | nothing — read via `config_file` in `config.toml` |
| `claude-code/hooks/hooks.json`, `codex/hooks.json` | restart the session |

When in doubt, `sync-agents status` shows the current drift between the source of
truth and what each tool actually has.
