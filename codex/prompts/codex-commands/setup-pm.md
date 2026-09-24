---
description: Configure your preferred package manager (npm/pnpm/yarn/bun)
---

# Package Manager Setup

Configure your preferred package manager for this project or globally.

## Usage

```bash
# Detect current package manager
~/.codex/scripts/codex-setup-package-manager --detect

# Set global preference
~/.codex/scripts/codex-setup-package-manager --global pnpm

# Set project preference
~/.codex/scripts/codex-setup-package-manager --project bun

# List available package managers
~/.codex/scripts/codex-setup-package-manager --list
```

## Detection Priority

When determining which package manager to use, the following order is checked:

1. **Environment variable**: `CODEX_PACKAGE_MANAGER`
2. **Project config**: `.codex/package-manager.json`
3. **package.json**: `packageManager` field
4. **Lock file**: Presence of package-lock.json, yarn.lock, pnpm-lock.yaml, or bun.lockb
5. **Global config**: `~/.codex/package-manager.json`
6. **Fallback**: First available package manager (pnpm > bun > yarn > npm)

## Configuration Files

### Global Configuration
```json
// ~/.codex/package-manager.json
{
  "packageManager": "pnpm"
}
```

### Project Configuration
```json
// .codex/package-manager.json
{
  "packageManager": "bun"
}
```

### package.json
```json
{
  "packageManager": "pnpm@8.6.0"
}
```

## Environment Variable

Set `CODEX_PACKAGE_MANAGER` to override all other detection methods:

```bash
# Windows (PowerShell)
$env:CODEX_PACKAGE_MANAGER = "pnpm"

# macOS/Linux
export CODEX_PACKAGE_MANAGER=pnpm
```

## Run the Detection

To see current package manager detection results, run:

```bash
~/.codex/scripts/codex-setup-package-manager --detect
```
