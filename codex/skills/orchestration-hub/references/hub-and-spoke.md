# Hub-And-Spoke Orchestration

## Core Shape

The hub owns:

- user conversation
- task decomposition
- model policy
- token budget
- shared state
- conflict detection
- final synthesis

Spokes own:

- one bounded objective
- one context slice
- one output contract
- no cross-agent coordination
- no final decision authority

Avoid peer-to-peer agent chat. It duplicates context, hides state from the hub, and makes costs unpredictable.

## When To Spawn Spokes

Spawn when at least one is true:

- The work is naturally parallel, such as independent source research.
- The task benefits from isolated context, such as security review after implementation.
- A niche domain requires deep exploration before the hub decides.
- A high-risk decision deserves adversarial review.

Do not spawn when:

- A single file edit or command would finish the task.
- Agents would need to edit the same files concurrently.
- The hub cannot define a concrete stop condition.
- The subtask is just "think about this" without evidence requirements.

## Spoke Roster Pattern

```markdown
| Agent | Objective | Scope | Budget | Output |
| --- | --- | --- | --- | --- |
| research-runner | Find current docs for X | Web + docs only | standard | claims table |
| domain-cartographer | Explain domain model | docs/ + code refs | deep | understanding memo |
| skeptic | Challenge plan | plan only | small | top risks |
```

## Merge Rule

The hub merges on evidence, not volume:

1. Deduplicate repeated findings.
2. Prefer sourced claims over confident claims.
3. Separate facts from recommendations.
4. Convert disagreements into user choices or validation tasks.
5. Keep only the shortest evidence needed for the next action.
