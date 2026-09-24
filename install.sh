#!/usr/bin/env bash
#
# install.sh - install this repo's agent configuration into $HOME.
#
#   shared/      -> ~/.agents    (RULES.md, mcp-servers.json, bin/sync-agents, skills/)
#   claude-code/ -> ~/.claude    (CLAUDE.md, agents/, commands/, rules/, hooks/, scripts/, skills/)
#   codex/       -> ~/.codex     (AGENTS.md, agents/, scripts/, prompts/, workflows/, hooks.json, skills/)
#
# ~/.agents/skills is the single source of truth for shared skills; each one is
# symlinked into ~/.claude/skills/<name> and ~/.codex/skills/<name>.
#
# This script NEVER deletes anything. Anything it would overwrite is moved into
# ~/.agents/backups/orchestration-install-<timestamp>/ first.
#
# Requires: bash, coreutils, python3.

set -euo pipefail

REPO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

DO_SHARED=0
DO_CLAUDE=0
DO_CODEX=0
DRY_RUN=0
FORCE=0

AGENTS_HOME="$HOME/.agents"
CLAUDE_HOME="$HOME/.claude"
CODEX_HOME="$HOME/.codex"
BACKUP_ROOT="$AGENTS_HOME/backups/orchestration-install-$(date +%Y%m%d-%H%M%S)"

n_shared=0
n_claude=0
n_codex=0
n_links=0
n_backups=0
n_skipped=0
n_warnings=0
TREE_INSTALLED=0

# ---------------------------------------------------------------------------
# output helpers
# ---------------------------------------------------------------------------

say()  { printf '%s\n' "$*"; }
info() { printf '  %s\n' "$*"; }
warn() { printf 'warn: %s\n' "$*" >&2; n_warnings=$((n_warnings + 1)); }
die()  { printf 'error: %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
Usage: ./install.sh [options]

Sections (default: --all):
  --shared      Install shared/  -> ~/.agents
  --claude      Install claude-code/ -> ~/.claude (+ symlink shared skills)
  --codex       Install codex/   -> ~/.codex (+ symlink shared skills)
  --all         All three, in order: shared, claude, codex

Options:
  --dry-run     Print what would happen; change nothing
  --force       Also overwrite ~/.claude/settings.json and ~/.codex/config.toml
                from the bundled examples (backed up first)
  -h, --help    Show this help

Nothing is ever deleted. Files that would be overwritten are moved to
~/.agents/backups/orchestration-install-<timestamp>/ first.
EOF
}

# ---------------------------------------------------------------------------
# filesystem helpers (never use rm)
# ---------------------------------------------------------------------------

