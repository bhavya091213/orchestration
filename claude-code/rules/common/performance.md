# Performance Optimization

## Model Selection Strategy

**Opus** (reasoning-heavy work):
- Planning and architecture
- Debugging root causes
- Code and security reviews
- Anything ambiguous or high-stakes

**Sonnet** (straightforward, well-specified small tasks):
- Mechanical edits and formatting
- Simple file writes
- Running commands and reporting results

**Haiku** (optional):
- Trivial, high-frequency tasks only

State the model explicitly on every subagent spawn. Full policy: see
[~/.claude/CLAUDE.md](../../CLAUDE.md) and [agents.md](./agents.md).

## Context Window Management

Avoid last 20% of context window for:
- Large-scale refactoring
- Feature implementation spanning multiple files
- Debugging complex interactions

Lower context sensitivity tasks:
- Single-file edits
- Independent utility creation
- Documentation updates
- Simple bug fixes

**Subagent budget cap:** a subagent's context must never exceed 100k tokens. Scope
each task to fit and hand over only the files it needs. If a subagent can't finish
within 100k tokens, it must STOP and ask the orchestrator for more budget (stating
work done, work remaining, and estimated tokens needed) rather than degrading. The
orchestrator splits the task or grants more budget. Same guidance applies to the
orchestrator itself — compact or hand off at logical phase boundaries rather than
letting the session bloat.

## Extended Thinking + Plan Mode

Extended thinking is enabled by default, reserving up to 31,999 tokens for internal reasoning.

Control extended thinking via:
- **Toggle**: Option+T (macOS) / Alt+T (Windows/Linux)
- **Config**: Set `alwaysThinkingEnabled` in `~/.claude/settings.json`
- **Budget cap**: `export MAX_THINKING_TOKENS=10000`
- **Verbose mode**: Ctrl+O to see thinking output

For complex tasks requiring deep reasoning:
1. Ensure extended thinking is enabled (on by default)
2. Enable **Plan Mode** for structured approach
3. Use multiple critique rounds for thorough analysis
4. Use split role sub-agents for diverse perspectives

## Build Troubleshooting

If build fails:
1. Use **build-error-resolver** agent
2. Analyze error messages
3. Fix incrementally
4. Verify after each fix
