# Retrieval And Indexing

## Backend Order

Prefer local-first retrieval:

1. SQLite FTS5 baseline with exact search.
2. SQLite FTS5 plus sqlite-vec if extension is installed.
3. SQLite FTS5 plus Chroma.
4. SQLite FTS5 plus LanceDB.
5. SQLite FTS5 plus local Qdrant.
6. Direct vault search only.

Always keep exact search available. Pure vector retrieval misses file names, symbols, API routes, schema fields, package names, and error strings.

## Search Modes

- Exact search: file names, functions, routes, schema fields, package names, errors.
- Vector search: similar bugs, architectural decisions, vague feature behavior, prior lessons.
- Hybrid search: most important work. Merge exact and vector results with rank fusion, then read the top evidence.

## Chunking

- Markdown: split by heading.
- Code: split by function, class, module, or max-size fallback.
- Config: keep logical sections together.
- Tasks: one task per chunk.
- PR/CI logs: one failure/result per chunk.

## Metadata

Each chunk should preserve:

```json
{
  "source_path": "...",
  "doc_type": "obsidian_note | code | test | config | task | pr | ci",
  "title": "...",
  "heading_path": "...",
  "last_modified": "...",
  "task_id": "...",
  "feature": "...",
  "symbols": ["..."],
  "tags": ["..."]
}
```

## Conflict Rule

When retrieved memory conflicts:

1. current source code
2. current tests
3. latest decision log
4. latest feature note
5. older task notes

If a note is stale, update it after verification.
