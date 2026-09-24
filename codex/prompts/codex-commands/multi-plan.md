---
description: Create a structured implementation plan using Codex-native exploration, optional subagents, and durable plan files.
---

# Multi-Plan

Use this recipe through:

```bash
~/.codex/scripts/codex-prompt multi-plan "<task>"
```

## Goal

Produce a high-confidence implementation plan and save it to `.codex/plan/<feature-name>.md`.
Do not modify production code while planning.

## Codex-Native Workflow

1. Clarify the request.
   - If the request is ambiguous, ask targeted questions before planning.
   - If enough context exists, proceed without blocking on unnecessary questions.

2. Gather repository context.
   - Use `rg --files` to find candidate files.
   - Use `rg` to locate symbols, routes, commands, schemas, tests, and config.
   - Read only the files needed to understand the change.
   - Check `package.json`, lockfiles, build configs, test configs, and project `AGENTS.md` files when relevant.
   - If local knowledge exists (`.obsidian/`, `docs/`, `wiki/`, `knowledge/`, `notes/`, `handbook/`, `playbooks/`, or markdown collections), run `~/.codex/scripts/codex-knowledge search "<planning query>"` and include only the selected chunks in the plan context.

3. Use Codex subagents only when explicitly appropriate.
   - If the user asked for parallel or multi-agent work, delegate bounded exploration to configured Codex roles such as `explorer`, `planner`, `architect`, `reviewer`, or `security_reviewer`.
   - For Markdown, Obsidian note, prompt recipe, `AGENTS.md`, or `SKILL.md` writing, use the `markdown_writer` role.
   - Keep subagent tasks read-only during planning.
   - Continue local analysis while subagents run.

4. Synthesize the plan.
   - State the chosen approach and why.
   - List files likely to change.
   - Include test and verification steps.
   - Call out risks, assumptions, and open questions.

5. Save the plan.
   - Create `.codex/plan/` if needed.
   - Save the plan as `.codex/plan/<feature-name>.md`.
   - Use a short lowercase kebab-case feature name.

## Plan Format

```markdown
# Implementation Plan: <task>

## Objective
<what will change and why>

## Current System Notes
- <relevant existing behavior>

## Proposed Approach
<concise architecture and data-flow explanation>

## Files To Touch
| File | Change |
|---|---|
| path/to/file | planned change |

## Steps
1. <implementation step>
2. <implementation step>

## Verification
- <build/lint/typecheck/test command>
- <manual check if needed>

## Risks And Assumptions
- <risk or assumption>

## Knowledge Retrieval
- root: <repo root or "not used">
- query: <query used or "none">
- selected: <path#heading list or "none">
- gaps: <remaining context gaps or "none">

## Open Questions
- <question or "None">
```

End by showing the saved plan path and asking the user whether to execute, revise, or stop.
