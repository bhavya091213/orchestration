# claude-code/ - mirrors `~/.claude`

Everything in here installs into `~/.claude`. Tool-agnostic material (rules, skills, MCP servers)
lives in [`../shared`](../shared) instead and is symlinked or synced in.

## Contents

| Path | Installs to | What it is |
| --- | --- | --- |
| `CLAUDE.md` | `~/.claude/CLAUDE.md` | Global instructions; imports the shared rules |
| `settings.example.json` | `~/.claude/settings.json` | Permissions, env, model, hooks, plugins |
| `agents/` | `~/.claude/agents/` | 32 subagent definitions (`name` + `description` frontmatter) |
| `commands/` | `~/.claude/commands/` | 57 slash commands |
| `rules/` | `~/.claude/rules/` | `common/` (9 files) plus cpp, golang, kotlin, perl, php, python, swift, typescript |
| `hooks/hooks.json` | merged into settings | 21 hook entries across 6 events |
| `scripts/hooks/` | `~/.claude/scripts/hooks/` | 25 hook implementations (format, typecheck, guards, session markers) |
| `scripts/codex-review-pipeline/` | `~/.claude/scripts/codex-review-pipeline/` | Codex-first adversarial review runner used by Phase 3 of `/orchestrate` |
| `skills/` | `~/.claude/skills/` | 14 Claude variants of the platform-specific skills, plus an empty `learned/` landing directory |

The 62 shared skills are **not** here. They are symlinked from `~/.agents/skills` into
`~/.claude/skills` at install time, so both CLIs load the same file.

## How CLAUDE.md imports the shared rules

`CLAUDE.md` does not duplicate the rules. It contains a single import line:

```markdown
@~/.agents/RULES.md
```

Claude Code resolves that at session start, so editing `~/.agents/RULES.md` takes effect on the
next session with no sync step. (Codex has no import mechanism, which is why `codex/AGENTS.md`
carries a synced copy instead.) `CLAUDE.md` also points at
`~/.claude/rules/common/agents.md` and `performance.md` for the longer-form agent and model
routing guidance.

## settings.example.json

Copy it to `~/.claude/settings.json` **only if that file does not already exist** - the installer
takes this approach because `settings.json` accumulates machine-local state (marketplace entries,
enabled plugins, local permissions) that must not be clobbered. If you already have one, diff the
example against it and merge the parts you want by hand.

Top-level keys: `env`, `permissions`, `model`, `hooks`, `enabledPlugins`,
`extraKnownMarketplaces`, `effortLevel`, `skipDangerousModePermissionPrompt`. The `hooks` block
mirrors `hooks/hooks.json`; keep the two consistent when you change either.

## ECC plugin manifest gotcha

If you package any of this as a Claude Code plugin (the way the upstream Everything Claude Code
plugin does), the manifest is stricter than it looks:

- Every component field (`skills`, `commands`, `agents`, `hooks`) must be an **array**, even when
  it holds a single entry - a bare string is silently ignored.
- `agents` will not glob a directory; each agent needs an **explicit file path**.
- `version` is **required**; a manifest without it fails to load rather than defaulting.

A manifest that violates any of these tends to load "successfully" with components missing, so
verify with `/skill-doctor` or `claude plugin eval` rather than trusting a clean start.
