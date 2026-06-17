# Repository Agent Guidance

This repository packages orchestration skills for both Codex and Claude Code.

## Maintenance Rules

- Keep `SKILL.md` files concise. Move detailed frameworks into `references/`.
- Keep Codex and Claude Code skill copies aligned unless platform behavior requires a difference.
- Prefer install examples that use `npx degit` into the expected platform directory.
- Do not add transient logs, local sessions, caches, or personal credentials.
- When adding a new skill, add both:
  - `codex/skills/<skill>/SKILL.md`
  - `claude-code/skills/<skill>/SKILL.md`
- When adding agent personalities, add both:
  - `codex/agents/<agent>.toml`
  - `claude-code/agents/<agent>.md`
- Keep `local-memory-orchestration` mirrored between Codex and Claude Code.
- Prefer repo-local memory examples over system-wide examples in public docs.

## Verification

Before publishing:

- Run `find . -name SKILL.md` and check each frontmatter has `name` and `description`.
- Search for absolute personal paths before committing.
- Confirm README install commands match the repository layout.
- Run the `memoryctl.py` smoke test in a temp directory after changing local-memory scripts.
