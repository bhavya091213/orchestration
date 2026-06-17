# Claude Code Orchestration Package

This tree contains Claude Code-ready skills, subagent templates, and hook helpers.

## Install Targets

- User skills: `~/.claude/skills/<skill-name>`
- Project skills: `.claude/skills/<skill-name>`
- User agents: `~/.claude/agents/*.md`
- Project agents: `.claude/agents/*.md`
- Optional hooks: `~/.claude/scripts/hooks/`

## Usage Defaults

- Use `orchestration-hub` for multi-agent work.
- Use `local-memory-orchestration` when a repo should persist Obsidian memory or local retrieval rules.
- Use `token-efficient-orchestration` before spawning agents or updating memory.
- Ask for model policy on substantial work: `best`, `fit`, or `economy`.
- Prefer hub-and-spoke delegation; avoid peer-to-peer agent chat.
- Keep subagent outputs concise and evidence-backed.
- Prefer repo-level memory config unless the user asks for system or session-only rules.

## Maintenance

- Keep skill descriptions concise and trigger-focused.
- Put long frameworks in `references/`.
- Keep platform-neutral skills aligned with `../codex/skills/`.
- Do not commit personal session logs, caches, or credentials.
