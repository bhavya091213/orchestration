---
name: evolve
description: Analyze instincts and suggest or generate evolved structures
command: true
---

# Evolve Command

## Implementation

Run the instinct CLI using the plugin root path:

```bash
python3 "${CODEX_COMPANION_ROOT}/skills/continuous-learning-v2/scripts/instinct-cli.py" evolve [--generate]
```

Or if `CODEX_COMPANION_ROOT` is not set (manual installation):

```bash
python3 ~/.codex/skills/continuous-learning-v2/scripts/instinct-cli.py evolve [--generate]
```

Analyzes instincts and clusters related ones into higher-level structures:
- **Commands**: When instincts describe user-invoked actions
- **Skills**: When instincts describe auto-triggered behaviors
- **Agents**: When instincts describe complex, multi-step processes

## Usage

```
/evolve                    # Analyze all instincts and suggest evolutions
/evolve --generate         # Also generate files under evolved/{skills,commands,agents}
```

## Evolution Rules

### → Command (User-Invoked)
When instincts describe actions a user would explicitly request:
- Multiple instincts about "when user asks to..."
- Instincts with triggers like "when creating a new X"
- Instincts that follow a repeatable sequence

Example:
- `new-table-step1`: "when adding a database table, create migration"
- `new-table-step2`: "when adding a database table, update schema"
- `new-table-step3`: "when adding a database table, regenerate types"

→ Creates: **new-table** command

### → Skill (Auto-Triggered)
When instincts describe behaviors that should happen automatically:
- Pattern-matching triggers
- Error handling responses
- Code style enforcement

Example:
- `prefer-functional`: "when writing functions, prefer functional style"
- `use-immutable`: "when modifying state, use immutable patterns"
- `avoid-classes`: "when designing modules, avoid class-based design"

→ Creates: `functional-patterns` skill

### → Agent (Needs Depth/Isolation)
When instincts describe complex, multi-step processes that benefit from isolation:
- Debugging workflows
- Refactoring sequences
- Research tasks

Example:
- `debug-step1`: "when debugging, first check logs"
- `debug-step2`: "when debugging, isolate the failing component"
- `debug-step3`: "when debugging, create minimal reproduction"
- `debug-step4`: "when debugging, verify fix with test"

→ Creates: **debugger** agent

## What to Do

1. Detect current project context
2. If the current project has local knowledge sources, run `~/.codex/scripts/codex-knowledge search "evolve instincts skills agents project conventions" --limit 8 --max-chars 12000`
3. Read project + global instincts (project takes precedence on ID conflicts)
4. Group instincts by trigger/domain patterns
5. Identify:
   - Skill candidates (trigger clusters with 2+ instincts)
   - Command candidates (high-confidence workflow instincts)
   - Agent candidates (larger, high-confidence clusters)
6. Show promotion candidates (project -> global) when applicable
7. If `--generate` is passed, write files to:
   - Project scope: `~/.codex/homunculus/projects/<project-id>/evolved/`
   - Global fallback: `~/.codex/homunculus/evolved/`

Generated skills that rely on project docs, vaults, or markdown knowledge must include a context acquisition protocol that references `~/.codex/scripts/codex-knowledge`. Generated Markdown-writing agents should use `gpt-5.4` with low effort unless the cluster clearly requires deeper reasoning.

## Output Format

```
============================================================
  EVOLVE ANALYSIS - 12 instincts
  Project: my-app (a1b2c3d4e5f6)
  Project-scoped: 8 | Global: 4
============================================================

High confidence instincts (>=80%): 5

## SKILL CANDIDATES
1. Cluster: "adding tests"
   Instincts: 3
   Avg confidence: 82%
   Domains: testing
   Scopes: project

## COMMAND CANDIDATES (2)
  /adding-tests
    From: test-first-workflow [project]
    Confidence: 84%

## AGENT CANDIDATES (1)
  adding-tests-agent
    Covers 3 instincts
    Avg confidence: 82%
```

## Flags

- `--generate`: Generate evolved files in addition to analysis output

## Generated File Format

### Command
```markdown
---
name: new-table
description: Create a new database table with migration, schema update, and type generation
command: /new-table
evolved_from:
  - new-table-migration
  - update-schema
  - regenerate-types
---

# New Table Command

[Generated content based on clustered instincts]

## Steps
1. ...
2. ...
```

### Skill
```markdown
---
name: functional-patterns
description: Enforce functional programming patterns
evolved_from:
  - prefer-functional
  - use-immutable
  - avoid-classes
---

# Functional Patterns Skill

[Generated content based on clustered instincts]

## Context Acquisition Protocol
Before applying this skill in a repository with `.obsidian/`, `docs/`, `wiki/`, `knowledge/`, `notes/`, `handbook/`, or `playbooks/`, run `~/.codex/scripts/codex-knowledge search "<task-specific query>"` and load only relevant chunks.
```

### Agent
```markdown
---
name: debugger
description: Systematic debugging agent
model: gpt-5.5
evolved_from:
  - debug-check-logs
  - debug-isolate
  - debug-reproduce
---

# Debugger Agent

[Generated content based on clustered instincts]
```

For Markdown-focused agents, use:

```yaml
model: gpt-5.4
model_reasoning_effort: low
```
