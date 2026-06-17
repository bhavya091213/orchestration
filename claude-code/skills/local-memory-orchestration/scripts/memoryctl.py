#!/usr/bin/env python3
"""Local project memory helper for Obsidian vaults and SQLite FTS search."""

from __future__ import annotations

import argparse
import datetime as dt
import fnmatch
import json
import os
import re
import sqlite3
import sys
from pathlib import Path
from typing import Any


DEFAULT_CONFIG: dict[str, Any] = {
    "memory": {"enabled": True, "scope": "repo", "update_policy": "meaningful"},
    "vault": {"path": "obsidian-vault", "create_if_missing": True},
    "index": {
        "backend": "sqlite-fts5",
        "sqlite_path": ".agent-memory/index.sqlite",
        "hybrid": True,
        "include_code": True,
        "include_tests": True,
        "include_globs": [
            "*.md",
            "*.mdx",
            "*.markdown",
            "README*",
            "package.json",
            "pyproject.toml",
            "Cargo.toml",
            "go.mod",
            "*.ts",
            "*.tsx",
            "*.js",
            "*.jsx",
            "*.py",
            "*.go",
            "*.rs",
            "*.java",
            "*.kt",
            "*.sql",
            "*.yaml",
            "*.yml",
            "*.toml",
            "*.json",
        ],
        "exclude_dirs": [
            ".git",
            ".agent-memory",
            "node_modules",
            "dist",
            "build",
            ".next",
            ".venv",
            "venv",
            "__pycache__",
        ],
    },
    "vector": {
        "provider": None,
        "collection": "project_memory",
        "embedding_model": None,
        "endpoint": None,
    },
    "trello": {"enabled": False, "sync_note": "02_Tasks/Trello_Sync.md"},
    "subagents": {
        "require_memory_read": True,
        "report_note": "03_Agent_Memory/Subagent_Reports.md",
    },
}


NOTE_TEMPLATES = {
    "00_Index/Project_Index.md": "# Project Index\n\n## Links\n\n",
    "00_Index/Agent_Run_Log.md": "# Agent Run Log\n\n",
    "00_Index/Decision_Log.md": "# Decision Log\n\n",
    "00_Index/Open_Questions.md": "# Open Questions\n\n",
    "01_Project_Context/Architecture.md": "# Architecture\n\n",
    "01_Project_Context/Tech_Stack.md": "# Tech Stack\n\n",
    "01_Project_Context/Setup_and_Commands.md": "# Setup And Commands\n\n",
    "01_Project_Context/Coding_Standards.md": "# Coding Standards\n\n",
    "01_Project_Context/API_Contracts.md": "# API Contracts\n\n",
    "01_Project_Context/Database_Schema.md": "# Database Schema\n\n",
    "01_Project_Context/Env_and_Config.md": "# Env And Config\n\nDo not store secrets here.\n",
    "02_Tasks/Backlog.md": "# Backlog\n\n",
    "02_Tasks/Completed_Tasks.md": "# Completed Tasks\n\n",
    "02_Tasks/Current_Sprint.md": "# Current Sprint\n\n",
    "02_Tasks/Trello_Sync.md": "# Trello Sync\n\n",
    "03_Agent_Memory/Lessons_Learned.md": "# Lessons Learned\n\n",
    "03_Agent_Memory/Common_Bugs.md": "# Common Bugs\n\n",
    "03_Agent_Memory/Reusable_Patterns.md": "# Reusable Patterns\n\n",
    "03_Agent_Memory/Subagent_Reports.md": "# Subagent Reports\n\n",
    "03_Agent_Memory/Failed_Attempts.md": "# Failed Attempts\n\n",
    "05_Code_Map/Important_Files.md": "# Important Files\n\n",
    "05_Code_Map/File_Ownership.md": "# File Ownership\n\n",
    "05_Code_Map/Dependency_Map.md": "# Dependency Map\n\n",
    "05_Code_Map/Test_Map.md": "# Test Map\n\n",
    "06_PRs_and_CI/PR_Log.md": "# PR Log\n\n",
    "06_PRs_and_CI/CI_Failures.md": "# CI Failures\n\n",
    "06_PRs_and_CI/Review_Checklist.md": "# Review Checklist\n\n",
}


