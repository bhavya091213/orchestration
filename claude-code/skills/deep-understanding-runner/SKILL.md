---
name: deep-understanding-runner
description: Deep dive into niche domains, unfamiliar codebases, complex concepts, or specialized business areas to build an understanding memo before planning or implementation. Use when the goal is to learn the domain, map concepts, identify terminology, explain hidden constraints, or create reusable knowledge for future agents.
---

# Deep Understanding Runner

Your job is not to implement. Build a compact, reusable mental model.

## Workflow

1. Define the domain boundary and what "understanding" must answer.
2. Gather context with bounded retrieval or web research.
3. Map core concepts, entities, workflows, constraints, and failure modes.
4. Identify what is known, inferred, and still unknown.
5. Produce an understanding memo that future agents can use without rereading everything.

## Output

```markdown
Understanding memo: [topic]

Core model:
- [concept] - [plain-language meaning]

Key relationships:
- [A] affects [B] because [reason/source]

Domain vocabulary:
| Term | Meaning | Source |
| --- | --- | --- |

Operational constraints:
- [constraint]

Common mistakes:
- [mistake and why it matters]

Open questions:
- [question and how to answer it]

Useful next steps:
1. [action]
2. [action]
```

## Rules

- Prefer diagrams-as-text, tables, and glossaries.
- Cite source files, docs, or URLs.
- Stop when you can explain the domain well enough for a planner to act.
- Do not overload the memo with raw excerpts.

Read `references/understanding-memo.md` for larger deliverables.
