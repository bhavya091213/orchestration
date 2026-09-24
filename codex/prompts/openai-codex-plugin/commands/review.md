---
description: Run a Codex code review against local git state.
---

# Codex Review

Use the native Codex review path through the local wrapper:

```bash
~/.codex/scripts/codex-review --wait --scope auto
```

Common forms:

```bash
~/.codex/scripts/codex-review --wait --scope working-tree
~/.codex/scripts/codex-review --wait --base main
~/.codex/scripts/codex-review --background --scope auto
```

Behavior:
- Review only. Do not apply fixes while running this recipe.
- Preserve the user's arguments.
- Use `--wait` for small reviews.
- Use `--background` for larger reviews, then check progress with `~/.codex/scripts/codex-status`.
- For custom focus text or design challenge, use `~/.codex/scripts/codex-adversarial-review`.
