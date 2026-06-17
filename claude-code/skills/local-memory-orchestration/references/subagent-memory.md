# Subagent Memory

Every subagent should start from retrieval, not chat memory alone.

## Shared Prompt Block

```markdown
## Memory Context
- vault: <path>
- config: <path>
- retrieval command: python3 <skill-dir>/scripts/memoryctl.py search --root <repo> "<query>"
- required notes: <paths>
- report note: 03_Agent_Memory/Subagent_Reports.md
```

## Reports

### Codebase Cartographer

```markdown
## Codebase Cartographer Report
- Relevant files:
- Existing patterns:
- Dependencies:
- Risk areas:
- Recommended edit points:
```

### Implementation Agent

```markdown
## Implementation Report
- Files changed:
- Behavior changed:
- Important decisions:
- Known limitations:
```

### Test/CI Agent

```markdown
## Test/CI Report
- Commands run:
- Passing tests:
- Failing tests:
- Failure causes:
- Fix recommendations:
```

### Documentation/Memory Agent

```markdown
## Documentation/Memory Report
- Notes updated:
- New knowledge captured:
- Index updated:
- Follow-up tasks:
```

### Review Agent

```markdown
## Review Report
- Requirements satisfied:
- Potential regressions:
- Code quality notes:
- Security concerns:
- Final recommendation:
```

## Rule

The hub decides what gets persisted. Subagents may propose memory updates, but should not spam the vault with raw transcripts.
