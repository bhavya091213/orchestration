# Model Routing

## Policy Options

Ask the user which policy to use for non-trivial orchestration:

- `best`: use the strongest available model for hub and spokes.
- `fit`: use the strongest model for the hub and hard reasoning, cheaper models for narrow extraction, formatting, and rote checks.
- `economy`: use cheaper models first and escalate only when quality, ambiguity, or risk justifies it.

Default: `fit`.

## Routing Table

| Work type | Reasoning | Suggested model class |
| --- | --- | --- |
| Hub synthesis, architecture, final decisions | high | best available |
| Deep niche research, domain mapping, adversarial review | high | strong reasoning |
| Code implementation in known area | medium-high | fit to repo risk |
| Test writing, lint fixes, docs, markdown | low-medium | cheaper capable model |
| Source extraction, file inventory, formatting | low | cheapest reliable model |

## Escalation Triggers

Escalate when:

- sources disagree
- the plan affects security, money, data loss, or production availability
- the agent cannot explain its confidence
- repeated cheap passes fail
- the user asks for best models

De-escalate when:

- the task is mechanical
- verification is deterministic
- output is markdown or summarization
- a smaller model can be checked by tests or a reviewer

## Budget Discipline

- Put budget in the spoke prompt: `small`, `standard`, or `deep`.
- Require each spoke to stop after enough evidence, not after exhausting search space.
- Require concise final messages; raw logs stay inside the spoke context.
