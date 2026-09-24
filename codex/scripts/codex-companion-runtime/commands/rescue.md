---
description: Delegate an investigation, fix request, or follow-up rescue task to a background-capable Codex run.
---

# Codex Rescue

Run:

```bash
~/.codex/scripts/codex-rescue --wait "<task>"
```

Common forms:

```bash
~/.codex/scripts/codex-rescue --wait "diagnose why the build fails and propose a fix"
~/.codex/scripts/codex-rescue --background "investigate flaky Playwright tests"
~/.codex/scripts/codex-rescue --resume "continue the previous rescue thread"
~/.codex/scripts/codex-rescue --fresh --effort high "deep root-cause analysis"
```

Behavior:
- Use this for substantial investigation or implementation work that benefits from an isolated Codex run.
- Use `--wait` when the task is small enough to return immediately.
- Use `--background` for long work, then inspect progress with `~/.codex/scripts/codex-status`.
- Fetch completed output with `~/.codex/scripts/codex-result <job-id>`.
