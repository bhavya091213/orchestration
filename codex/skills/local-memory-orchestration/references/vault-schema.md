# Vault Schema

Use this structure for project memory:

```text
obsidian-vault/
  00_Index/
    Project_Index.md
    Agent_Run_Log.md
    Decision_Log.md
    Open_Questions.md
  01_Project_Context/
    Architecture.md
    Tech_Stack.md
    Setup_and_Commands.md
    Coding_Standards.md
    API_Contracts.md
    Database_Schema.md
    Env_and_Config.md
  02_Tasks/
    Backlog.md
    Completed_Tasks.md
    Current_Sprint.md
    Trello_Sync.md
  03_Agent_Memory/
    Lessons_Learned.md
    Common_Bugs.md
    Reusable_Patterns.md
    Subagent_Reports.md
    Failed_Attempts.md
  04_Features/
  05_Code_Map/
    Important_Files.md
    File_Ownership.md
    Dependency_Map.md
    Test_Map.md
  06_PRs_and_CI/
    PR_Log.md
    CI_Failures.md
    Review_Checklist.md
```

## Task Entry

```markdown
## YYYY-MM-DD - <Task Name>

### Summary

### Files Changed
- `path/to/file`

### Decisions
- 

### Tests / Verification
- Command:
- Result:

### Lessons Learned
- 

### Follow-ups
- [ ] 
```

## Decision Entry

```markdown
## YYYY-MM-DD - <Decision Title>

### Context

### Decision

### Alternatives Considered
- 

### Why

### Consequences
- Positive:
- Negative:
- Future risk:
```

## Index Update Entry

```markdown
## YYYY-MM-DD HH:mm - Index Update

### Changed Sources
- 

### Indexed
- [ ] Markdown notes
- [ ] Code files
- [ ] Task files
- [ ] API/schema docs

### Verification Query
`...`

### Top Result
...
```
