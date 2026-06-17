---
name: human-loop-planner
description: Create high-control plans with explicit user decision gates, assumptions, tradeoffs, and approval points before implementation. Use for ambiguous product work, architecture choices, multi-step refactors, research-to-plan workflows, or any task where the user wants extreme human-in-the-loop planning.
---

# Human Loop Planner

Plan in collaboration with the user. Do not treat uncertainty as permission to guess.

## Process

1. Restate the objective in one sentence.
2. Separate facts, assumptions, and open decisions.
3. Identify the smallest useful next decision.
4. Present 2-3 options with tradeoffs and a recommendation.
5. Wait for approval when the next step affects product direction, architecture, cost, or irreversible work.
6. Convert the chosen direction into phased, testable steps.

## Planning Output

```markdown
Objective: [one sentence]

Known facts:
- [fact with source/path if available]

Assumptions:
- [assumption and how to validate]

Decision needed:
Recommended: [option] because [reason]
1. [option] - [tradeoff]
2. [option] - [tradeoff]
3. [option] - [tradeoff]

Plan after decision:
1. [phase/action]
2. [phase/action]

Verification:
- [checks]
```

## Gates

Use `references/decision-gates.md` when the task involves several approvals, model-spend choices, user research, or product/domain uncertainty.

## Rules

- Ask fewer, better questions.
- Make default recommendations explicit.
- Do not hide unresolved ambiguity inside implementation steps.
- Keep plans mergeable in phases.
- If implementation starts, preserve the decision log in the final summary.
