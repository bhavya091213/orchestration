#!/usr/bin/env python3
"""Local markdown/Obsidian knowledge discovery, indexing, and retrieval."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sqlite3
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


KNOWLEDGE_DIRS = {
    "vault",
    "knowledge",
    "docs",
    "wiki",
    "notes",
    "handbook",
    "playbooks",
}

SKIP_DIRS = {
    ".git",
    ".hg",
    ".svn",
    ".obsidian",
    ".codex",
    ".claude",
    ".idea",
    ".vscode",
    "node_modules",
    "vendor",
    "dist",
    "build",
    "out",
    "coverage",
    ".next",
    ".turbo",
    ".venv",
    "venv",
    "__pycache__",
}

TEXT_EXTS = {".md", ".markdown", ".mdx", ".base", ".canvas", ".txt", ".rst"}
MARKDOWN_EXTS = {".md", ".markdown", ".mdx"}
MAX_FILE_BYTES = 2_000_000
DEFAULT_LIMIT = 8
DEFAULT_MAX_CHARS = 12_000

WIKILINK_RE = re.compile(r"!\[\[([^\]]+)\]\]|\[\[([^\]]+)\]\]")
TAG_RE = re.compile(r"(?<![\w/])#(?!\d)([A-Za-z][A-Za-z0-9_/-]*)")
HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*$")
WORD_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]{1,}")


@dataclass(frozen=True)
class Source:
    path: Path
    kind: str


@dataclass
class ParsedFile:
    path: Path
    rel_path: str
    title: str
    aliases: list[str]
    tags: list[str]
    links: list[str]
    chunks: list[dict]


def eprint(message: str) -> None:
    print(message, file=sys.stderr)


def repo_root(start: Path) -> Path:
    current = start.resolve()
    if current.is_file():
        current = current.parent
    for candidate in (current, *current.parents):
        if (candidate / ".git").exists():
            return candidate
    return current


def cache_db_path(root: Path) -> Path:
    digest = hashlib.sha256(str(root.resolve()).encode("utf-8")).hexdigest()[:24]
    cache_dir = Path.home() / ".codex" / "cache" / "knowledge"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir / f"{digest}.sqlite"


def is_skipped(path: Path, root: Path) -> bool:
    try:
        rel_parts = path.relative_to(root).parts
    except ValueError:
        rel_parts = path.parts
    return any(part in SKIP_DIRS for part in rel_parts)


def discover_sources(root: Path) -> list[Source]:
    found: dict[Path, Source] = {}

    if (root / ".obsidian").is_dir():
        found[root] = Source(root, "obsidian-vault")

    home_root = root.resolve() == Path.home().resolve()
    if home_root:
        # The global AGENTS.md lives in the home directory. Avoid treating the
        # whole home tree as one repository when the helper is run from there.
        for child in root.iterdir():
            if child.is_dir() and child.name in KNOWLEDGE_DIRS:
                found.setdefault(child, Source(child, child.name))
            if child.is_dir() and (child / ".obsidian").is_dir():
                found.setdefault(child, Source(child, "obsidian-vault"))
    else:
        max_depth = 5
        for current, dirs, _files in os.walk(root):
            current_path = Path(current)
            if is_skipped(current_path, root):
                dirs[:] = []
                continue
            depth = len(current_path.relative_to(root).parts)
            if depth >= max_depth:
                dirs[:] = []
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

            if ".obsidian" in dirs:
                found[current_path] = Source(current_path, "obsidian-vault")

            if current_path.name in KNOWLEDGE_DIRS:
                found.setdefault(current_path, Source(current_path, current_path.name))

    for name in KNOWLEDGE_DIRS:
        path = root / name
        if path.is_dir():
            found.setdefault(path, Source(path, name))

    # Always include root-level markdown/project documentation. This catches
    # README, AGENTS, design docs, and repos that are lightweight markdown KBs.
    found.setdefault(root, Source(root, "project-markdown"))

    return sorted(found.values(), key=lambda source: (str(source.path) != str(root), str(source.path)))


def iter_source_files(root: Path, sources: list[Source]) -> list[Path]:
    files: dict[Path, None] = {}
    for source in sources:
        if not source.path.exists():
            continue
        if source.kind == "project-markdown" and source.path.resolve() == Path.home().resolve():
            for path in source.path.iterdir():
                if path.is_file() and path.suffix.lower() in TEXT_EXTS:
                    files[path.resolve()] = None
            continue
        for current, dirs, names in os.walk(source.path):
            current_path = Path(current)
            if is_skipped(current_path, root):
                dirs[:] = []
                continue
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
            for name in names:
                path = current_path / name
                if path.suffix.lower() not in TEXT_EXTS:
                    continue
                if is_skipped(path, root):
                    continue
                try:
                    if path.stat().st_size > MAX_FILE_BYTES:
                        continue
                except OSError:
                    continue
                files[path.resolve()] = None
    return sorted(files)


def read_text(path: Path) -> str:
    data = path.read_bytes()
    for encoding in ("utf-8", "utf-8-sig", "latin-1"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def parse_frontmatter(text: str) -> tuple[dict[str, object], str]:
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---", 4)
    if end == -1:
        return {}, text
    raw = text[4:end]
    body_start = text.find("\n", end + 4)
    body = text[body_start + 1 :] if body_start != -1 else ""
    data: dict[str, object] = {}
    current_key: str | None = None
    for line in raw.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if line.startswith((" ", "\t")) and current_key:
            value = line.strip()
            if value.startswith("- "):
                data.setdefault(current_key, [])
                if isinstance(data[current_key], list):
                    data[current_key].append(value[2:].strip().strip('"\''))
            continue
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip()
        current_key = key
        if value in {"", "[]"}:
            data[key] = [] if value == "[]" else ""
        elif value.startswith("[") and value.endswith("]"):
            data[key] = [item.strip().strip('"\'') for item in value[1:-1].split(",") if item.strip()]
        else:
            data[key] = value.strip('"\'')
    return data, body


def listify(value: object) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        if "," in value:
            return [part.strip().strip('"\'') for part in value.split(",") if part.strip()]
        if value.strip():
            return [value.strip().strip('"\'')]
    return []


def normalize_wikilink(raw: str) -> str:
    target = raw.split("|", 1)[0].split("#", 1)[0].strip()
    return target.removeprefix("!").strip()


def extract_links(text: str) -> list[str]:
    links: list[str] = []
    for match in WIKILINK_RE.finditer(text):
        raw = match.group(1) or match.group(2) or ""
        target = normalize_wikilink(raw)
        if target:
            links.append(target)
    return sorted(set(links), key=str.lower)


def extract_tags(text: str, frontmatter: dict[str, object]) -> list[str]:
    tags = set(TAG_RE.findall(text))
    for key in ("tags", "tag"):
        for tag in listify(frontmatter.get(key)):
            tags.add(tag.lstrip("#"))
    return sorted(tags, key=str.lower)


def clean_heading(line: str) -> str:
    return re.sub(r"\s+#*$", "", line).strip()


def split_long_text(text: str, max_chars: int = 4500) -> list[str]:
    if len(text) <= max_chars:
        return [text.strip()]
    parts: list[str] = []
    current: list[str] = []
    current_len = 0
    for paragraph in re.split(r"(\n\s*\n)", text):
        if current_len + len(paragraph) > max_chars and current:
            parts.append("".join(current).strip())
            current = []
            current_len = 0
        current.append(paragraph)
        current_len += len(paragraph)
    if current:
        parts.append("".join(current).strip())
    return [part for part in parts if part]


def markdown_chunks(text: str) -> list[dict]:
    lines = text.splitlines()
    heading_indices: list[tuple[int, str]] = []
    for index, line in enumerate(lines):
        match = HEADING_RE.match(line)
        if match:
            heading_indices.append((index, clean_heading(match.group(2))))

    chunks: list[dict] = []
    if not heading_indices:
        for ordinal, part in enumerate(split_long_text(text)):
            chunks.append(
                {
                    "heading": "",
                    "text": part,
                    "start_line": 1,
                    "end_line": max(1, len(lines)),
                    "ordinal": ordinal,
                }
            )
        return chunks

    for ordinal, (start, heading) in enumerate(heading_indices):
        end = heading_indices[ordinal + 1][0] if ordinal + 1 < len(heading_indices) else len(lines)
        section = "\n".join(lines[start:end]).strip()
        for part_index, part in enumerate(split_long_text(section)):
            suffix = f" part {part_index + 1}" if part_index else ""
            chunks.append(
                {
                    "heading": f"{heading}{suffix}",
                    "text": part,
                    "start_line": start + 1,
                    "end_line": end,
                    "ordinal": len(chunks),
                }
            )
    return chunks


def parse_file(path: Path, root: Path) -> ParsedFile:
    rel = path.relative_to(root).as_posix()
    text = read_text(path)
    frontmatter, body = parse_frontmatter(text) if path.suffix.lower() in MARKDOWN_EXTS else ({}, text)
    title = str(frontmatter.get("title") or path.stem).strip()
    aliases = listify(frontmatter.get("aliases")) + listify(frontmatter.get("alias"))
    tags = extract_tags(text, frontmatter)
    links = extract_links(text)
    chunks = markdown_chunks(body if path.suffix.lower() in MARKDOWN_EXTS else text)
    if not chunks:
        chunks = [{"heading": "", "text": text[:4500], "start_line": 1, "end_line": 1, "ordinal": 0}]
    return ParsedFile(path=path, rel_path=rel, title=title, aliases=aliases, tags=tags, links=links, chunks=chunks)


def connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS files (
            path TEXT PRIMARY KEY,
            mtime_ns INTEGER NOT NULL,
            size INTEGER NOT NULL,
            title TEXT NOT NULL,
            aliases TEXT NOT NULL,
            tags TEXT NOT NULL,
            links TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS chunks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT NOT NULL,
            title TEXT NOT NULL,
            heading TEXT NOT NULL,
            ordinal INTEGER NOT NULL,
            start_line INTEGER NOT NULL,
            end_line INTEGER NOT NULL,
            text TEXT NOT NULL,
            token_est INTEGER NOT NULL
        );
        CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
            path,
            title,
            heading,
            tags,
            aliases,
            text,
            content='chunks',
            content_rowid='id'
        );
        CREATE INDEX IF NOT EXISTS idx_chunks_path ON chunks(path);
        """
    )


