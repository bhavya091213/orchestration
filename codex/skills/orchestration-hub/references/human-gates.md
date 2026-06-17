# Human-In-The-Loop Gates

Use gates to prevent agents from confidently marching past product, cost, or risk decisions.

## Gate Types

| Gate | Trigger | Ask |
| --- | --- | --- |
| Direction | multiple viable strategies | "Which direction should I optimize for?" |
| Scope | task expands beyond request | "Should I include this adjacent work or leave it?" |
| Model spend | many agents or best models | "Use best models, fit-for-purpose, or economy?" |
| Implementation | plan is ready | "Proceed with implementation?" |
| Destructive action | deletes, migrations, remote writes | "Approve this exact action?" |
| Domain uncertainty | business/product meaning is unclear | "Which interpretation is correct?" |

## Question Pattern

Ask at most three options. Put the recommended option first and explain the tradeoff in one sentence.

```markdown
Decision: [short]
Recommended: [option] because [reason].
Options:
1. [Option A] - [tradeoff]
2. [Option B] - [tradeoff]
3. [Option C] - [tradeoff]
```

## Avoid

- Asking for approval on every minor step.
- Presenting vague options like "do you want me to continue?"
- Making product/domain assumptions silently.
- Letting spokes ask the user directly unless delegated by the hub.
