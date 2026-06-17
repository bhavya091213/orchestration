# Work Loop

## Before Work

Summarize:

- feature area
- likely files
- APIs/contracts involved
- tests likely affected
- risks
- unknowns

Retrieve:

- exact text from vault/docs
- local index results
- current code references

Prioritize:

- `01_Project_Context/Architecture.md`
- `01_Project_Context/Coding_Standards.md`
- `01_Project_Context/API_Contracts.md`
- `01_Project_Context/Database_Schema.md`
- `03_Agent_Memory/Common_Bugs.md`
- `03_Agent_Memory/Lessons_Learned.md`
- relevant feature notes
- previous subagent reports

## During Work

Save a short plan to a task note or `03_Agent_Memory/Subagent_Reports.md`:

- files to inspect
- files likely to change
- tests to run
- acceptance criteria
- rollback plan

Use subagents when:

- the task touches multiple independent areas
- frontend and backend can be explored separately
- tests or CI need separate investigation
- refactoring requires impact analysis
- documentation/memory updates are substantial

Do not use subagents for trivial one-file edits.

## After Work

Update:

- `02_Tasks/Completed_Tasks.md`
- `03_Agent_Memory/Lessons_Learned.md`
- `03_Agent_Memory/Common_Bugs.md`
- `05_Code_Map/Important_Files.md`
- relevant feature note under `04_Features/`
- `00_Index/Decision_Log.md` for non-obvious decisions

Then re-index and verify retrieval.

## Final Response

```markdown
# Task Complete: <Task Name>

## What changed
- 

## Files changed
- 

## Tests run
- 

## Obsidian memory updated
- 

## Vector DB updated
- yes/no

## Trello updated
- yes/no

## Remaining risks
- 

## Next recommended task
- 
```
