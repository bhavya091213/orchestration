---
description: End-to-end Codex workflow for research, planning, implementation, verification, and review.
---

# Multi-Workflow

Use this recipe through:

```bash
~/.codex/scripts/codex-prompt multi-workflow "<task>"
```

## Phases

1. Research
   - Gather repository context with `rg --files`, `rg`, and targeted file reads.
   - Check project instructions in `AGENTS.md` and relevant `.codex/` files.
   - If the repository contains `.obsidian/`, `docs/`, `wiki/`, `knowledge/`, `notes/`, `handbook/`, `playbooks/`, or markdown collections, run `~/.codex/scripts/codex-knowledge search "<task-specific query>"` and load only relevant chunks.
   - Score requirement clarity. Ask focused questions if scope is unclear.

2. Plan
   - Draft implementation options and choose the least risky approach.
   - Save the approved plan to `.codex/plan/<task>.md` when useful.
   - Use `update_plan` for live task tracking.

3. Execute
   - Preserve unrelated user edits.
   - Use `apply_patch` for manual edits.
   - Keep changes scoped to the plan.

4. Optimize
   - Refactor only where it reduces risk or meaningful complexity.
   - Avoid unrelated cleanup.

5. Verify
   - Run narrow tests first, then broader build/lint/typecheck/test commands as needed.
   - Capture failures, fix in small steps, and rerun verification.

6. Review
   - Run `~/.codex/scripts/codex-review --wait --scope working-tree` for code review.
   - Use `~/.codex/scripts/codex-adversarial-review --wait --scope working-tree "<focus>"` for design-sensitive changes.

## Optional Parallelism

If the user explicitly asks for multi-agent or parallel work, use configured Codex roles:
- `explorer` for read-only codebase discovery
- `planner` for plan critique
- `architect` for design alternatives
- `reviewer` for code review
- `security_reviewer` for security review
- `markdown_writer` for Markdown, Obsidian notes, prompt recipes, AGENTS.md, and SKILL.md writing

Do not delegate the immediate blocking task. Keep write scopes disjoint for worker agents.
Use `markdown_writer` for Markdown-producing subagents instead of high-effort general roles unless the task also requires architecture, security, or complex code reasoning.

## Output

End with:
- Files changed
- Verification commands and results
- Review result or unresolved findings
- Remaining risks or manual steps
