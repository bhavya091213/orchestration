# Claude To Codex Equivalents

Use this mapping when a migrated prompt, skill, or rule still contains legacy Claude wording.

| Claude concept | Codex equivalent |
|---|---|
| `CLAUDE.md` | `AGENTS.md` |
| `~/.claude` | `~/.codex` |
| Project `.claude/` | Project `.codex/` |
| Slash command file | Prompt recipe run with `~/.codex/scripts/codex-prompt <name> [args...]` |
| `Bash(...)` | Shell execution in Codex; use the available shell tool or run the command manually |
| `BashOutput` / `TaskOutput` | Poll the returned shell session with `write_stdin`, or use `wait_agent` for Codex subagents |
| `Read` | `sed -n`, `nl -ba`, or editor/file read |
| `Glob` | `rg --files` |
| `Grep` | `rg` |
| `Edit` / `Write` | `apply_patch` for manual edits |
| `TodoWrite` | `update_plan` |
| `Task` subagent | `spawn_agent` only when the user explicitly asks for delegated/parallel agent work |
| Claude hooks | Codex workflow scripts, git hooks, or manual preflight/verification commands |
| `claude -p` | `codex exec` |
| `/compact` | Save durable context to `~/.codex/memory` or project `.codex/` files, then start/resume a Codex session |

Codex-native command wrappers:

```bash
~/.codex/scripts/codex-prompt <recipe> [arguments...]
~/.codex/scripts/codex-review --wait --scope auto
~/.codex/scripts/codex-adversarial-review --wait --scope auto "focus"
~/.codex/scripts/codex-rescue --wait "task"
~/.codex/scripts/codex-status
~/.codex/scripts/codex-result <job-id>
~/.codex/scripts/codex-cancel <job-id>
~/.codex/scripts/codex-setup
```
