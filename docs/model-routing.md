# Model & Effort Routing

One routing policy, two harnesses. The policy lives in
[`shared/RULES.md`](../shared/RULES.md) section C and is expressed differently in
each tool: Claude Code picks a **model per subagent**, Codex CLI keeps **one
model and varies reasoning effort per role**.

---

## The two tiers

From `shared/RULES.md` § C:

> - **Heavy-reasoning tier** — planning, architecture, root-cause debugging,
>   code/security reviews, anything ambiguous or open-ended.
> - **Light tier** — well-specified small mechanical tasks: formatting, simple
>   file writes, straightforward edits, running commands and reporting results.
> - **State the tier explicitly on every subagent spawn.**

That last bullet is the operational part: a spawn without a declared tier is
out of policy.

### Tool mapping

| | Heavy | Light | Trivial |
|---|---|---|---|
| **Claude Code** | Opus | Sonnet | Haiku (optional) |
| **Codex CLI** | `model_reasoning_effort = "xhigh"` (or `max`) | `"low"` / `"medium"` | — |

Claude Code spawns via the Agent tool with an explicit `model`. Codex subagents
are the roles declared in `~/.codex/config.toml` under `[agents.*]`, each backed
by a file in `~/.codex/agents/*.toml`; `[agents] max_threads` bounds parallelism.

---

## Claude Code

### The escalation heuristic

[`claude-code/rules/common/performance.md`](../claude-code/rules/common/performance.md)
splits the three models by work type:

- **Opus** — planning and architecture, debugging root causes, code and security
  reviews, anything ambiguous or high-stakes.
- **Sonnet** — mechanical edits and formatting, simple file writes, running
  commands and reporting results.
- **Haiku** — trivial, high-frequency tasks only.

[`claude-code/rules/common/agents.md`](../claude-code/rules/common/agents.md)
restates it in orchestration terms: "Opus for reasoning-heavy work, Sonnet for
well-specified small tasks — state the model on every spawn."

[`/orchestrate`](../claude-code/commands/orchestrate.md) gives the sharpest
version:

> Default every subagent to Sonnet. Escalate to Opus when the assignment involves
> (a) ambiguous tradeoffs with no clearly-correct answer, (b) security/data-integrity
> stakes, or (c) synthesizing/ranking many inputs (triage-style work). Don't
> escalate for raw volume of files touched — that's a sign the unit should be
> split, not a reason to use a bigger model.

### `/model-route`

[`claude-code/commands/model-route.md`](../claude-code/commands/model-route.md)
is the ask-the-harness version of the same heuristic:

```
/model-route [task-description] [--budget low|med|high]
```

| Tier | Fits |
|---|---|
| `haiku` | deterministic, low-risk mechanical changes |
| `sonnet` | default for implementation and refactors |
| `opus` | architecture, deep review, ambiguous requirements |

Required output: recommended model, confidence level, why it fits, and a fallback
model if the first attempt fails.

### The 32 subagents by purpose

Models below are the `model:` frontmatter field in
[`claude-code/agents/*.md`](../claude-code/agents).

**Planning & architecture** — heavy tier by default.

| Agent | Model | Role |
|---|---|---|
| `planner` | **opus** | implementation planning for complex features and refactors |
| `architect` | **opus** | system design, scalability, architectural decisions |

**Orchestrate Phase 1 — investigation** (all read-only).

| Agent | Model | Role |
|---|---|---|
| `investigator-code` | sonnet | what exists, structure, call sites, conventions, prior art |
| `investigator-research` | sonnet | external library/API/framework facts via web + docs |
| `investigator-risk` | **opus** | blast radius, load-bearing assumptions, undecided tradeoffs |
| `docs-lookup` | sonnet | pinned library API specifics via Context7 MCP |

`investigator-risk` is the deliberate escalation: "You are deliberately routed to
a stronger model because this task rewards deeper reasoning."

**Orchestrate Phase 2 — implementation.**

| Agent | Model | Role |
|---|---|---|
| `unit-implementer` | sonnet (escalate to opus for high-risk units) | exactly one scoped unit from an approved plan |
| `tdd-guide` | sonnet | tests-first scaffolding, 80%+ coverage |
| `e2e-runner` | sonnet | Playwright/Agent Browser journeys, flake quarantine |
| `doc-updater` | **haiku** | codemaps and documentation updates |

`doc-updater` is the only agent in the tree on Haiku — the "trivial,
high-frequency" tier in practice.

**Orchestrate Phase 3 — review.**

