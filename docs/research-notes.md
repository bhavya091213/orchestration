# Research Notes

Sources consulted when this repo was first designed (2026-06-16) and kept as background reading. The design decisions from that era were superseded by the 2026-09-24 rebuild described in [orchestration-workflow.md](orchestration-workflow.md) and [layout-and-sync.md](layout-and-sync.md).

## Sources Checked

- Anthropic Agent Skills overview: progressive disclosure through metadata, `SKILL.md`, and optional resources. <https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview>
- Anthropic "Equipping agents for the real world with Agent Skills": skills should load metadata first and deeper files only when needed. <https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills>
- Anthropic "Effective context engineering for AI agents": context is finite; use just-in-time retrieval, compaction, structured notes, and subagent architectures for long-horizon tasks. <https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents>
- Claude Code subagents documentation: subagents isolate context, run focused work in parallel, and return only their final message to the parent. <https://code.claude.com/docs/en/agent-sdk/subagents>
- Claude Code hooks documentation: hooks are structured lifecycle handlers configured in settings with hook event, matcher, and handler layers. <https://code.claude.com/docs/en/hooks>
- OpenAI Codex skills documentation: Codex skills are directories with `SKILL.md`, optional scripts/references/assets, and descriptions should be concise for implicit activation. <https://developers.openai.com/codex/skills>
- OpenAI Codex `AGENTS.md` documentation: Codex layers global and project instructions and respects size limits. <https://developers.openai.com/codex/guides/agents-md>
- `notmanas/claude-code-skills`: example repository structure, `degit` install flow, and skill style using concise `SKILL.md` plus references. <https://github.com/notmanas/claude-code-skills>

