---
name: strategic-compact
description: Preserve important context at phase boundaries by writing Codex memory snapshots before starting fresh or resuming a session.
origin: ECC migrated to Codex
---

# Strategic Compact

Use this skill during long Codex sessions when context is getting bulky or the work is moving between phases.

## When To Use

- Research is complete and implementation is about to start
- A plan has been written and the next step is code
- A major milestone is done
- Debugging produced lots of noisy traces
- The next task is unrelated to the current context
- Responses are getting slower or less coherent

## Codex-Compatible Workflow

Codex does not rely on Claude-style lifecycle hooks for this. Preserve durable context explicitly:

1. Write the important state to a file.
   - Project-specific: `.codex/memory/`
   - Global: `~/.codex/memory/snapshots/`
2. Keep only what matters:
   - objective
   - decisions made
   - files touched
   - commands run and results
   - known failures
   - exact next step
3. Resume or start a fresh Codex session with that file available.

Helper command:

```bash
~/.codex/scripts/codex-save-context project "Implemented auth plan; next run tests and fix API contract"
```

Or pipe a longer summary:

```bash
cat <<'EOF' | ~/.codex/scripts/codex-save-context project
Objective:
Decisions:
Files touched:
Verification:
Next step:
EOF
```

## Compaction Decision Guide

| Phase Transition | Snapshot? | Why |
|---|---:|---|
| Research -> Planning | Yes | Preserve findings, drop raw exploration noise |
| Planning -> Implementation | Yes | Keep the plan, free room for code |
| Implementation -> Testing | Maybe | Snapshot if tests will be a separate pass |
| Debugging -> Next feature | Yes | Avoid carrying dead-end traces |
| Mid-implementation | No | Keep active file/symbol context |
| After a failed approach | Yes | Record what failed before trying a new path |

## What Persists

| Persists | Does Not Persist Unless Written |
|---|---|
| Files on disk | Intermediate reasoning |
| Git state | Tool call history |
| `AGENTS.md` instructions | Verbal preferences from the session |
| `~/.codex/memory` files | File contents read earlier |
| `update_plan` only inside current turn | Long-term task history |

## Best Practices

- Write a snapshot before starting fresh.
- Keep snapshots concise and factual.
- Include absolute paths when the next session needs them.
- Prefer a project `.codex/memory/` snapshot for repo-specific work.
- Use `codex resume --last` when continuing the same Codex session is enough.
