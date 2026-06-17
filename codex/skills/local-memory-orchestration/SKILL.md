---
name: local-memory-orchestration
description: Configure and use a local-first project memory layer with an Obsidian vault plus a local retrieval database. Use when a repository should persist agent run logs, decisions, task notes, code maps, lessons learned, subagent reports, Trello/task sync, or hybrid keyword/vector retrieval across sessions. Includes human configuration gates for repo-level, system-level, and session-level memory rules.
---

# Local Memory Orchestration

Use local memory as the shared project knowledge layer. The vault is the human-readable source of truth; the local index is the fast retrieval layer.

## Configure First

For a repository without clear memory rules, ask one compact configuration question:

```markdown
Memory setup for this session?
1. Repo memory (recommended) - create/use `obsidian-vault/` and `.agent-memory/` in this repo.
2. System memory - use a shared vault/index configured under the user's home directory.
3. Session-only memory - use temporary rules for this run and do not persist project config.
```

Then ask for retrieval backend only if it is not already configured:

```markdown
Retrieval backend?
1. SQLite FTS5 baseline (recommended) - local, dependency-free exact/hybrid-ready index.
2. Existing local vector DB - use configured Chroma, LanceDB, Qdrant, or sqlite-vec.
3. No index - vault notes only, with direct text search.
```

Default to repo memory plus SQLite FTS5 when the user says to proceed.

## Bootstrap Commands

From a project root:

```bash
python3 <skill-dir>/scripts/memoryctl.py init --root . --scope repo
python3 <skill-dir>/scripts/memoryctl.py index --root .
python3 <skill-dir>/scripts/memoryctl.py search --root . "task or feature query"
```

Use `--vault <path>` for a custom vault folder and `--backend chroma|lancedb|qdrant|sqlite-vec|sqlite-fts5` to record the desired backend.

## Required Work Loop

1. Load task and identify feature area, likely files, tests, risks, and unknowns.
2. Retrieve from the vault and local index before code changes.
3. Inspect current source code and tests. Current code beats stale notes.
4. Write a short plan and store it in the task note or `03_Agent_Memory/Subagent_Reports.md`.
5. Delegate subagents only when work is independent.
6. Implement and verify.
7. Update relevant memory notes.
8. Re-index changed notes/docs/code.
9. Log index result in `00_Index/Agent_Run_Log.md`.
10. Summarize final result with memory/index status.

Skip only for trivial tasks, and say which steps were skipped.

## Memory Updates

Update memory only with durable information:

- what changed and why
- files touched
- APIs/contracts affected
- tests run
- bugs discovered
- decisions made
- rejected approaches
- future cleanup

Never store secrets, tokens, raw logs, or large code dumps.

## References

Read only what applies:

- `references/config-model.md` for repo/system/session precedence and config fields.
- `references/vault-schema.md` for Obsidian folder structure and note templates.
- `references/retrieval-index.md` for hybrid search, vector DB options, metadata, and chunking.
- `references/work-loop.md` for before/during/after task behavior.
- `references/subagent-memory.md` for subagent report contracts and shared memory rules.
