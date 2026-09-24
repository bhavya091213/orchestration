---
description: Run an adversarial Codex review that challenges implementation approach, design choices, and assumptions.
---

# Codex Adversarial Review

Run:

```bash
~/.codex/scripts/codex-adversarial-review --wait --scope auto "<focus text>"
```

Common forms:

```bash
~/.codex/scripts/codex-adversarial-review --wait --base main "challenge the architecture"
~/.codex/scripts/codex-adversarial-review --background --scope working-tree "look for scaling and security risks"
```

Behavior:
- Review only. Do not apply fixes while running this recipe.
- Focus on whether the approach should ship, what assumptions it depends on, and where it could fail.
- Use `--background` for larger reviews, then check progress with `~/.codex/scripts/codex-status`.
