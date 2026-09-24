# Codex Global Workspace

This Codex setup imports the durable parts of the previous Claude/ECC environment while keeping Claude files untouched.

## Skill Sources

Codex skills live in `~/.codex/skills/`.

Migrated sources:
- `~/.claude/.agents/skills/*` for Codex-ready ECC skills with OpenAI metadata
- unique `~/.claude/skills/*` skills for language/framework workflows
- `~/.agents/skills/*` for existing cross-agent skills

Use skills by name when the task matches the frontmatter description. Prefer the smallest relevant skill set for a turn.

## Prompt And Workflow Library

Reusable Codex command and agent prompts were copied for reference:
- `~/.codex/prompts/codex-commands/`
- `~/.codex/prompts/codex-agents/`
- `~/.codex/prompts/codex-rules/`
- `~/.codex/prompts/openai-codex-plugin/`

These are prompt recipes, not native Codex slash commands. Run one with:

```bash
~/.codex/scripts/codex-prompt <recipe-name> [arguments...]
```

Codex companion wrappers are available in `~/.codex/scripts/`:
- `codex-review`
- `codex-adversarial-review`
- `codex-rescue`
- `codex-status`
- `codex-result`
- `codex-cancel`
- `codex-setup`

For any remaining legacy wording, use `~/.codex/workflows/claude-to-codex-equivalents.md`.

## Agent Roles

Native Codex multi-agent roles are configured in `~/.codex/config.toml` and backed by TOML files in `~/.codex/agents/`.
Use read-only roles for exploration, planning, review, architecture, docs, and security review. Use workspace-write roles only for implementation-oriented work such as TDD, build fixes, E2E tests, and cleanup.

## Safety Defaults

- Keep secrets out of config files. MCP credentials should come from shell environment variables or tool login flows.
- Use `workspace-write` by default; switch to `strict` profile for read-only review.
- Review diffs before pushing.
- Run the repository's own verification commands before calling work complete.

<!-- BEGIN SHARED RULES (synced from ~/.agents/RULES.md) -->
# Shared Agent Rules

Tool-neutral operating rules for any coding agent (Claude Code, Codex CLI, etc.).
This file is the single source of truth; tool-specific files import or sync from it.

## A. Session Pre-Flight (Machine State Check)

Before starting implementation work in any project, check and report:

- [ ] **Docker** — installed? daemon running? (`docker info`)
- [ ] **Node version** — system `node -v` (currently 22.12); nvm has 24.12 at
      `~/.nvm/versions/node/v24.12.0` — use `nvm use 24` when a tool needs newer node
- [ ] **Env files** — note which of `.env`, `.env.local`, `.env.example` exist; never
      print secret values
- [ ] **Dependencies installed** — `node_modules` / venv / lockfile present; install if
      missing

Report results as a short checklist before writing code.

## B. Orchestrator Pattern

- The active/interactive session is the **orchestrator**, not the worker.
- Spawn subagents whenever possible for any self-contained unit of work: research,
  file sweeps, implementation units, reviews, tests.
- Independent subagents run in parallel, in one message — never sequentially when
  there's no dependency between them.
- The orchestrator keeps conclusions, not raw file dumps — subagents report back
  compact summaries, not full file contents.
- The orchestrator does direct work itself only for tiny single-fact lookups or
  one-line edits.

## C. Model / Effort Routing for Subagents

- **Heavy-reasoning tier** — planning, architecture, root-cause debugging,
  code/security reviews, anything ambiguous or open-ended.
- **Light tier** — well-specified small mechanical tasks: formatting, simple file
  writes, straightforward edits, running commands and reporting results.
- **State the tier explicitly on every subagent spawn.**

### Tool mapping

- **Claude Code** — heavy = Opus, light = Sonnet (Haiku optional for trivial
  high-frequency tasks). Spawn via the Agent tool with an explicit `model`.
- **Codex CLI** — one model (currently `gpt-5.6-sol`) with reasoning effort levels:
  heavy = `xhigh` (or `max`), light = `low`/`medium`. Subagents are the roles declared
  in `~/.codex/config.toml` under `[agents.*]`, backed by `~/.codex/agents/*.toml`; set
  `model_reasoning_effort` per role to match its tier. `[agents] max_threads` bounds
  parallelism.

## D. Context Budget (Avoid Context Rot)

- A subagent's context must never exceed **100k tokens**. Scope each task to fit;
  hand it only the files/paths it actually needs.
- If a subagent finds the task cannot be completed within 100k tokens, it must
  **STOP** and ask the orchestrator for an increased budget — stating what it has
  done, what remains, and the estimated tokens needed — rather than continuing and
  degrading.
- The orchestrator then either splits the task into smaller units or explicitly
  grants more budget.
- The same guidance applies to the orchestrator itself: compact or hand off at
  logical phase boundaries rather than letting the session bloat.

## E. Never Delete (No `rm`)

- Never run `rm` / `rm -rf`, directly or via a subagent. Relocate with `mv` instead.
- If something must be retired, `mv` it into a backup location (e.g.
  `~/.agents/backups/retired-<what>/`) and say so in the report.
- Put this rule verbatim in every subagent brief that touches the filesystem.
<!-- END SHARED RULES -->