| Agent | Model | Role |
|---|---|---|
| `codex-review-runner` | sonnet | thin shell runner for the Codex pipeline; never interprets findings |
| `review-triage` | **opus** | rank + de-duplicate findings for GATE C |
| `fix-implementer` | sonnet (opus if security/data-critical) | one approved fix; fallback for Codex exit 75 |

`review-triage` is on Opus because "ranking severity, spotting duplicate/
overlapping findings across files, and judging which risks are actually
load-bearing versus theoretical rewards deeper reasoning than a mechanical pass."
The runner stays on Sonnet precisely because it does no reasoning — the
frontier work happens inside Codex.

**General review.**

| Agent | Model | Role |
|---|---|---|
| `code-reviewer` | sonnet (**escalated to opus** on the Phase 3 fallback path) | quality, security, maintainability |
| `security-reviewer` | sonnet | secrets, SSRF, injection, unsafe crypto, OWASP Top 10 |
| `database-reviewer` | sonnet | PostgreSQL query/schema/perf review |

**Language reviewers** — all sonnet.

| Agent | Focus |
|---|---|
| `cpp-reviewer` | memory safety, modern C++ idioms, concurrency |
| `go-reviewer` | idiomatic Go, concurrency, error handling |
| `java-reviewer` | layered architecture, JPA, Spring Boot security |
| `kotlin-reviewer` | coroutine safety, Compose, clean architecture |
| `python-reviewer` | PEP 8, Pythonic idioms, type hints |
| `rust-reviewer` | ownership, lifetimes, `unsafe` usage |

**Build/compile fixers** — all sonnet; minimal-diff mandate, no architectural edits.

`build-error-resolver` (TS/generic) · `cpp-build-resolver` · `go-build-resolver` ·
`java-build-resolver` · `kotlin-build-resolver` · `rust-build-resolver`

**Maintenance & harness.**

| Agent | Model | Role |
|---|---|---|
| `refactor-cleaner` | sonnet | dead code removal (knip, depcheck, ts-prune) |
| `harness-optimizer` | sonnet | analyze/improve the local agent harness config |
| `loop-operator` | sonnet | operate autonomous agent loops, intervene on stalls |
| `chief-of-staff` | **opus** | multi-channel comms triage with draft replies |

**Summary:** 5 agents on Opus (`planner`, `architect`, `investigator-risk`,
`review-triage`, `chief-of-staff`), 1 on Haiku (`doc-updater`), 26 on Sonnet.
Two more are escalated *at spawn time* rather than by frontmatter:
`code-reviewer` → opus on the Phase 3 fallback, `unit-implementer` → opus for
plan-flagged high-risk units.

---

## Codex CLI

One model, effort as the dial. Defaults in
[`codex/config.example.toml`](../codex/config.example.toml):

```toml
model = "gpt-6-astra"
model_reasoning_effort = "medium"
approval_policy = "on-request"
sandbox_mode = "workspace-write"
web_search = "live"
approvals_reviewer = "user"
```

Session-level profiles override the runtime posture without touching roles:

| Profile | `approval_policy` | `sandbox_mode` | `web_search` |
|---|---|---|---|
| `strict` | `on-request` | `read-only` | `cached` |
| `yolo` | `never` | `workspace-write` | `live` |
| `research` | `on-request` | `read-only` | `live` |

Parallelism is bounded globally:

```toml
[agents]
max_threads = 6
max_depth = 1
```

### The 11 Codex agent roles

Each `[agents.<name>]` entry in `config.example.toml` points at a
`config_file = "agents/<name>.toml"` holding model, effort, sandbox, and
`developer_instructions`. All 11 pin `model = "gpt-5.6-sol"`.

| Role | Effort | Tier | Sandbox | Purpose |
|---|---|---|---|---|
| `architect` | `xhigh` | heavy | read-only | architecture, scalability, module boundaries, integration risk |
| `planner` | `xhigh` | heavy | read-only | phased, testable plans for complex features and refactors |
| `reviewer` | `xhigh` | heavy | read-only | owner-style review: correctness, security, regressions, missing tests |
| `security_reviewer` | `xhigh` | heavy | read-only | secrets, injection, authz/authn, SSRF, unsafe crypto, data leakage |
| `docs_researcher` | `xhigh` | heavy | read-only | verify APIs and release-note claims against primary docs |
| `tdd_guide` | `xhigh` | heavy | **workspace-write** | RED/GREEN/REFACTOR implementation |
| `explorer` | `medium` | light | read-only | trace execution paths, cite files/symbols, propose no fixes |
| `build_resolver` | `medium` | light | workspace-write | build/typecheck/lint/dependency errors, minimal diffs |
| `e2e_runner` | `medium` | light | workspace-write | Playwright journeys, artifacts, flake triage |
| `refactor_cleaner` | `medium` | light | workspace-write | dead code and duplicate-path removal, behavior preserved |
| `markdown_writer` | `medium` | light | workspace-write | Markdown, Obsidian notes, prompt recipes, `AGENTS.md`, `SKILL.md` |

