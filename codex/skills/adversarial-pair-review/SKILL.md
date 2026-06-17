---
name: adversarial-pair-review
description: Run a two-sided adversarial review by separating a steelman agent and a skeptic agent, then synthesizing a judge verdict. Use for plans, architecture, implementation proposals, research conclusions, UX decisions, or any high-risk decision where optimism, hidden assumptions, or missed failure modes matter.
---

# Adversarial Pair Review

Run two independent perspectives, then judge. Do not let the skeptic review without first preserving the best case for the proposal.

## Roles

- `Steelman`: explain why the proposal is reasonable, what constraints it satisfies, and what would make it successful.
- `Skeptic`: find hidden assumptions, failure modes, missing evidence, and ways the decision could fail.
- `Judge`: synthesize the two into a verdict and actions.

If subagents are available, spawn Steelman and Skeptic separately. If not, simulate the roles sequentially with separated notes.

## Process

1. Capture the proposal or artifact under review.
2. Run Steelman without seeing Skeptic's critique.
3. Run Skeptic without seeing Steelman's output when possible.
4. Judge the disagreement.
5. Return a concise verdict: `ship`, `ship-with-changes`, or `rethink`.

## Output

```markdown
Verdict: ship | ship-with-changes | rethink

What this gets right:
- [steelman point]

Top concerns:
| Severity | Concern | Why it matters | Fix |
| --- | --- | --- | --- |

Decision:
[recommended action]

Follow-up checks:
1. [check]
2. [check]
```

## Rules

- Maximum 7 concerns.
- Every concern needs a consequence and a fix.
- Do not invent criticism when the artifact is sound.
- Mark what is blocking versus non-blocking.

Read `references/review-frameworks.md` for challenge patterns.
