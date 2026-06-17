# Research Notes

Generated: 2026-06-16

## Sources Checked

- Anthropic Agent Skills overview: progressive disclosure through metadata, `SKILL.md`, and optional resources. <https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview>
- Anthropic "Equipping agents for the real world with Agent Skills": skills should load metadata first and deeper files only when needed. <https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills>
- Anthropic "Effective context engineering for AI agents": context is finite; use just-in-time retrieval, compaction, structured notes, and subagent architectures for long-horizon tasks. <https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents>
- Claude Code subagents documentation: subagents isolate context, run focused work in parallel, and return only their final message to the parent. <https://code.claude.com/docs/en/agent-sdk/subagents>
- Claude Code hooks documentation: hooks are structured lifecycle handlers configured in settings with hook event, matcher, and handler layers. <https://code.claude.com/docs/en/hooks>
- OpenAI Codex skills documentation: Codex skills are directories with `SKILL.md`, optional scripts/references/assets, and descriptions should be concise for implicit activation. <https://developers.openai.com/codex/skills>
- OpenAI Codex `AGENTS.md` documentation: Codex layers global and project instructions and respects size limits. <https://developers.openai.com/codex/guides/agents-md>
- `notmanas/claude-code-skills`: example repository structure, `degit` install flow, and skill style using concise `SKILL.md` plus references. <https://github.com/notmanas/claude-code-skills>

## Design Decisions Applied

- Use hub-and-spoke orchestration instead of peer-to-peer agent chat.
- Keep the hub responsible for planning, user gates, model policy, state, and synthesis.
- Give spokes bounded prompts and require concise evidence-based outputs.
- Add model policy as a user decision: `best`, `fit`, or `economy`.
- Add local memory configuration with repo, system, and session scopes.
- Use an Obsidian vault as the human-readable memory source and a local SQLite/vector retrieval layer as the index.
- Keep SQLite FTS5 available even when vector retrieval is configured, because exact identifiers matter in codebases.
- Add deep-understanding and research skills for non-code work.
- Add adversarial pair review with separated steelman and skeptic roles.
- Keep detailed methods in `references/` so normal invocations do not load everything.
