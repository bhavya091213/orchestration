# Config Model

Use JSON config so setup works without Python YAML dependencies.

## Precedence

Highest wins:

1. Session config: `<repo>/.agent-memory/session.local.json`
2. Repo config: `<repo>/.agent-memory/config.json`
3. System config: `~/.agent-orchestration/config.json`
4. Skill defaults

Do not commit `session.local.json`.

## Baseline Config

```json
{
  "memory": {
    "enabled": true,
    "scope": "repo",
    "update_policy": "meaningful"
  },
  "vault": {
    "path": "obsidian-vault",
    "create_if_missing": true
  },
  "index": {
    "backend": "sqlite-fts5",
    "sqlite_path": ".agent-memory/index.sqlite",
    "hybrid": true,
    "include_code": true,
    "include_tests": true
  },
  "vector": {
    "provider": null,
    "collection": "project_memory",
    "embedding_model": null,
    "endpoint": null
  },
  "trello": {
    "enabled": false,
    "sync_note": "02_Tasks/Trello_Sync.md"
  },
  "subagents": {
    "require_memory_read": true,
    "report_note": "03_Agent_Memory/Subagent_Reports.md"
  }
}
```

## Human Configuration Gates

Ask before changing:

- memory scope: repo, system, or session-only
- vault path if an existing vault is detected
- retrieval backend if more than one local option exists
- whether Trello/task sync should be enabled
- whether code files should be indexed or only notes/docs

## Recommended Defaults

- Repo-level config for project work.
- Session override for experiments.
- System config only for shared personal rules, not project-specific facts.
- SQLite FTS5 baseline even when vector search is configured, because exact identifiers matter in codebases.
