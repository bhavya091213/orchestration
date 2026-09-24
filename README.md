# orchestration

One configuration, two CLIs. This repo packages a working Claude Code + Codex CLI setup built
around a single idea: the lead session is an **orchestrator, not a worker**. It investigates,
gates on your approval, then hands bounded units of work to subagents with an explicit model /
reasoning-effort tier and a hard **100k-token context budget** each. Nothing is ever deleted
(retired files are moved to a backup directory, never `rm`ed), and the rules, skills and MCP
server list live in **one shared source of truth** (`shared/`, mirroring `~/.agents`) that both
tools read, so Claude Code and Codex never drift apart.

## What's inside

```
shared/                     mirrors ~/.agents - single source of truth
  RULES.md                  shared operating rules (sections A-E)
  mcp-servers.json          MCP servers, with per-tool targets
  skill-lock.json           pinned upstream skill provenance
  bin/sync-agents           renders rules + MCP config into both tools
  skills/                   62 shared skills (symlinked into BOTH CLIs)
claude-code/                mirrors ~/.claude
  CLAUDE.md                 imports shared rules via @~/.agents/RULES.md
  settings.example.json     permissions, env, hooks, model, plugins
  agents/                   32 subagent definitions
  commands/                 57 slash commands
  rules/                    common/ + cpp, golang, kotlin, perl, php, python, swift, typescript
  hooks/hooks.json          PreToolUse / PostToolUse / Stop / SessionStart wiring
  scripts/hooks/            25 hook implementations
  scripts/codex-review-pipeline/   Codex-first adversarial review runner
  skills/                   14 Claude variants of platform-specific skills + learned/
codex/                      mirrors ~/.codex
  AGENTS.md                 carries a synced copy of RULES.md between markers
  config.example.toml       model, sandbox, MCP servers, profiles, [agents.*]
  hooks.json                Codex hook wiring
  agents/                   11 native multi-agent role definitions (*.toml)
  scripts/                  codex-* CLI wrappers, ecc/ toolkit, codex-companion-runtime
  prompts/                  prompt recipes (codex-commands, codex-agents, codex-rules, ...)
  skills/                   14 Codex variants of platform-specific skills
  workflows/                Claude-to-Codex equivalence map
docs/                       long-form guides
install.sh                  symlink/copy installer with backups
```

## Quick start

```bash
git clone https://github.com/bhavya091213/orchestration.git
cd orchestration

./install.sh --dry-run      # show exactly what would change, touch nothing
./install.sh --all          # install shared + Claude Code + Codex (default)
```

Restart both CLIs afterwards so they re-read their config.

| Flag | Effect |
| --- | --- |
| `--all` | Everything (default) |
| `--claude` | Only `~/.claude` |
| `--codex` | Only `~/.codex` |
| `--shared` | Only `~/.agents` (rules, skills, MCP servers) |
| `--dry-run` | Print the plan, change nothing |
| `--force` | Overwrite existing files (previous copies go to `~/.agents/backups/`) |
| `-h` | Help |

The installer never deletes: anything it replaces is first moved into a timestamped folder under
`~/.agents/backups/`.

**Want just one piece?** Grab a single skill, agent or command without installing anything else:

```bash
npx degit bhavya091213/orchestration/shared/skills/<skill> ~/.agents/skills/<skill>
npx degit bhavya091213/orchestration/claude-code/agents ~/.claude/agents
```

## The orchestration workflow

`/orchestrate` runs a phased, gated pipeline instead of a single long-running session:

| Phase | What happens |
| --- | --- |
| 0. Model & reasoning check | Confirm the orchestrator is on the highest-capability model with extended thinking on |
| 1. Investigate & grill | Parallel read-only investigators (code / research / risk), then the user is interrogated until requirements are unambiguous. **Gate A: plan approval** |
| 2. Implement | Each approved unit goes to one `unit-implementer` with a bounded file scope; independent units run in parallel |
| 3. Adversarial review | Codex-first: gpt-5.5 hunts bugs, gpt-5.6-sol adjudicates, findings are triaged and each fix is individually approved. **Gate C** |
| 4. Handback | Compact summary, run log, no silent rollover |

