---
description: Execute a saved `.codex/plan/*.md` plan with Codex-native edits, verification, and optional review.
---

# Multi-Execute

Use this recipe through:

```bash
~/.codex/scripts/codex-prompt multi-execute ".codex/plan/<feature-name>.md"
```

## Goal

Implement the plan with minimal, maintainable changes. Keep all edits in the current workspace unless the user explicitly asks for worktrees or parallel agents.

## Codex-Native Workflow

1. Read the plan.
   - If the argument is a plan path, read it fully.
   - If the argument is a direct task, make a short execution plan first.
   - Confirm only if the plan is missing key details or the task is high-risk.

2. Inspect current state.
   - Run `git status --short`.
   - Read target files before editing.
   - Check for user changes and preserve them.

3. Implement.
   - Use `apply_patch` for manual edits.
   - Keep changes scoped to the plan.
   - Follow local style, tests, and existing abstractions.
   - Update docs/config only when required by behavior.

4. Verify.
   - Run the narrowest meaningful test first.
   - Run broader build/lint/typecheck/test commands when the change affects shared behavior.
   - If verification fails, diagnose and fix until the remaining failure is outside scope or blocked.

5. Review.
   - For normal review, run `~/.codex/scripts/codex-review --wait --scope working-tree`.
   - For design-sensitive changes, run `~/.codex/scripts/codex-adversarial-review --wait --scope working-tree "<focus>"`.
   - Fix valid findings or document why they are not applicable.

6. Report.
   - Summarize changed files.
   - List verification commands and results.
   - Call out any unresolved risks or manual follow-up.

## Guardrails

- Never overwrite unrelated user edits.
- Do not use destructive git commands.
- Do not broaden scope just because adjacent cleanup is visible.
- If a fix requires credentials, production access, or irreversible operations, stop and ask.