def delete_file(conn: sqlite3.Connection, rel_path: str) -> None:
    ids = [row["id"] for row in conn.execute("SELECT id FROM chunks WHERE path = ?", (rel_path,))]
    for chunk_id in ids:
        conn.execute("DELETE FROM chunks_fts WHERE rowid = ?", (chunk_id,))
    conn.execute("DELETE FROM chunks WHERE path = ?", (rel_path,))
    conn.execute("DELETE FROM files WHERE path = ?", (rel_path,))


def index_repository(root: Path, quiet: bool = False) -> dict[str, object]:
    sources = discover_sources(root)
    files = iter_source_files(root, sources)
    db_path = cache_db_path(root)
    conn = connect(db_path)
    init_db(conn)
    indexed = 0
    skipped = 0
    deleted = 0

    current_rel_paths = {path.relative_to(root).as_posix() for path in files}
    existing_paths = {row["path"] for row in conn.execute("SELECT path FROM files")}
    for rel_path in existing_paths - current_rel_paths:
        delete_file(conn, rel_path)
        deleted += 1

    for path in files:
        rel_path = path.relative_to(root).as_posix()
        try:
            stat = path.stat()
        except OSError:
            continue
        existing = conn.execute("SELECT mtime_ns, size FROM files WHERE path = ?", (rel_path,)).fetchone()
        if existing and existing["mtime_ns"] == stat.st_mtime_ns and existing["size"] == stat.st_size:
            skipped += 1
            continue

        parsed = parse_file(path, root)
        delete_file(conn, rel_path)
        conn.execute(
            "INSERT INTO files(path, mtime_ns, size, title, aliases, tags, links) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                rel_path,
                stat.st_mtime_ns,
                stat.st_size,
                parsed.title,
                json.dumps(parsed.aliases),
                json.dumps(parsed.tags),
                json.dumps(parsed.links),
            ),
        )
        for chunk in parsed.chunks:
            token_est = max(1, len(chunk["text"]) // 4)
            cursor = conn.execute(
                """
                INSERT INTO chunks(path, title, heading, ordinal, start_line, end_line, text, token_est)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    rel_path,
                    parsed.title,
                    chunk["heading"],
                    chunk["ordinal"],
                    chunk["start_line"],
                    chunk["end_line"],
                    chunk["text"],
                    token_est,
                ),
            )
            chunk_id = cursor.lastrowid
            conn.execute(
                """
                INSERT INTO chunks_fts(rowid, path, title, heading, tags, aliases, text)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    chunk_id,
                    rel_path,
                    parsed.title,
                    chunk["heading"],
                    " ".join(parsed.tags),
                    " ".join(parsed.aliases),
                    chunk["text"],
                ),
            )
        indexed += 1

    conn.execute("INSERT OR REPLACE INTO meta(key, value) VALUES ('root', ?)", (str(root),))
    conn.execute("INSERT OR REPLACE INTO meta(key, value) VALUES ('updated_at', ?)", (str(int(time.time())),))
    conn.commit()
    total_chunks = conn.execute("SELECT COUNT(*) AS n FROM chunks").fetchone()["n"]
    conn.close()
    stats = {
        "root": str(root),
        "db": str(db_path),
        "sources": [{"path": str(source.path), "kind": source.kind} for source in sources],
        "files": len(files),
        "indexed": indexed,
        "skipped": skipped,
        "deleted": deleted,
        "chunks": total_chunks,
    }
    if not quiet:
        print(json.dumps(stats, indent=2))
    return stats