Run state lives in `.orchestrate/<slug>/` in the project so a compaction event cannot lose the run.
Full detail: [docs/orchestration-workflow.md](docs/orchestration-workflow.md).

## Model routing

Every subagent spawn declares its tier explicitly.

| Tier | Claude Code | Codex CLI | Use for |
| --- | --- | --- | --- |
| Heavy | Opus | `model_reasoning_effort = "xhigh"` | Planning, architecture, root-cause debugging, reviews |
| Light | Sonnet | `low` / `medium` | Mechanical edits, formatting, running commands |
| Trivial | Haiku (optional) | `low` | High-frequency, low-stakes tasks |

Full detail: [docs/model-routing.md](docs/model-routing.md).

## Shared rules

`shared/RULES.md` is the contract both CLIs load. Five sections:

- **A. Session pre-flight** - check Docker, Node version, env files and installed dependencies, and report a short checklist before writing code.
- **B. Orchestrator pattern** - the interactive session delegates; independent subagents are spawned in parallel in one message; the orchestrator keeps conclusions, not raw file dumps.
- **C. Model / effort routing** - every spawn names its tier (heavy vs light) and the tool-specific model or reasoning effort that maps to it.
- **D. Context budget** - no subagent may exceed 100k tokens; if it cannot finish it STOPs and reports work done, work remaining and tokens needed rather than degrading.
- **E. Never delete** - no `rm`, ever. Retire things by moving them to `~/.agents/backups/retired-<what>/` and say so in the report.

## Skills

76 skills total: **62 shared** (symlinked into both `~/.claude/skills` and `~/.codex/skills`) and
**14 platform-specific**, which ship as a matched pair of Claude and Codex variants because their
bodies reference tool-specific mechanics (hooks, session files, memory snapshots).

### Orchestration, context & harness

| Skill | Scope | What it does |
| --- | --- | --- |
| dmux-workflows | shared | Multi-agent orchestration with dmux (tmux pane manager) across Codex, OpenCode, Gemini |
| token-efficient-orchestration | shared | Coordinating Codex subagents, Trello tickets, Obsidian memory and CI verification cheaply |
| find-skills | shared | Discover and install agent skills when the user asks "is there a skill for X" |
| iterative-retrieval | claude + codex | Progressively refine context retrieval to solve the subagent context problem |
| strategic-compact | claude + codex | Compact at logical phase boundaries instead of arbitrary auto-compaction |
| continuous-learning | claude + codex | Extract reusable patterns from sessions and save them as learned skills |
| continuous-learning-v2 | claude + codex | Instinct-based learning with confidence scoring and project-scoped instincts |
| eval-harness | claude + codex | Formal eval-driven-development framework for sessions |
| verification-loop | claude + codex | Comprehensive end-of-work verification system |
| skill-stocktake | claude + codex | Audit skills and commands for quality (quick scan or full portfolio) |
| configure-ecc | claude + codex | Interactive installer for the ECC skill/rule set |
| project-guidelines-example | claude + codex | Template for a project-specific skill, based on a real app |

### Engineering practice: quality, testing, security

| Skill | Scope | What it does |
| --- | --- | --- |
| coding-standards | shared | Universal standards for TypeScript, JavaScript, React and Node |
| tdd-workflow | shared | Enforces tests-first with 80%+ coverage across unit, integration and E2E |
| security-review | shared | Checklist and patterns for auth, user input, secrets, endpoints and payments |
| api-design | shared | REST resource naming, status codes, pagination, errors, versioning, rate limiting |
| e2e-testing | shared | Playwright patterns, Page Object Model, CI integration, flaky-test strategy |
| endpoint-testing | shared | Backend endpoint testing: auth, validation, DB schema sync, frontend data flow |
| ai-regression-testing | claude + codex | Sandbox-mode API testing and blind-spot checks for AI-written code |
| plankton-code-quality | claude + codex | Write-time formatting, linting and config protection |

### Languages & frameworks

