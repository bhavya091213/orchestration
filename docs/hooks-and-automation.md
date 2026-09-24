# Hooks & Automation

Both harnesses run shell commands at lifecycle points, but they do very different
amounts of it. Claude Code wires **21 hooks across 6 events**; Codex CLI wires
**2 hooks across 2 events** and does the equivalent work through explicit scripts
and skills instead.

Sources: [`claude-code/hooks/hooks.json`](../claude-code/hooks/hooks.json),
[`claude-code/hooks/README.md`](../claude-code/hooks/README.md),
[`claude-code/scripts/hooks/`](../claude-code/scripts/hooks),
[`codex/hooks.json`](../codex/hooks.json),
[`codex/scripts/ecc/hooks/`](../codex/scripts/ecc/hooks).

---

## How a Claude hook is dispatched

Almost every entry goes through a wrapper rather than calling the script
directly:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/hooks/run-with-flags.js" \
  "<hookId>" "scripts/hooks/<script>.js" "<profilesCsv>"
```

[`run-with-flags.js`](../claude-code/scripts/hooks/run-with-flags.js) reads stdin
(capped at 1 MB), checks `isHookEnabled(hookId, { profiles })`, and either runs
the target script or passes stdin straight through unchanged. Shell-based hooks
use the sibling `run-with-flags-shell.sh` with the same three arguments.

That indirection is what makes hooks runtime-switchable without editing
`hooks.json`. From `claude-code/hooks/README.md`:

```bash
# minimal | standard | strict (default: standard)
export ECC_HOOK_PROFILE=standard

