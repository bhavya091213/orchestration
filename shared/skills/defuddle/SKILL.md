---
name: defuddle
description: Extract clean markdown content from web pages using Defuddle CLI, removing clutter and navigation to save tokens. Use instead of WebFetch when the user provides a URL to read or analyze, for online documentation, articles, blog posts, or any standard web page. Use with local-knowledge-retrieval when saving extracted pages into a repo-local Obsidian vault, docs, notes, or markdown knowledge base. Do NOT use for URLs ending in .md because those are already markdown.
---

# Defuddle

Use Defuddle CLI to extract clean readable content from web pages. Prefer over WebFetch for standard web pages -- it removes navigation, ads, and clutter, reducing token usage.

If not installed, prefer installing into the user-local PATH:

```bash
npm install --prefix ~/.local defuddle
ln -sf ~/.local/node_modules/.bin/defuddle ~/.local/bin/defuddle
```

Fallback:

```bash
npx defuddle parse <url> --md
```

When the output will become part of a repository-local vault or docs tree, run `~/.codex/scripts/codex-knowledge index` after saving so future agents can retrieve it without loading the whole collection.

## Usage

Always use `--md` for markdown output:

```bash
defuddle parse <url> --md
```

Save to file:

```bash
defuddle parse <url> --md -o content.md
```

Extract specific metadata:

```bash
defuddle parse <url> -p title
defuddle parse <url> -p description
defuddle parse <url> -p domain
```

## Output formats

| Flag | Format |
|------|--------|
| `--md` | Markdown (default choice) |
| `--json` | JSON with both HTML and markdown |
| (none) | HTML |
| `-p <name>` | Specific metadata property |