| Skill | Scope | What it does |
| --- | --- | --- |
| python-patterns / python-testing | shared | Pythonic idioms, PEP 8, type hints; pytest, fixtures, mocking, coverage |
| golang-patterns / golang-testing | shared | Idiomatic Go; table-driven tests, subtests, benchmarks, fuzzing |
| rust-patterns / rust-testing | shared | Ownership, error handling, traits, concurrency; async and property-based tests |
| kotlin-patterns / kotlin-testing | shared | Idiomatic Kotlin, coroutines, DSL builders; Kotest, MockK, Kover |
| kotlin-coroutines-flows | shared | Structured concurrency, Flow operators, StateFlow, error handling |
| kotlin-ktor-patterns | shared | Ktor routing DSL, plugins, auth, Koin DI, kotlinx.serialization, WebSockets |
| kotlin-exposed-patterns | shared | Exposed ORM DSL/DAO, transactions, HikariCP, Flyway, repository pattern |
| android-clean-architecture | shared | Clean Architecture module structure and dependency rules for Android/KMP |
| compose-multiplatform-patterns | shared | Compose state management, navigation, theming, platform-specific UI |
| java-coding-standards | shared | Spring Boot naming, immutability, Optional, streams, exceptions, layout |
| springboot-patterns / -tdd / -verification | shared | Layered services and data access; JUnit 5, Mockito, Testcontainers; release gate |
| cpp-coding-standards / cpp-testing | shared | C++ Core Guidelines; GoogleTest/CTest, sanitizers, coverage |
| perl-patterns / perl-testing | shared | Modern Perl 5.36+ idioms; Test2::V0, prove, Devel::Cover |
| django-patterns / -tdd / -verification | shared | DRF APIs, ORM, caching, signals; pytest-django, factory_boy; release checks |
| laravel-patterns / laravel-tdd | shared | Eloquent, service layers, queues, events; PHPUnit and Pest |
| laravel-verification | claude + codex | Env checks, static analysis, coverage, security scan, deploy readiness |
| bun-runtime | shared | Bun as runtime, package manager, bundler and test runner; Bun vs Node |
| nextjs-turbopack | shared | Next.js 16+ incremental bundling, FS caching, Turbopack vs webpack |

### Web, API & data platform

| Skill | Scope | What it does |
| --- | --- | --- |
| frontend-patterns | shared | React/Next.js structure, state management, performance, UI practices |
| backend-patterns | shared | Node/Express/Next API routes, database optimization, server-side practices |
| claude-api | shared | Messages API, streaming, tool use, vision, thinking, batches, prompt caching |
| x-api | shared | X/Twitter posting, threads, timelines, search and analytics |
| neon | shared | Router for Neon's backend primitives: Postgres, Auth, Data API, storage, AI gateway |
| neon-postgres | shared | Lakebase Postgres setup, pooling, branching, migrations, vector and hybrid search |
| mcp-server-patterns | claude + codex | Build MCP servers with the Node/TS SDK: tools, resources, Zod, stdio vs HTTP |

### Research & knowledge

| Skill | Scope | What it does |
| --- | --- | --- |
| deep-research | shared | Multi-source research with firecrawl and exa, delivered as a cited report |
| exa-search | shared | Neural web, code, company and people search via the Exa MCP |
| documentation-lookup | shared | Fetch current library docs through Context7 instead of training data |
| defuddle | shared | Strip clutter from web pages into clean markdown to save tokens |
| local-knowledge-retrieval | shared | Index and retrieve bounded context from repo-local vaults, docs and notes |
| market-research | shared | Market sizing, competitive analysis and due diligence with source attribution |
| obsidian-markdown | shared | Obsidian Flavored Markdown: wikilinks, embeds, callouts, properties |
| obsidian-cli | shared | Drive an Obsidian vault from the CLI; plugin and theme development |
| obsidian-bases | shared | Create and edit `.base` files: views, filters, formulas, summaries |
| json-canvas | shared | Create and edit `.canvas` files: nodes, edges, groups, connections |

### Content & media

