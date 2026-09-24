# shared/ - the single source of truth

This directory mirrors `~/.agents`, which holds everything Claude Code and Codex CLI have in
common. Edit here, run the sync script, and both tools pick it up. Never hand-edit the rendered
copies inside `~/.claude` or `~/.codex`.

## Layout

| Path | What it holds |
| --- | --- |
| `skills/` | 62 shared agent skills |
| `RULES.md` | Shared operating rules, loaded by both CLIs |
| `mcp-servers.json` | Shared MCP server definitions |
| `skill-lock.json` | Pinned provenance for skills sourced from upstream repos |
| `bin/sync-agents` | Renders rules and MCP config into both tools |

After installation, `~/.agents/backups/` also appears: timestamped snapshots taken by
`install.sh` and by the sync tooling before any destructive-looking write. Nothing in this setup
deletes; it moves things there instead.

## Skills

Skills install as **symlinks** from `~/.agents/skills/<name>` into both `~/.claude/skills/<name>`
and `~/.codex/skills/<name>`. Because they are symlinks, adding or editing a skill is picked up by
both tools immediately, with no sync step.

Consequence for this repo: a skill that both tools can use lives **only** in `shared/skills/`. It
is never duplicated into `claude-code/skills/` or `codex/skills/` - those two directories are
reserved for the small set of skills whose body is genuinely tool-specific, and those ship as a
matched Claude/Codex pair.

Every `SKILL.md` needs `name` and `description` frontmatter; `name` must match the directory name.

## Rules

`RULES.md` is the contract. Sections A–E: session pre-flight, orchestrator pattern, model/effort
routing, the 100k-token subagent context budget, and the never-delete policy.

- **Claude Code** imports the file directly. `~/.claude/CLAUDE.md` contains `@~/.agents/RULES.md`,
  so edits take effect on the next session with no sync step.
- **Codex CLI** has no import mechanism, so `~/.codex/AGENTS.md` carries a synced copy between
  these markers:

  ```
  <!-- BEGIN SHARED RULES (synced from ~/.agents/RULES.md) -->
  ...
  <!-- END SHARED RULES -->
  ```

  Run `sync-agents rules` after editing `RULES.md` to refresh that block. Everything outside the
  markers in `AGENTS.md` is left untouched.

## MCP servers

`mcp-servers.json` is keyed by server name:

```json
{
  "servers": {
    "example": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "some-mcp-server"],
      "env": {},
      "targets": ["claude", "codex"]
    }
  }
}
```

`type` is `stdio` (uses `command`/`args`/`env`) or `http` (uses `url`). `targets` picks which
tools receive the server - omit one to keep a server on a single CLI.

Running `sync-agents` writes the `[mcp_servers.*]` tables in `~/.codex/config.toml` as a
text-level edit, so every other line and comment is preserved byte-for-byte, and registers
Claude's **user-scope** servers through the `claude mcp` CLI. `~/.claude.json` is never edited
directly, because Claude Code rewrites that file and manual edits get clobbered.

## Using sync-agents

```bash
~/.agents/bin/sync-agents                # same as `mcp`
~/.agents/bin/sync-agents mcp --dry-run  # show the plan without changing anything
~/.agents/bin/sync-agents mcp --prune    # also drop servers missing from the JSON
~/.agents/bin/sync-agents rules          # refresh the AGENTS.md shared-rules block
~/.agents/bin/sync-agents status         # table of server -> in Claude? in Codex?
```

`config.toml` is backed up to `~/.codex/config.toml.bak-sync` before any write and re-validated
with `tomllib` afterwards; a parse failure restores the backup and exits non-zero. `--prune` is
off by default and only ever touches servers the script knows about (Codex `[mcp_servers.*]`
tables and Claude user-scope entries) - plugin- and connector-provided servers are left alone.

**Optional:** put `~/.agents/bin` on your `PATH` so you can just type `sync-agents`:

```bash
echo 'export PATH="$HOME/.agents/bin:$PATH"' >> ~/.zshrc
```