def query_terms(query: str) -> list[str]:
    stop = {
        "the",
        "and",
        "for",
        "with",
        "from",
        "this",
        "that",
        "into",
        "about",
        "using",
        "use",
        "when",
        "what",
        "how",
        "why",
        "are",
        "was",
        "were",
        "will",
    }
    terms = []
    for word in WORD_RE.findall(query.lower()):
        if len(word) < 2 or word in stop:
            continue
        terms.append(word)
    return list(dict.fromkeys(terms))


def fts_query(terms: list[str]) -> str:
    safe_terms = [re.sub(r"[^A-Za-z0-9_]", "", term) for term in terms]
    safe_terms = [term for term in safe_terms if term]
    if not safe_terms:
        return ""
    return " OR ".join(f'"{term}"' for term in safe_terms[:16])


def load_files(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return list(conn.execute("SELECT path, title, aliases, tags, links, mtime_ns FROM files"))


def score_row(row: sqlite3.Row, terms: list[str], file_meta: dict[str, sqlite3.Row]) -> float:
    meta = file_meta.get(row["path"])
    haystack = " ".join(
        [
            row["path"],
            row["title"],
            row["heading"],
            row["text"][:1000],
            meta["tags"] if meta else "",
            meta["aliases"] if meta else "",
        ]
    ).lower()
    overlap = sum(1 for term in terms if term in haystack)
    path_boost = 0.5 if any(part in row["path"].lower().split("/") for part in KNOWLEDGE_DIRS) else 0.0
    heading_boost = 1.0 if any(term in row["heading"].lower() for term in terms) else 0.0
    title_boost = 0.8 if any(term in row["title"].lower() for term in terms) else 0.0
    bm25 = float(row["rank"])
    return (-bm25) + overlap + path_boost + heading_boost + title_boost


def resolve_link(target: str, file_rows: Iterable[sqlite3.Row]) -> str | None:
    needle = target.lower().removesuffix(".md")
    for row in file_rows:
        path = row["path"]
        title = row["title"]
        aliases = json.loads(row["aliases"] or "[]")
        names = {
            Path(path).stem.lower(),
            path.lower().removesuffix(".md"),
            title.lower(),
        }
        names.update(alias.lower() for alias in aliases)
        if needle in names:
            return path
    return None


def graph_neighbors(seed_paths: list[str], file_rows: list[sqlite3.Row]) -> list[str]:
    rows_by_path = {row["path"]: row for row in file_rows}
    neighbors: list[str] = []
    for seed in seed_paths:
        row = rows_by_path.get(seed)
        if not row:
            continue
        for link in json.loads(row["links"] or "[]"):
            resolved = resolve_link(link, file_rows)
            if resolved and resolved not in seed_paths and resolved not in neighbors:
                neighbors.append(resolved)
        seed_stem = Path(seed).stem.lower()
        seed_title = row["title"].lower()
        for candidate in file_rows:
            if candidate["path"] == seed:
                continue
            links = [link.lower().removesuffix(".md") for link in json.loads(candidate["links"] or "[]")]
            if seed_stem in links or seed_title in links:
                if candidate["path"] not in seed_paths and candidate["path"] not in neighbors:
                    neighbors.append(candidate["path"])
    return neighbors


def search(root: Path, query: str, limit: int, max_chars: int) -> dict[str, object]:
    stats = index_repository(root, quiet=True)
    terms = query_terms(query)
    db_path = cache_db_path(root)
    conn = connect(db_path)
    init_db(conn)
    file_rows = load_files(conn)
    file_meta = {row["path"]: row for row in file_rows}
    candidates: list[dict] = []

    match = fts_query(terms)
    if match:
        rows = list(
            conn.execute(
                """
                SELECT c.*, bm25(chunks_fts) AS rank
                FROM chunks_fts
                JOIN chunks c ON c.id = chunks_fts.rowid
                WHERE chunks_fts MATCH ?
                ORDER BY bm25(chunks_fts)
                LIMIT ?
                """,
                (match, max(limit * 6, 30)),
            )
        )
    else:
        rows = list(
            conn.execute(
                """
                SELECT c.*, 0.0 AS rank
                FROM chunks c
                ORDER BY c.id DESC
                LIMIT ?
                """,
                (max(limit * 6, 30),),
            )
        )

    for row in rows:
        candidates.append(
            {
                "path": row["path"],
                "title": row["title"],
                "heading": row["heading"],
                "start_line": row["start_line"],
                "end_line": row["end_line"],
                "text": row["text"],
                "score": score_row(row, terms, file_meta),
                "reason": "fts-match",
            }
        )

    candidates.sort(key=lambda item: item["score"], reverse=True)
    selected = candidates[:limit]

    neighbor_paths = graph_neighbors([item["path"] for item in selected[: max(1, limit // 2)]], file_rows)
    for path in neighbor_paths:
        if len(selected) >= limit + 2:
            break
        if any(item["path"] == path for item in selected):
            continue
        row = conn.execute(
            """
            SELECT c.*, 0.0 AS rank
            FROM chunks c
            WHERE c.path = ?
            ORDER BY c.ordinal
            LIMIT 1
            """,
            (path,),
        ).fetchone()
        if not row:
            continue
        selected.append(
            {
                "path": row["path"],
                "title": row["title"],
                "heading": row["heading"],
                "start_line": row["start_line"],
                "end_line": row["end_line"],
                "text": row["text"],
                "score": 0.35,
                "reason": "graph-neighbor",
            }
        )

    bounded: list[dict] = []
    used_chars = 0
    for item in selected:
        remaining = max_chars - used_chars
        if remaining <= 0:
            break
        text = item["text"].strip()
        if len(text) > remaining:
            text = text[: max(0, remaining - 20)].rstrip() + "\n...[truncated]"
        item = dict(item)
        item["text"] = text
        item["chars"] = len(text)
        bounded.append(item)
        used_chars += len(text)

    conn.close()
    return {
        "query": query,
        "terms": terms,
        "root": str(root),
        "db": str(db_path),
        "sources": stats["sources"],
        "index": {key: stats[key] for key in ("files", "indexed", "skipped", "deleted", "chunks")},
        "limit": limit,
        "max_chars": max_chars,
        "used_chars": used_chars,
        "results": bounded,
    }


def print_discovery(root: Path, fmt: str) -> None:
    sources = discover_sources(root)
    files = iter_source_files(root, sources)
    payload = {
        "root": str(root),
        "sources": [{"path": str(source.path), "kind": source.kind} for source in sources],
        "files": len(files),
    }
    if fmt == "json":
        print(json.dumps(payload, indent=2))
        return
    print("# Knowledge Sources")
    print(f"- root: {root}")
    print(f"- files: {len(files)}")
    for source in sources:
        print(f"- {source.kind}: {source.path}")


def print_search(result: dict[str, object], fmt: str) -> None:
    if fmt == "json":
        print(json.dumps(result, indent=2))
        return
    print("# Knowledge Retrieval")
    print(f"- root: {result['root']}")
    print(f"- query: {result['query']}")
    print(f"- budget: {result['used_chars']}/{result['max_chars']} chars")
    index = result["index"]
    print(
        f"- index: {index['files']} files, {index['chunks']} chunks, "
        f"{index['indexed']} updated, {index['skipped']} unchanged"
    )
    print()
    for index, item in enumerate(result["results"], start=1):
        heading = f"#{item['heading']}" if item["heading"] else ""
        location = f"{item['path']}{heading}"
        print(f"## {index}. {location}")
        print(f"- score: {item['score']:.2f}")
        print(f"- reason: {item['reason']}")
        print(f"- lines: {item['start_line']}-{item['end_line']}")
        print()
        print(item["text"])
        print()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Index and search local repo knowledge sources.")
    parser.add_argument("--root", default=".", help="Repository root or child path. Defaults to current directory.")
    subparsers = parser.add_subparsers(dest="command")

    discover_parser = subparsers.add_parser("discover", help="List detected knowledge sources.")
    discover_parser.add_argument("--format", choices=("markdown", "json"), default="json")

    index_parser = subparsers.add_parser("index", help="Build or update the local knowledge index.")
    index_parser.add_argument("--format", choices=("json",), default="json")

    search_parser = subparsers.add_parser("search", help="Search local knowledge sources.")
    search_parser.add_argument("query", nargs="+", help="Search query or task description.")
    search_parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT)
    search_parser.add_argument("--max-chars", type=int, default=DEFAULT_MAX_CHARS)
    search_parser.add_argument("--format", choices=("markdown", "json"), default="markdown")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    root = repo_root(Path(args.root))

    if args.command == "discover":
        print_discovery(root, args.format)
        return 0
    if args.command == "index":
        index_repository(root, quiet=False)
        return 0
    if args.command == "search":
        query = " ".join(args.query)
        result = search(root, query, max(1, args.limit), max(1000, args.max_chars))
        print_search(result, args.format)
        return 0

    parser.print_help()
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