| Skill | Scope | What it does |
| --- | --- | --- |
| article-writing | shared | Long-form articles, guides and newsletters in a voice derived from examples |
| content-engine | shared | Platform-native content systems for X, LinkedIn, TikTok, YouTube, newsletters |
| crosspost | shared | Distribute across X, LinkedIn, Threads and Bluesky without identical reposts |
| video-editing | shared | AI-assisted cutting, structuring and augmenting of real footage |
| remotion-best-practices | shared | Video creation in React with Remotion |
| fal-ai-media | shared | Image, video and audio generation through the fal.ai MCP |
| frontend-slides | claude + codex | Animation-rich HTML presentations, from scratch or converted from PPTX |

### Business & career

| Skill | Scope | What it does |
| --- | --- | --- |
| investor-materials | shared | Pitch decks, one-pagers, memos, models and accelerator applications |
| investor-outreach | shared | Cold emails, warm intros, follow-ups and investor update emails |
| ats-optimize | shared | Make a resume survive ATS parsing and match a target job description |

## Agents

### Claude Code subagents (32)

| Agent | Purpose |
| --- | --- |
| planner | Implementation planning for complex features and refactors |
| architect | System design, scalability and technical decision-making |
| investigator-code | Read-only codebase investigation for Phase 1, citation-backed |
| investigator-research | External research via web search, library docs and API references |
| investigator-risk | Blast-radius and risk analysis; higher reasoning depth |
| unit-implementer | Executes exactly one minimal implementation unit within its file scope |
| tdd-guide | Enforces write-tests-first and 80%+ coverage |
| code-reviewer | General quality, security and maintainability review |
| security-reviewer | Secrets, injection, auth, SSRF, unsafe crypto, OWASP Top 10 |
| database-reviewer | PostgreSQL query optimization, schema design, performance |
| codex-review-runner | Thin runner for the Codex review pipeline; returns status, not findings |
| review-triage | Ranks and de-duplicates review findings for user approval |
| fix-implementer | Applies one user-approved fix when the Codex implement stage is unavailable |
| build-error-resolver | Build and TypeScript errors, minimal diffs |
| cpp-build-resolver / cpp-reviewer | C++ build, CMake and linker fixes; memory safety and modern idiom review |
| go-build-resolver / go-reviewer | Go build and vet fixes; idiomatic Go and concurrency review |
| rust-build-resolver / rust-reviewer | Cargo and borrow-checker fixes; ownership, lifetimes and unsafe review |
| java-build-resolver / java-reviewer | Maven/Gradle fixes; layered architecture, JPA and concurrency review |
| kotlin-build-resolver / kotlin-reviewer | Kotlin/Gradle fixes; coroutine safety, Compose and clean-architecture review |
| python-reviewer | PEP 8, Pythonic idioms, type hints, security and performance |
| e2e-runner | Generates, runs and maintains E2E journeys; quarantines flaky tests |
| refactor-cleaner | Dead code and duplicate removal via knip, depcheck and ts-prune |
| doc-updater | Codemaps, READMEs and guides |
| docs-lookup | Library, framework and API docs through Context7 |
| harness-optimizer | Tunes this harness for reliability, cost and throughput |
| loop-operator | Runs autonomous agent loops and intervenes when they stall |
| chief-of-staff | Multi-channel message triage with drafted replies and follow-through |

### Codex CLI roles (11)

Declared in `codex/config.example.toml` under `[agents.*]`, backed by `codex/agents/*.toml`.

| Role | Purpose |
| --- | --- |
| explorer | Read-only codebase explorer gathering evidence before changes are proposed |
| reviewer | Owner-style review of correctness, security, regressions and missing tests |
| docs_researcher | Verifies APIs, framework behavior and release notes |
| planner | Plans complex features, refactors, risks and phased task breakdowns |
| architect | System design, scalability, integration boundaries and tradeoffs |
| security_reviewer | Secrets, injection, auth, SSRF, unsafe crypto, dependency and data-leak risk |
| tdd_guide | Tests-first feature work and behavior-focused bug fixes |
| build_resolver | Build, typecheck, lint and dependency errors with minimal diffs |
| e2e_runner | Playwright journeys, artifacts and flake triage |
| refactor_cleaner | Dead-code cleanup and consolidation that preserves behavior |
| markdown_writer | Lower-cost writer for Markdown, notes, prompt recipes, AGENTS.md and SKILL.md |

`[agents] max_threads = 6` and `max_depth = 1` bound how much parallelism Codex will take on.