CODE_EXTENSIONS = {
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".py",
    ".go",
    ".rs",
    ".java",
    ".kt",
    ".sql",
}


TEST_PATTERNS = ("test", "spec", "__tests__", "tests/")


def deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    merged = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise SystemExit(f"Invalid JSON in {path}: {error}") from error


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def config_paths(root: Path) -> dict[str, Path]:
    return {
        "system": Path.home() / ".agent-orchestration" / "config.json",
        "repo": root / ".agent-memory" / "config.json",
        "session": root / ".agent-memory" / "session.local.json",
    }


def load_config(root: Path) -> dict[str, Any]:
    paths = config_paths(root)
    config = dict(DEFAULT_CONFIG)
    for scope in ("system", "repo", "session"):
        config = deep_merge(config, read_json(paths[scope]))
    return config


def resolve_under_root(root: Path, value: str) -> Path:
    path = Path(value).expanduser()
    return path if path.is_absolute() else root / path


def init_memory(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    root.mkdir(parents=True, exist_ok=True)
    paths = config_paths(root)
    config = deep_merge(
        DEFAULT_CONFIG,
        {
            "memory": {"scope": args.scope},
            "vault": {"path": args.vault},
            "index": {"backend": args.backend},
            "vector": {"provider": None if args.backend == "sqlite-fts5" else args.backend},
        },
    )
    target = paths[args.scope]
    write_json(target, config)

    if args.scope != "system":
        create_vault(root, config)
        gitignore = root / ".agent-memory" / ".gitignore"
        if not gitignore.exists():
            gitignore.write_text("session.local.json\n*.sqlite-shm\n*.sqlite-wal\n", encoding="utf-8")

    print(f"config: {target}")
    if args.scope != "system":
        print(f"vault: {resolve_under_root(root, config['vault']['path'])}")
    return 0


def configure(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    paths = config_paths(root)
    target = paths["session" if args.session else "repo"]
    config = read_json(target)
    updates: dict[str, Any] = {}
    if args.vault:
        updates = deep_merge(updates, {"vault": {"path": args.vault}})
    if args.backend:
        updates = deep_merge(
            updates,
            {
                "index": {"backend": args.backend},
                "vector": {"provider": None if args.backend == "sqlite-fts5" else args.backend},
            },
        )
    if args.update_policy:
        updates = deep_merge(updates, {"memory": {"update_policy": args.update_policy}})
    config = deep_merge(config or DEFAULT_CONFIG, updates)
    write_json(target, config)
    print(f"updated: {target}")
    return 0


def create_vault(root: Path, config: dict[str, Any]) -> None:
    vault = resolve_under_root(root, config["vault"]["path"])
    for rel_path, content in NOTE_TEMPLATES.items():
        path = vault / rel_path
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            path.write_text(content, encoding="utf-8")
    (vault / "04_Features").mkdir(parents=True, exist_ok=True)


def should_skip(path: Path, root: Path, exclude_dirs: list[str]) -> bool:
    rel_parts = path.relative_to(root).parts
    return any(part in exclude_dirs for part in rel_parts)


def matches_include(path: Path, include_globs: list[str]) -> bool:
    name = path.name
    rel = str(path)
    return any(fnmatch.fnmatch(name, pattern) or fnmatch.fnmatch(rel, pattern) for pattern in include_globs)


def discover_sources(root: Path, config: dict[str, Any]) -> list[Path]:
    include_globs = config["index"].get("include_globs", [])
    exclude_dirs = config["index"].get("exclude_dirs", [])
    sources: list[Path] = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if should_skip(path, root, exclude_dirs):
            continue
        if matches_include(path.relative_to(root), include_globs):
            sources.append(path)
    return sorted(set(sources))


def doc_type_for(path: Path, root: Path, config: dict[str, Any]) -> str:
    rel = path.relative_to(root).as_posix()
    vault = config["vault"]["path"].strip("/").rstrip("/")
    lowered = rel.lower()
    if lowered.startswith(vault.lower() + "/"):
        return "obsidian_note"
    if any(pattern in lowered for pattern in TEST_PATTERNS):
        return "test"
    if path.suffix in CODE_EXTENSIONS:
        if "route" in lowered or "api" in lowered:
            return "code"
        return "code"
    if any(token in lowered for token in ("schema", "model", "migration")):
        return "config"
    if path.name.lower().startswith("readme") or path.suffix.lower() in {".md", ".mdx", ".markdown"}:
        return "doc"
    return "config"


def extract_tags(text: str) -> list[str]:
    tags = sorted(set(re.findall(r"(?<!\w)#([A-Za-z0-9_/-]+)", text)))
    return tags[:25]


def extract_symbols(text: str, suffix: str) -> list[str]:
    patterns = [
        r"\bclass\s+([A-Za-z_][A-Za-z0-9_]*)",
        r"\bdef\s+([A-Za-z_][A-Za-z0-9_]*)",
        r"\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)",
        r"\b(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=",
        r"\bfunc\s+([A-Za-z_][A-Za-z0-9_]*)",
        r"\bfn\s+([A-Za-z_][A-Za-z0-9_]*)",
    ]
    symbols: list[str] = []
    for pattern in patterns:
        symbols.extend(re.findall(pattern, text))
    return sorted(set(symbols))[:50]


def split_large(content: str, max_chars: int = 6000) -> list[str]:
    if len(content) <= max_chars:
        return [content]
    chunks: list[str] = []
    current: list[str] = []
    size = 0
    for paragraph in re.split(r"(\n\s*\n)", content):
        if size + len(paragraph) > max_chars and current:
            chunks.append("".join(current).strip())
            current = []
            size = 0
        current.append(paragraph)
        size += len(paragraph)
    if current:
        chunks.append("".join(current).strip())
    return [chunk for chunk in chunks if chunk]


def chunk_markdown(path: Path, text: str) -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []
    current_heading = path.stem
    current: list[str] = []
    heading_re = re.compile(r"^(#{1,6})\s+(.+?)\s*$")
    for line in text.splitlines(keepends=True):
        match = heading_re.match(line.strip())
        if match and current:
            body = "".join(current).strip()
            for part in split_large(body):
                chunks.append({"title": current_heading, "heading_path": current_heading, "content": part})
            current = []
        if match:
            current_heading = match.group(2).strip()
        current.append(line)
    body = "".join(current).strip()
    if body:
        for part in split_large(body):
            chunks.append({"title": current_heading, "heading_path": current_heading, "content": part})
    return chunks or [{"title": path.stem, "heading_path": "", "content": text}]


def chunk_code(path: Path, text: str) -> list[dict[str, Any]]:
    boundary = re.compile(
        r"^\s*(class|def|function|export\s+function|export\s+class|const|let|var|func|fn)\s+([A-Za-z_][A-Za-z0-9_]*)",
        re.MULTILINE,
    )
    matches = list(boundary.finditer(text))
    if not matches:
        return [
            {"title": path.name, "heading_path": f"chunk {idx + 1}", "content": part}
            for idx, part in enumerate(split_large(text))
        ]
    chunks: list[dict[str, Any]] = []
    for idx, match in enumerate(matches):
        start = match.start()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        symbol = match.group(2)
        body = text[start:end].strip()
        for part in split_large(body):
            chunks.append({"title": symbol, "heading_path": symbol, "content": part})
    return chunks


def chunks_for(path: Path, root: Path, config: dict[str, Any]) -> list[dict[str, Any]]:
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return []
    if not text.strip():
        return []
    if path.suffix.lower() in {".md", ".mdx", ".markdown"} or path.name.lower().startswith("readme"):
        raw_chunks = chunk_markdown(path, text)
    elif path.suffix in CODE_EXTENSIONS:
        raw_chunks = chunk_code(path, text)
    else:
        raw_chunks = [
            {"title": path.name, "heading_path": f"chunk {idx + 1}", "content": part}
            for idx, part in enumerate(split_large(text))
        ]
    stat = path.stat()
    rel = path.relative_to(root).as_posix()
    doc_type = doc_type_for(path, root, config)
    tags = extract_tags(text)
    symbols = extract_symbols(text, path.suffix)
    enriched: list[dict[str, Any]] = []
    for chunk in raw_chunks:
        enriched.append(
            {
                "source_path": rel,
                "doc_type": doc_type,
                "title": chunk["title"],
                "heading_path": chunk["heading_path"],
                "last_modified": dt.datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
                "task_id": "",
                "feature": feature_for(rel),
                "symbols": symbols,
                "tags": tags,
                "content": chunk["content"],
            }
        )
    return enriched


def feature_for(rel_path: str) -> str:
    parts = rel_path.split("/")
    if "04_Features" in parts:
        idx = parts.index("04_Features")
        if idx + 1 < len(parts):
            return Path(parts[idx + 1]).stem
    return ""


def connect_index(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def reset_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        DROP TABLE IF EXISTS chunks_fts;
        DROP TABLE IF EXISTS chunks;
        CREATE TABLE chunks (
          id INTEGER PRIMARY KEY,
          source_path TEXT NOT NULL,
          doc_type TEXT NOT NULL,
          title TEXT,
          heading_path TEXT,
          last_modified TEXT,
          task_id TEXT,
          feature TEXT,
          symbols TEXT,
          tags TEXT,
          content TEXT NOT NULL
        );
        CREATE VIRTUAL TABLE chunks_fts USING fts5(
          title,
          heading_path,
          symbols,
          tags,
          content,
          content='chunks',
          content_rowid='id'
        );
        """
    )


def index_sources(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    config = load_config(root)
    if not config["memory"].get("enabled", True):
        print("memory disabled")
        return 0
    create_vault(root, config)
    db_path = resolve_under_root(root, config["index"]["sqlite_path"])
    conn = connect_index(db_path)
    reset_schema(conn)
    count = 0
    files = 0
    for source in discover_sources(root, config):
        chunks = chunks_for(source, root, config)
        if not chunks:
            continue
        files += 1
        for chunk in chunks:
            cursor = conn.execute(
                """
                INSERT INTO chunks (
                  source_path, doc_type, title, heading_path, last_modified,
                  task_id, feature, symbols, tags, content
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    chunk["source_path"],
                    chunk["doc_type"],
                    chunk["title"],
                    chunk["heading_path"],
                    chunk["last_modified"],
                    chunk["task_id"],
                    chunk["feature"],
                    json.dumps(chunk["symbols"]),
                    json.dumps(chunk["tags"]),
                    chunk["content"],
                ),
            )
            rowid = cursor.lastrowid
            conn.execute(
                """
                INSERT INTO chunks_fts(rowid, title, heading_path, symbols, tags, content)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    rowid,
                    chunk["title"],
                    chunk["heading_path"],
                    " ".join(chunk["symbols"]),
                    " ".join(chunk["tags"]),
                    chunk["content"],
                ),
            )
            count += 1
    conn.commit()
    append_index_log(root, config, files, count, args.verify_query or "")
    print(f"indexed files: {files}")
    print(f"indexed chunks: {count}")
    print(f"index: {db_path}")
    return 0


def fts_query(query: str) -> str:
    tokens = re.findall(r"[A-Za-z0-9_./:-]+", query)
    safe = [token.replace('"', "") for token in tokens if token.strip()]
    return " OR ".join(f'"{token}"' for token in safe[:12])


def search(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    config = load_config(root)
    db_path = resolve_under_root(root, config["index"]["sqlite_path"])
    if not db_path.exists():
        raise SystemExit(f"index not found: {db_path}. Run `memoryctl.py index --root {root}` first.")
    match_query = fts_query(args.query)
    if not match_query:
        raise SystemExit("query has no searchable tokens")
    conn = sqlite3.connect(db_path)
    try:
        rows = conn.execute(
            """
            SELECT
              c.source_path,
              c.doc_type,
              c.title,
              c.heading_path,
              c.last_modified,
              c.symbols,
              c.tags,
              snippet(chunks_fts, 4, '[', ']', ' ... ', 40) AS excerpt,
              bm25(chunks_fts) AS score
            FROM chunks_fts
            JOIN chunks c ON c.id = chunks_fts.rowid
            WHERE chunks_fts MATCH ?
            ORDER BY score
            LIMIT ?
            """,
            (match_query, args.limit),
        ).fetchall()
    except sqlite3.OperationalError:
        rows = []
    if not rows:
        print("No results.")
        return 1
    for idx, row in enumerate(rows, start=1):
        source_path, doc_type, title, heading_path, last_modified, symbols, tags, excerpt, score = row
        print(f"## {idx}. {source_path}")
        print(f"- type: {doc_type}")
        print(f"- title: {title}")
        if heading_path:
            print(f"- heading: {heading_path}")
        print(f"- modified: {last_modified}")
        print(f"- score: {score:.4f}")
        print()
        print((excerpt or "").strip())
        print()
    return 0


def append_index_log(root: Path, config: dict[str, Any], files: int, chunks: int, verify_query: str) -> None:
    vault = resolve_under_root(root, config["vault"]["path"])
    log = vault / "00_Index" / "Agent_Run_Log.md"
    log.parent.mkdir(parents=True, exist_ok=True)
    now = dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    body = [
        f"## {now} - Index Update",
        "",
        "### Changed Sources",
        "- local scan",
        "",
        "### Indexed",
        f"- [x] Files: {files}",
        f"- [x] Chunks: {chunks}",
        "",
        "### Verification Query",
        f"`{verify_query or 'not provided'}`",
        "",
    ]
    with log.open("a", encoding="utf-8") as handle:
        handle.write("\n".join(body) + "\n")


def append_note(args: argparse.Namespace) -> int:
    root = Path(args.root).resolve()
    config = load_config(root)
    vault = resolve_under_root(root, config["vault"]["path"])
    note = vault / args.note
    note.parent.mkdir(parents=True, exist_ok=True)
    now = dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    body = args.body or sys.stdin.read()
    with note.open("a", encoding="utf-8") as handle:
        handle.write(f"\n## {now} - {args.title}\n\n{body.strip()}\n")
    print(f"updated: {note}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Manage local agent memory.")
    sub = parser.add_subparsers(dest="command", required=True)

    init_parser = sub.add_parser("init", help="Create memory config and vault skeleton.")
    init_parser.add_argument("--root", default=".")
    init_parser.add_argument("--scope", choices=["repo", "system", "session"], default="repo")
    init_parser.add_argument("--vault", default="obsidian-vault")
    init_parser.add_argument(
        "--backend",
        choices=["sqlite-fts5", "sqlite-vec", "chroma", "lancedb", "qdrant", "none"],
        default="sqlite-fts5",
    )
    init_parser.set_defaults(func=init_memory)

    configure_parser = sub.add_parser("configure", help="Update repo or session memory config.")
    configure_parser.add_argument("--root", default=".")
    configure_parser.add_argument("--session", action="store_true")
    configure_parser.add_argument("--vault")
    configure_parser.add_argument("--backend", choices=["sqlite-fts5", "sqlite-vec", "chroma", "lancedb", "qdrant", "none"])
    configure_parser.add_argument("--update-policy", choices=["strict", "meaningful", "off"])
    configure_parser.set_defaults(func=configure)

    index_parser = sub.add_parser("index", help="Build SQLite FTS index.")
    index_parser.add_argument("--root", default=".")
    index_parser.add_argument("--verify-query", default="")
    index_parser.set_defaults(func=index_sources)

    search_parser = sub.add_parser("search", help="Search local memory index.")
    search_parser.add_argument("query")
    search_parser.add_argument("--root", default=".")
    search_parser.add_argument("--limit", type=int, default=5)
    search_parser.set_defaults(func=search)

    append_parser = sub.add_parser("append", help="Append a timestamped section to a vault note.")
    append_parser.add_argument("--root", default=".")
    append_parser.add_argument("--note", required=True)
    append_parser.add_argument("--title", required=True)
    append_parser.add_argument("--body", default="")
    append_parser.set_defaults(func=append_note)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