# Path inside the backup tree for a destination under $HOME.
backup_dest_for() {
  local dest="$1" rel
  case "$dest" in
    "$HOME"/*) rel="${dest#"$HOME"/}" ;;
    *)         rel="$(printf '%s' "$dest" | sed 's#^/##')" ;;
  esac
  printf '%s/%s' "$BACKUP_ROOT" "$rel"
}

# Move an existing file/dir/symlink out of the way into the backup tree.
stash() {
  local dest="$1" bdest
  bdest="$(backup_dest_for "$dest")"
  n_backups=$((n_backups + 1))
  if [ "$DRY_RUN" -eq 1 ]; then
    info "backup  $dest -> $bdest"
    return 0
  fi
  mkdir -p "$(dirname "$bdest")"
  mv "$dest" "$bdest"
  info "backup  $dest -> $bdest"
}

# install_file <src> <dest>; returns 0 if installed, 1 if skipped as identical.
install_file() {
  local src="$1" dest="$2"
  if [ -e "$dest" ] && [ ! -L "$dest" ] && cmp -s "$src" "$dest"; then
    n_skipped=$((n_skipped + 1))
    return 1
  fi
  if [ -e "$dest" ] || [ -L "$dest" ]; then
    stash "$dest"
  fi
  if [ "$DRY_RUN" -eq 1 ]; then
    info "install $dest"
    return 0
  fi
  mkdir -p "$(dirname "$dest")"
  cp -p "$src" "$dest"
  info "install $dest"
}

# install_tree <src_dir> <dest_dir>
# Copies every regular file under src_dir, preserving mode bits and layout.
# Sets TREE_INSTALLED to the number of files written (bash 3.2 has no namerefs).
install_tree() {
  local src="$1" dest="$2" rel target file dir
  TREE_INSTALLED=0
  [ -d "$src" ] || { warn "missing source directory: $src"; return 0; }
  while IFS= read -r -d '' file; do
    rel="${file#"$src"/}"
    target="$dest/$rel"
    if install_file "$file" "$target"; then
      TREE_INSTALLED=$((TREE_INSTALLED + 1))
    fi
  done < <(find "$src" -type f ! -name '.DS_Store' -print0)
  # Recreate any empty directories the file walk missed.
  while IFS= read -r -d '' dir; do
    rel="${dir#"$src"/}"
    [ "$rel" = "$dir" ] && continue
    target="$dest/$rel"
    if [ ! -d "$target" ]; then
      if [ "$DRY_RUN" -eq 1 ]; then
        info "mkdir   $target"
      else
        mkdir -p "$target"
      fi
    fi
  done < <(find "$src" -type d -empty -print0)
}

# install_example <src> <dest> <label>
# Installs only when dest is absent, unless --force.
install_example() {
  local src="$1" dest="$2" label="$3"
  if [ -e "$dest" ] && [ "$FORCE" -eq 0 ]; then
    info "keep    $dest (already exists)"
    info "        compare with: diff \"$dest\" \"$src\""
    n_skipped=$((n_skipped + 1))
    return 0
  fi
  install_file "$src" "$dest" || true
  info "        installed $label from example - review it before first use"
}

resolve() {
  python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$1"
}

relpath() {
  python3 -c 'import os,sys; print(os.path.relpath(sys.argv[1], sys.argv[2]))' "$1" "$2"
}

# link_shared_skills <target_skills_dir>
# Links each ~/.agents/skills/<name> into <target_skills_dir>/<name> using a
# relative target, matching the layout sync-agents already expects.
link_shared_skills() {
  local skills_dir="$1" src name dest current rel_prefix skills_real
  if [ ! -d "$AGENTS_HOME/skills" ]; then
    warn "no $AGENTS_HOME/skills - run with --shared first; skipping symlinks"
    return 0
  fi
  if [ "$DRY_RUN" -eq 0 ]; then
    mkdir -p "$skills_dir"
  fi
  rel_prefix="$(relpath "$AGENTS_HOME/skills" "$skills_dir")"
  skills_real="$(resolve "$AGENTS_HOME/skills")"
  while IFS= read -r -d '' src; do
    name="$(basename "$src")"
    dest="$skills_dir/$name"
    if [ -L "$dest" ]; then
      current="$(readlink "$dest")"
      # Already correct, whether stored relative or absolute.
      if [ "$current" = "$rel_prefix/$name" ] || [ "$current" = "$src" ] ||
         [ "$(resolve "$dest")" = "$skills_real/$name" ]; then
        n_skipped=$((n_skipped + 1))
        continue
      fi
      stash "$dest"
    elif [ -e "$dest" ]; then
      warn "$dest is a real directory (platform-specific skill) - not linking shared '$name'"
      continue
    fi
    if [ "$DRY_RUN" -eq 0 ]; then
      ln -s "$rel_prefix/$name" "$dest"
    fi
    info "link    $dest -> $rel_prefix/$name"
    n_links=$((n_links + 1))
  done < <(find "$AGENTS_HOME/skills" -mindepth 1 -maxdepth 1 -type d -print0)
}

# ---------------------------------------------------------------------------
# sections
# ---------------------------------------------------------------------------

install_shared() {
  say ""
  say "==> shared -> $AGENTS_HOME"
  install_file "$REPO_DIR/shared/RULES.md"         "$AGENTS_HOME/RULES.md"         && n_shared=$((n_shared + 1))
  install_file "$REPO_DIR/shared/mcp-servers.json" "$AGENTS_HOME/mcp-servers.json" && n_shared=$((n_shared + 1))
  install_file "$REPO_DIR/shared/skill-lock.json"  "$AGENTS_HOME/.skill-lock.json" && n_shared=$((n_shared + 1))
  if install_file "$REPO_DIR/shared/bin/sync-agents" "$AGENTS_HOME/bin/sync-agents"; then
    n_shared=$((n_shared + 1))
  fi
  if [ "$DRY_RUN" -eq 0 ] && [ -f "$AGENTS_HOME/bin/sync-agents" ]; then
    chmod +x "$AGENTS_HOME/bin/sync-agents"
  fi
  install_tree "$REPO_DIR/shared/skills" "$AGENTS_HOME/skills"
  n_shared=$((n_shared + TREE_INSTALLED))
}

install_claude() {
  say ""
  say "==> claude-code -> $CLAUDE_HOME"
  install_file "$REPO_DIR/claude-code/CLAUDE.md" "$CLAUDE_HOME/CLAUDE.md" && n_claude=$((n_claude + 1))
  local sub
  for sub in agents commands rules hooks scripts skills; do
    install_tree "$REPO_DIR/claude-code/$sub" "$CLAUDE_HOME/$sub"
    n_claude=$((n_claude + TREE_INSTALLED))
  done
  install_example "$REPO_DIR/claude-code/settings.example.json" \
                  "$CLAUDE_HOME/settings.json" "settings.json"
  say "    linking shared skills into $CLAUDE_HOME/skills"
  link_shared_skills "$CLAUDE_HOME/skills"
}

install_codex() {
  say ""
  say "==> codex -> $CODEX_HOME"
  install_file "$REPO_DIR/codex/AGENTS.md"  "$CODEX_HOME/AGENTS.md"  && n_codex=$((n_codex + 1))
  install_file "$REPO_DIR/codex/hooks.json" "$CODEX_HOME/hooks.json" && n_codex=$((n_codex + 1))
  local sub
  for sub in agents scripts prompts workflows skills; do
    install_tree "$REPO_DIR/codex/$sub" "$CODEX_HOME/$sub"
    n_codex=$((n_codex + TREE_INSTALLED))
  done
  install_example "$REPO_DIR/codex/config.example.toml" \
                  "$CODEX_HOME/config.toml" "config.toml"
  say "    linking shared skills into $CODEX_HOME/skills"
  link_shared_skills "$CODEX_HOME/skills"

  if [ -x "$AGENTS_HOME/bin/sync-agents" ]; then
    if [ "$DRY_RUN" -eq 1 ]; then
      info "would run $AGENTS_HOME/bin/sync-agents rules"
    else
      say "    syncing shared rules into $CODEX_HOME/AGENTS.md"
      "$AGENTS_HOME/bin/sync-agents" rules || echo "warn: sync-agents rules failed"
    fi
  else
    warn "$AGENTS_HOME/bin/sync-agents not found or not executable - skipping rules sync"
  fi
}

summary() {
  local total=$((n_shared + n_claude + n_codex))
  say ""
  say "-------------------------------------------"
  printf '%-22s %s\n' "Section" "Files installed"
  say "-------------------------------------------"
  [ "$DO_SHARED" -eq 1 ] && printf '%-22s %d\n' "shared  (~/.agents)" "$n_shared"
  [ "$DO_CLAUDE" -eq 1 ] && printf '%-22s %d\n' "claude  (~/.claude)" "$n_claude"
  [ "$DO_CODEX"  -eq 1 ] && printf '%-22s %d\n' "codex   (~/.codex)"  "$n_codex"
  say "-------------------------------------------"
  printf '%-22s %d\n' "total files"      "$total"
  printf '%-22s %d\n' "skill symlinks"   "$n_links"
  printf '%-22s %d\n' "unchanged/kept"   "$n_skipped"
  printf '%-22s %d\n' "backed up"        "$n_backups"
  printf '%-22s %d\n' "warnings"         "$n_warnings"
  say "-------------------------------------------"
  if [ "$n_backups" -gt 0 ]; then
    say "Replaced items were moved to: $BACKUP_ROOT"
  fi
  if [ "$DRY_RUN" -eq 1 ]; then
    say "DRY RUN - nothing was changed."
  fi
}

# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

while [ $# -gt 0 ]; do
  case "$1" in
    --shared)  DO_SHARED=1 ;;
    --claude)  DO_CLAUDE=1 ;;
    --codex)   DO_CODEX=1 ;;
    --all)     DO_SHARED=1; DO_CLAUDE=1; DO_CODEX=1 ;;
    --dry-run) DRY_RUN=1 ;;
    --force)   FORCE=1 ;;
    -h|--help) usage; exit 0 ;;
    *)         usage >&2; die "unknown option: $1" ;;
  esac
  shift
done

if [ "$DO_SHARED" -eq 0 ] && [ "$DO_CLAUDE" -eq 0 ] && [ "$DO_CODEX" -eq 0 ]; then
  DO_SHARED=1; DO_CLAUDE=1; DO_CODEX=1
fi

command -v python3 >/dev/null 2>&1 || die "python3 is required"
[ -d "$REPO_DIR/shared" ] || die "run this script from inside the orchestration repo"

say "orchestration installer"
say "  repo:   $REPO_DIR"
say "  home:   $HOME"
[ "$DRY_RUN" -eq 1 ] && say "  mode:   DRY RUN (no changes)"
[ "$FORCE"   -eq 1 ] && say "  mode:   FORCE (settings.json / config.toml will be replaced)"

[ "$DO_SHARED" -eq 1 ] && install_shared
[ "$DO_CLAUDE" -eq 1 ] && install_claude
[ "$DO_CODEX"  -eq 1 ] && install_codex

summary
