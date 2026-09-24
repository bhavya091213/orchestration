# Agent Orchestration

## Available Agents

Located in `~/.claude/agents/`:

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| planner | Implementation planning | Complex features, refactoring |
| architect | System design | Architectural decisions |
| tdd-guide | Test-driven development | New features, bug fixes |
| code-reviewer | Code review | After writing code |
| security-reviewer | Security analysis | Before commits |
| build-error-resolver | Fix build errors | When build fails |
| e2e-runner | E2E testing | Critical user flows |
| refactor-cleaner | Dead code cleanup | Code maintenance |
| doc-updater | Documentation | Updating docs |
| rust-reviewer | Rust code review | Rust projects |

## Orchestrator Pattern

The active/interactive session is the orchestrator, not the worker. Spawn subagents
whenever possible for any self-contained unit of work (research, file sweeps,
implementation units, reviews, tests); run independent subagents in parallel in one
message. Orchestrator keeps conclusions, not raw file dumps. Direct orchestrator work
only for tiny single-fact lookups or one-line edits. Model routing: Opus for
reasoning-heavy work, Sonnet for well-specified small tasks — state the model on every
spawn. Full policy: see [~/.claude/CLAUDE.md](../../CLAUDE.md).

## Context Budget

Subagent context must never exceed 100k tokens — scope tasks to fit, hand over only
needed files. If a subagent can't finish within budget, it must STOP and ask the
orchestrator for more (with what's done, what's left, estimated tokens needed) instead
of degrading. Orchestrator splits the task or grants more budget. Same applies to the
orchestrator itself: compact/hand off at phase boundaries. Full policy: see
[~/.claude/CLAUDE.md](../../CLAUDE.md).

## Immediate Agent Usage

No user prompt needed — spawn subagents whenever possible:
1. Complex feature requests - Use **planner** agent
2. Code just written/modified - Use **code-reviewer** agent
3. Bug fix or new feature - Use **tdd-guide** agent
4. Architectural decision - Use **architect** agent

## Parallel Task Execution

ALWAYS use parallel Task execution for independent operations:

```markdown
# GOOD: Parallel execution
Launch 3 agents in parallel:
1. Agent 1: Security analysis of auth module
2. Agent 2: Performance review of cache system
3. Agent 3: Type checking of utilities

# BAD: Sequential when unnecessary
First agent 1, then agent 2, then agent 3
```

## Multi-Perspective Analysis

For complex problems, use split role sub-agents:
- Factual reviewer
- Senior engineer
- Security expert
- Consistency reviewer
- Redundancy checker