# Disable specific hook IDs (comma-separated)
export ECC_DISABLED_HOOKS="pre:bash:tmux-reminder,post:edit:typecheck"
```

| Profile | Meaning |
|---|---|
| `minimal` | essential lifecycle and safety hooks only |
| `standard` | default; balanced quality + safety checks |
| `strict` | additional reminders and stricter guardrails |

The CSV in each hook entry is the **set of profiles the hook is active in**. A
hook listed `strict` only fires under `ECC_HOOK_PROFILE=strict`; one listed
`minimal,standard,strict` always fires.

Paths resolve against `${CLAUDE_PLUGIN_ROOT}`, i.e. this config is written to be
installed as the `everything-claude-code` plugin. The `SessionStart` entry is the
exception — it is a long `bash -lc` that probes `${CLAUDE_PLUGIN_ROOT}`, then
`~/.claude/plugins/everything-claude-code`, then the `@everything-claude-code`
and `marketplace/` variants, then falls back to a `find`-based search, and if
nothing resolves prints a warning to stderr, echoes stdin back, and exits 0. It
degrades rather than breaking the session.

---

## Claude Code hook table

### `PreToolUse`

| Matcher | Hook ID | Script | Profiles | Purpose |
|---|---|---|---|---|
| `Bash` | *(direct call)* | `auto-tmux-dev.js` | always | Start dev servers in a named tmux session (directory-based names) so they don't block; `cmd` on Windows |
| `Bash` | `pre:bash:tmux-reminder` | `pre-bash-tmux-reminder.js` | `strict` | Remind the agent to use tmux for long-running commands |
| `Bash` | `pre:bash:git-push-reminder` | `pre-bash-git-push-reminder.js` | `strict` | Remind to review changes before `git push` |
| `Write` | `pre:write:doc-file-warning` | `doc-file-warning.js` | `standard,strict` | Warn about non-standard documentation files. **Exit 0 always — warns, never blocks** |
| `Edit\|Write` | `pre:edit-write:suggest-compact` | `suggest-compact.js` | `standard,strict` | Suggest manual `/compact` at logical intervals |
| `*` | `pre:observe` | `skills/continuous-learning-v2/hooks/observe.sh` | `standard,strict` | Capture tool-use observations for continuous learning (async, 10s) |
| `Bash\|Write\|Edit\|MultiEdit` | `pre:insaits-security` | `insaits-security-wrapper.js` | `standard,strict` | Optional AI security monitor. **Opt-in:** `ECC_ENABLE_INSAITS=1`, requires `pip install insa-its` (15s) |

`auto-tmux-dev.js` is the only hook called directly rather than through
`run-with-flags.js`, so it cannot be disabled by profile or `ECC_DISABLED_HOOKS`.

### `PostToolUse`

| Matcher | Hook ID | Script | Profiles | Purpose |
|---|---|---|---|---|
| `Bash` | `post:bash:pr-created` | `post-bash-pr-created.js` | `standard,strict` | Detect a PR URL in output, log it, surface the review command |
| `Bash` | `post:bash:build-complete` | `post-bash-build-complete.js` | `standard,strict` | Async build analysis; the in-repo example of a non-blocking hook (30s) |
| `Edit\|Write\|MultiEdit` | `post:quality-gate` | `quality-gate.js` | `standard,strict` | Lightweight quality checks after file edits (async, 30s) |
| `Edit` | `post:edit:format` | `post-edit-format.js` | `standard,strict` | Auto-format JS/TS, auto-detecting Biome or Prettier |
| `Edit` | `post:edit:typecheck` | `post-edit-typecheck.js` | `standard,strict` | `tsc` check after editing `.ts`/`.tsx` |
| `Edit` | `post:edit:console-warn` | `post-edit-console-warn.js` | `standard,strict` | Warn about `console.log` introduced by the edit |
| `*` | `post:observe` | `skills/continuous-learning-v2/hooks/observe.sh` | `standard,strict` | Capture tool-use *results* for continuous learning (async, 10s) |

The `pre:observe` / `post:observe` pair is the continuous-learning v2 sensor:
one records intent, the other the outcome.

### `Stop` — fires after each assistant response

| Matcher | Hook ID | Script | Profiles | Purpose |
|---|---|---|---|---|
| `*` | `stop:check-console-log` | `check-console-log.js` | `standard,strict` | Check for `console.log` in modified files |
| `*` | `stop:session-end` | `session-end.js` | `minimal,standard,strict` | Persist session state (`Stop` carries `transcript_path`) (async, 10s) |
| `*` | `stop:evaluate-session` | `evaluate-session.js` | `minimal,standard,strict` | Continuous-learning session evaluator: look for extractable patterns (async, 10s) |
| `*` | `stop:cost-tracker` | `cost-tracker.js` | `minimal,standard,strict` | Append token/cost metrics to `~/.claude/metrics/costs.jsonl` (async, 10s) |

Three of the four survive `ECC_HOOK_PROFILE=minimal` — state persistence,
learning, and cost tracking are treated as essential.

### `PreCompact`, `SessionStart`, `SessionEnd`

| Event | Matcher | Hook ID | Script | Profiles | Purpose |
|---|---|---|---|---|---|
| `PreCompact` | `*` | `pre:compact` | `pre-compact.js` | `standard,strict` | Save state before context compaction |
| `SessionStart` | `*` | `session:start` | `session-start.js` | `minimal,standard,strict` | Load previous context, detect package manager |
| `SessionEnd` | `*` | `session:end:marker` | `session-end-marker.js` | `minimal,standard,strict` | Lifecycle marker; passes stdin through unchanged (async, 10s) |

### Scripts present but not wired

| Script | Status |
|---|---|
| `run-with-flags.js`, `run-with-flags-shell.sh` | wrappers invoked by every other entry |
| `check-hook-enabled.js` | CLI probe for `isHookEnabled` — useful when writing new hooks |
| `insaits-security-monitor.py` | the Python monitor the JS wrapper shells out to |
| `pre-write-doc-warn.js` | backward-compatible alias for `doc-file-warning.js` |
| `pre-bash-dev-server-block.js` | not referenced in `hooks.json`; blocks foreground dev-server commands. Enable by adding a `PreToolUse`/`Bash` entry |

All hook scripts are written cross-platform (Windows, macOS, Linux) — the header
comment appears in most of them, and `auto-tmux-dev.js` documents a `cmd`
fallback where tmux is unavailable.

---

## Codex CLI hook table

[`codex/hooks.json`](../codex/hooks.json) is deliberately small:

| Event | Matcher | Command | Timeout | Purpose |
|---|---|---|---|---|
| `SessionStart` | `startup\|resume` | `$HOME/.local/bin/headroom init hook ensure --profile init-user --marker headroom-init-codex` | 15s | Ensure the Headroom init proxy is running before the session starts |
| `PreToolUse` | `Bash` | *(same command)* | 15s | Re-ensure the proxy before any shell execution |

Both point at the same idempotent `ensure` call. This pairs with
`codex/config.example.toml`, which routes Codex through a local proxy
(`model_provider = "headroom"`, `openai_base_url = "http://127.0.0.1:8787/v1"`)
and sets `hooks = true` in the features block.

Notably, Codex has **no** formatting, typecheck, quality-gate, learning, or
cost-tracking hooks. That is by design —
[`codex/workflows/claude-to-codex-equivalents.md`](../codex/workflows/claude-to-codex-equivalents.md)
maps the gap explicitly:

| Claude concept | Codex equivalent |
|---|---|
| Claude hooks | Codex workflow scripts, git hooks, or manual preflight/verification commands |
| `/compact` | Save durable context to `~/.codex/memory` or project `.codex/` files, then start/resume a session |
| `Task` subagent | `spawn_agent`, only when the user explicitly asks for delegated work |
| `TodoWrite` | `update_plan` |

### Codex-side automation that isn't hooks

`codex/scripts/ecc/` carries the machinery Codex uses instead of lifecycle hooks:

- **`ecc/hooks/`** — a full mirror of all 25 Claude hook scripts (same filenames,
  same `run-with-flags.js` / `hook-flags.js` mechanism). Present so Codex-side
  workflow scripts and git hooks can invoke the same logic on demand; **not**
  wired by `codex/hooks.json`.
- **`ecc/codex-git-hooks/`** — `pre-commit` and `pre-push`, installed by
  `ecc/codex/install-global-git-hooks.sh`. Git-level enforcement replaces what
  Claude does at `PostToolUse`.
- **`ecc/ci/`** — 7 validators plus a catalog builder, run as checks rather than hooks:
  `validate-agents.js`, `validate-commands.js`, `validate-hooks.js`,
  `validate-install-manifests.js`, `validate-no-personal-paths.js`,
  `validate-rules.js`, `validate-skills.js`, and `catalog.js`.
- **`ecc/lib/hook-flags.js`** — the `isHookEnabled` implementation behind
  `ECC_HOOK_PROFILE` and `ECC_DISABLED_HOOKS`, plus `ecc/lib/shell-split.js`.

> **Packaging note:** the hook scripts `require('../lib/...')` (`hook-flags`,
> `shell-split`, `utils`, `resolve-formatter`, `package-manager`,
> `project-detect`, `session-aliases`). Those modules are vendored in
> `claude-code/scripts/lib/` (copied from the ECC plugin's `scripts/lib`), so the
> installer places them at `~/.claude/scripts/lib/` and every hook loads
> standalone. Every hook in `claude-code/scripts/hooks/` has been smoke-tested with
> `echo '{}' | node <hook>` and exits 0.

---

## The learning skills behind the hooks

Three skills exist in both tool trees as separate real directories (see
[layout-and-sync.md](./layout-and-sync.md#the-skill-symlink-model)), because each
is implemented against its harness's actual capabilities.

### `continuous-learning` (v1)

| | Claude | Codex |
|---|---|---|
| description | "Automatically extract reusable patterns from Claude Code sessions and save them as learned skills for future use." | same, for Codex sessions |
| trigger | runs as a **Stop hook** (`stop:evaluate-session` → `evaluate-session.js`) | "can run as an explicit session-end check" — git hook, workflow script, or manual |
| output | `~/.claude/skills/learned/` | `~/.codex/skills/learned/` |

Three steps either way: **Session Evaluation** (enough messages? default 10+) →
**Pattern Detection** → **Skill Extraction**. Thresholds and pattern categories
live in each skill's `config.json`.

### `continuous-learning-v2` (v2.1)

> Instinct-based learning system that observes sessions via hooks, creates atomic
> instincts with confidence scoring, and evolves them into skills/commands/agents.
> v2.1 adds project-scoped instincts to prevent cross-project contamination.

The Codex frontmatter swaps "via hooks" for "through explicit event adapters" and
"skills/commands/agents" for "skills, prompt recipes, or agent templates" — same
architecture, different substrate.

| Feature | v2.0 | v2.1 |
|---|---|---|
| Storage | global (`~/.claude/homunculus/` · `~/.codex/homunculus/`) | project-scoped (`projects/<hash>/`) |
| Scope | all instincts apply everywhere | project-scoped + global |
| Detection | none | git remote URL / repo path |
| Promotion | n/a | project → global when seen in 2+ projects |
| Commands | 4 (status/evolve/export/import) | 6 (+ promote/projects) |

This is the skill behind the `pre:observe` / `post:observe` hooks: `observe.sh`
lives inside the skill directory itself
(`skills/continuous-learning-v2/hooks/observe.sh`) rather than in
`scripts/hooks/`, which is why those two entries use the shell wrapper.

The matching slash commands ship in `claude-code/commands/`: `instinct-status`,
`instinct-export`, `instinct-import`, `evolve`, `promote`, `projects`, `learn`,
`learn-eval`.

### `strategic-compact`

> Suggests manual context compaction at logical intervals to preserve context
> through task phases rather than arbitrary auto-compaction.

The skill's argument: auto-compaction "triggers at arbitrary points… often
mid-task, losing important context" and has "no awareness of logical task
boundaries." Strategic boundaries it recommends: after exploration before
execution, after a milestone, before a major context shift.

- **Claude:** wired as the `pre:edit-write:suggest-compact` `PreToolUse` hook
  (`suggest-compact.js`, "Strategic Compact Suggester").
- **Codex:** no lifecycle hook. The skill instead prescribes writing state
  explicitly to `.codex/memory/` (project) or `~/.codex/memory/snapshots/`
  (global), keeping only objective, decisions made, files touched, and commands
  run with results.

This is the same discipline `shared/RULES.md` § D asks of the orchestrator:
"compact or hand off at logical phase boundaries rather than letting the session
bloat."

---

## Writing or disabling a hook

**Disable at runtime** (preferred, no file edits):

```bash
export ECC_DISABLED_HOOKS="post:edit:typecheck,pre:bash:tmux-reminder"
export ECC_HOOK_PROFILE=minimal
```

**Override as a plugin consumer** — declare the same matcher with an empty
`hooks` array in `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Write", "hooks": [], "description": "Override: allow all .md file creation" }
    ]
  }
}
```

**Write a new one** — hooks read tool input as JSON on stdin and must write JSON
to stdout. `claude-code/hooks/README.md` documents the input schema and carries
four worked recipes: warn about TODO comments, block large file creation,
auto-format Python with ruff, and require test files alongside new source files.
Mark long-running hooks `"async": true` with a `timeout` so they don't block the
turn — `post:bash:build-complete` is the in-repo example.

**Never-delete applies here too.** Retiring a hook script means `mv`-ing it to a
backup location (e.g. `~/.agents/backups/retired-<what>/`), not `rm` — see
`shared/RULES.md` § E.