Six heavy (`xhigh`), five light (`medium`). Five roles are hard read-only —
advisory roles cannot mutate the tree at all, which is the Codex analogue of
giving a Claude investigator only `Read`/`Grep`/`Glob`.

`markdown_writer` exists specifically as a cost guard. From
[`codex/prompts/codex-commands/orchestrate.md`](../codex/prompts/codex-commands/orchestrate.md):

> Do not route straightforward Markdown writing to high-effort models unless the
> task also needs deep architecture, security, or code reasoning.

### Codex inside `/orchestrate` Phase 3

The review pipeline does **not** use these `[agents.*]` roles — it shells out to
`codex` directly with per-stage model/effort/sandbox from
[`claude-code/scripts/codex-review-pipeline/lib/config.mjs`](../claude-code/scripts/codex-review-pipeline/lib/config.mjs):

| Stage | Model | Effort | Sandbox | Env overrides |
|---|---|---|---|---|
| `hunt` | `gpt-5.5` | `high` | read-only | `CODEX_HUNT_MODEL`, `CODEX_HUNT_EFFORT` |
| `adjudicate` | `gpt-5.6-sol` | `xhigh` | read-only | `CODEX_ADJUDICATE_MODEL`, `CODEX_ADJUDICATE_EFFORT` |
| `implement` | `gpt-5.6-sol` | `xhigh` | workspace-write | `CODEX_IMPLEMENT_MODEL`, `CODEX_IMPLEMENT_EFFORT` |

A deliberately *different* model hunts than the one that adjudicates — the point
is adversarial diversity, not just more compute. See
[orchestration-workflow.md](./orchestration-workflow.md#phase-3--codex-first-adversarial-review).

---

## The 100k subagent budget

From `shared/RULES.md` § D, mirrored in `rules/common/performance.md` and
`rules/common/agents.md`:

> A subagent's context must never exceed **100k tokens**. Scope each task to fit;
> hand it only the files/paths it actually needs.

### Stop-and-ask protocol

1. The subagent tracks its own usage.
2. Past **~80k tokens** and not done → **STOP**. Do not push through.
3. Return a partial report in the agent's `## Budget exhaustion format`:
   **what's done**, **what remains**, and **an explicit ask for more budget with
   a reason**.
4. The orchestrator evaluates. A budget request is a normal outcome, not a
   failure — but it is not rubber-stamped.
5. The orchestrator either **splits the task** into smaller units or
   **explicitly grants more budget**, then re-spawns (or continues via
   `SendMessage`) with a narrowed remaining scope.

`/orchestrate` adds the diagnostic reading:

> A request for +200k on a task scoped for 100k usually means the unit was
> mis-scoped and should be split, not just funded further.

Every orchestrate-phase agent carries the matching format block:
[`investigator-code`](../claude-code/agents/investigator-code.md),
[`investigator-research`](../claude-code/agents/investigator-research.md),
[`investigator-risk`](../claude-code/agents/investigator-risk.md),
[`unit-implementer`](../claude-code/agents/unit-implementer.md),
[`fix-implementer`](../claude-code/agents/fix-implementer.md). `review-triage`
handles the budget differently — when findings are voluminous it prioritizes
"breadth-first triage over deep re-investigation of any single finding."

The rule applies to the orchestrator too: compact or hand off at logical phase
boundaries rather than letting the session bloat.
`rules/common/performance.md` adds a matching guardrail for the interactive
session — avoid the last 20% of the context window for large-scale refactoring,
multi-file feature work, and debugging complex interactions.

---

## Checklist for a compliant spawn

- [ ] Tier stated explicitly (heavy / light).
- [ ] Claude Code: `model` set on the Agent call, not left to default.
- [ ] Codex: role chosen from `[agents.*]`, effort matching the tier.
- [ ] Budget block included (~100k, stop at ~80k, partial-report format).
- [ ] Scope is a bounded, named set of files — not "look into this area".
- [ ] Escalation to Opus/`xhigh` justified by ambiguity, stakes, or synthesis —
      not by file count.
