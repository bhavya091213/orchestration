---
name: product-ux-review
description: Review product, UX, workflow, and information architecture decisions with user-task focus, cognitive load checks, and implementation-ready recommendations. Use for dashboards, SaaS tools, onboarding flows, forms, product specs, user-facing plans, or when design/product quality matters before implementation.
---

# Product UX Review

Review the actual user workflow, not just the screen.

## Workflow

1. Identify the target user and primary task.
2. Read the current page/spec/code enough to understand the flow.
3. Audit task clarity, information hierarchy, cognitive load, interaction cost, error states, empty states, and responsiveness.
4. Present the highest-impact issues first.
5. Produce implementation-ready recommendations that fit the existing design system.

## Output

```markdown
User/task: [who is doing what]

Top issues:
| Severity | Issue | Principle | Recommendation |
| --- | --- | --- | --- |

Proposed flow:
1. [step]
2. [step]

Implementation notes:
- [component/layout/state]

Questions:
- [only product/domain decisions the reviewer cannot infer]
```

## Rules

- Do not redesign for aesthetics alone.
- Tie every issue to user impact.
- Use existing components before adding new ones.
- Ask for product/domain priorities when metrics or workflows are ambiguous.
- For complex audits, read `references/ux-audit.md`.
