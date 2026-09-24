# Context Acquisition Protocol

Before non-trivial repository work, check whether local knowledge exists and retrieve a bounded set of relevant chunks.

Use this order:

1. Detect repository root.
2. Discover vaults and documentation directories.
3. Build or update the local index.
4. Search with task-specific queries.
5. Load only the highest-value chunks.
6. Record retrieval metadata in handoffs.

Do not load an entire Obsidian vault, docs tree, or markdown collection into prompt context.

When spawning child agents, pass the parent task, only relevant retrieved snippets, and the exact search command or metadata needed for the child to re-query independently.