## Commands

57 slash commands in `claude-code/commands/`. Each also exists as a Codex prompt recipe under
`codex/prompts/codex-commands/`, run with `codex-prompt <name>`.

**Orchestration & planning** - `/orchestrate` phased multi-agent pipeline with gates · `/plan`
restate requirements, assess risk, produce a step-by-step plan · `/multi-plan`, `/multi-execute`,
`/multi-workflow`, `/multi-frontend`, `/multi-backend` multi-model collaborative variants ·
`/devfleet` parallel Claude agents in isolated worktrees · `/model-route` pick the model tier ·
`/prompt-optimize` rewrite a draft prompt · `/aside` answer a side question without losing context ·
`/claw` persistent zero-dependency REPL with model routing.

**Review & quality** - `/code-review` general review · `/python-review`, `/go-review`,
`/rust-review`, `/cpp-review`, `/kotlin-review` language-specific reviews · `/quality-gate` block
on unmet quality bars · `/verify` verification loop · `/test-coverage` coverage report and gaps ·
`/refactor-clean` dead code and duplicate cleanup · `/harness-audit` audit this configuration.

**Build & test per language** - `/build-fix` and `/tdd` (generic) · `/go-build` + `/go-test` ·
`/rust-build` + `/rust-test` · `/cpp-build` + `/cpp-test` · `/kotlin-build` + `/kotlin-test` ·
`/gradle-build` Android and KMP builds · `/e2e` Playwright journeys · `/eval` run the eval harness.

**Sessions & learning** - `/save-session`, `/resume-session`, `/sessions`, `/checkpoint` ·
`/learn` and `/learn-eval` extract reusable patterns from a session · `/instinct-status`,
`/instinct-export`, `/instinct-import`, `/promote`, `/evolve`, `/projects` manage learned instincts ·
`/skill-create`, `/skill-health` author and audit skills · `/loop-start`, `/loop-status`
autonomous loops.

**Docs & misc** - `/docs` Context7 lookup · `/update-docs`, `/update-codemaps` · `/setup-pm`
choose a package manager · `/pm2` PM2 process setup.

## Hooks

`claude-code/hooks/hooks.json` wires 21 hook entries across `PreToolUse`, `PostToolUse`,
`PreCompact`, `SessionStart`, `Stop` and `SessionEnd`, implemented by 25 scripts in
`claude-code/scripts/hooks/` (auto-format, typecheck, console-log guard, dev-server block,
git-push reminder, cost tracking, session markers, compaction suggestions, quality gate).
Codex has its own wiring in `codex/hooks.json`.
Full detail: [docs/hooks-and-automation.md](docs/hooks-and-automation.md).

## Keeping it in sync

Edit in `~/.agents`, never in the rendered copies, then re-render:

```bash
~/.agents/bin/sync-agents            # MCP servers into both tools
~/.agents/bin/sync-agents rules      # refresh the shared-rules block in ~/.codex/AGENTS.md
~/.agents/bin/sync-agents status     # table of server -> in Claude? in Codex?
~/.agents/bin/sync-agents mcp --dry-run
```

Skills need no sync step at all: they are symlinked out of `~/.agents/skills` into both tools, so
an edit is live immediately. Claude Code imports `~/.agents/RULES.md` directly from
`~/.claude/CLAUDE.md`; Codex cannot import, so `sync-agents rules` copies the file into the
marked block in `~/.codex/AGENTS.md`.
Full detail: [docs/layout-and-sync.md](docs/layout-and-sync.md).

## Acknowledgements

- Much of the base content here derives from **Everything Claude Code (ECC)** by
  [Affaan Mustafa](https://github.com/affaan-m/everything-claude-code) (MIT) - the skill, agent,
  command and rule scaffolding, the hook library and the `ecc` toolkit all trace back to it.
- `codex/scripts/codex-companion-runtime` vendors **OpenAI's Codex plugin** (Apache-2.0); its
  `LICENSE` and `NOTICE` are preserved in place.
- Skill provenance for upstream-sourced skills is pinned in `shared/skill-lock.json`.

## License

MIT. See [LICENSE](LICENSE).
