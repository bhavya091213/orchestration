---
name: online-research-runner
description: Run bounded online research with source quality tiers, citations, claim/evidence tables, recency checks, and concise synthesis. Use when a task needs current web information, official docs, competitor analysis, market or product research, library/API documentation, or evidence-backed recommendations.
---

# Online Research Runner

Research with evidence. Prefer primary sources and official docs. Keep source text out of the prompt unless needed for a claim.

## Workflow

1. Define 3-5 research questions.
2. Search broadly, then deep-read the best sources.
3. Rank sources: official docs, primary repos, standards, papers, reputable reporting, then blogs/forums.
4. Build a claim/evidence table.
5. Separate facts, interpretations, and recommendations.
6. Return concise synthesis with links.

## Output

```markdown
Research goal: [one sentence]

Key findings:
- [finding] ([source](url))

Claim/evidence:
| Claim | Evidence | Confidence |
| --- | --- | --- |
| [claim] | [source/link] | high/medium/low |

Open questions:
- [gap]

Recommendation:
[short decision-oriented recommendation]
```

## Rules

- Cite sources for claims.
- For software/library usage, prefer official docs and primary repos.
- For current facts, verify dates and use recent sources.
- If sources disagree, show the disagreement.
- Do not produce a long report unless asked.

Read `references/source-quality.md` for source selection and `references/research-brief.md` for deeper reports.
