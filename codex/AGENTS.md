# Codex Orchestration Package

This tree contains Codex-ready skills, agent role templates, and hook helpers.

## Install Targets

- User skills: `~/.codex/skills/<skill-name>`
- Project skills: `.agents/skills/<skill-name>`
- User agent roles: `~/.codex/agents/*.toml`
- Optional scripts: `~/.codex/scripts/`

## Usage Defaults

- Use `orchestration-hub` for multi-agent work.
- Use `local-memory-orchestration` when a repo should persist Obsidian memory or local retrieval rules.
- Use `token-efficient-orchestration` before spawning agents or updating memory.
- Ask for model policy on substantial work: `best`, `fit`, or `economy`.
- Prefer bounded retrieval and file pointers over copied context.
- Keep subagent outputs concise and evidence-backed.
- Prefer repo-level memory config unless the user asks for system or session-only rules.

## Maintenance

- Keep skill descriptions concise and trigger-focused.
- Put long frameworks in `references/`.
- Keep platform-neutral skills aligned with `../claude-code/skills/`.
- Do not commit personal session logs, caches, or credentials.
