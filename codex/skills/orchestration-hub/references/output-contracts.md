# Output Contracts

## Spoke Prompt Template

```markdown
## Role
[agent name and purpose]

## Objective
[one bounded outcome]

## Scope
- Read: [paths, URLs, tools]
- Write: [none or exact paths]
- Do not: [protected work]

## Context Pointers
- [file path, heading, URL, command, note]

## Budget
small | standard | deep

## Required Output
- Verdict: [one sentence]
- Evidence: [3-7 bullets with file/line/source links]
- Risks: [0-5 bullets]
- Next actions: [ordered list]
- Confidence: high | medium | low, with reason

## Stop Conditions
[conditions that require returning early]
```

## Spoke Return Template

```markdown
Verdict: [one sentence]

Evidence:
- [source/path] - [finding]

Risks:
- [risk and consequence]

Next actions:
1. [action]
2. [action]

Confidence: [high|medium|low] - [why]
```

## Hub Synthesis Template

```markdown
Decision: [what the hub recommends]
Why: [2-4 bullets]
Disagreements: [what agents differed on, if any]
User choice: [only if needed]
Next: [concrete actions]
```
