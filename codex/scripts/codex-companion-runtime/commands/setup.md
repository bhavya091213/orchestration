---
description: Check whether the local Codex CLI and companion runtime are ready.
---

# Codex Setup

Run:

```bash
~/.codex/scripts/codex-setup
```

Useful flags:

```bash
~/.codex/scripts/codex-setup --json
~/.codex/scripts/codex-setup --enable-review-gate
~/.codex/scripts/codex-setup --disable-review-gate
```

If Codex is unavailable, install it with:

```bash
npm install -g @openai/codex
```

If Codex is installed but unauthenticated, run:

```bash
codex login
```
