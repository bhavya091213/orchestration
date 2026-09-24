# The `/orchestrate` Workflow

`/orchestrate` is the centerpiece of this configuration. It turns a single
Claude Code session into a **phased, gated, multi-agent pipeline**: investigate,
interrogate the user, delegate implementation to narrowly-scoped subagents, run
an adversarial review through Codex, and hand back a written report.

Source of truth: [`claude-code/commands/orchestrate.md`](../claude-code/commands/orchestrate.md)
(284 lines). The command is invoked as `/orchestrate <task description>`; the
task text lands in `$ARGUMENTS`.

The governing idea, stated in the command itself:

> You are the **orchestrator**. You do not implement the task yourself — you
> investigate, interrogate, delegate, review, and hand back. Your own context is
> the scarcest resource in this workflow; protect it.

---

## Phase diagram

```
/orchestrate <task>
  │
  ├─ Phase 0  Model & Reasoning Check ......... reminder, not a gate
  │            report own model · recommend Opus · confirm extended thinking
  │
  ├─ Phase 1  Investigate & Grill
  │            1a fan out (parallel): investigator-code   sonnet
  │                                   investigator-research sonnet
  │                                   investigator-risk   opus
  │            1b synthesize → skeleton plan + open decisions
  │            1c grill the user (AskUserQuestion), repeatedly
  │            1d write 01-plan.md
  │   ╔════════════════════════════════════════════════════╗
  │   ║ GATE A — explicit plan approval ("approved"/"go")  ║
  │   ╚════════════════════════════════════════════════════╝
  │
  ├─ Phase 2  Implement
  │            per unit: spec → unit-implementer (sonnet; opus if high-risk)
  │            independent units batched in parallel · handoffs filed to 02-units/
  │
  ├─ Phase 3  Adversarial Review — Codex-first
  │            3a preflight ─────────── exit 75 ──────┐
  │            3b review: gpt-5.5 hunt                │
  │                     → gpt-5.6-sol adjudicate      │
  │               exit 3 = NOT a pass → stop, re-scope │
  │            3c review-triage (opus)                │
  │   ╔════════════════════════════════════════════╗  │
  │   ║ GATE C — user approves each fix, one by one║  │
  │   ╚════════════════════════════════════════════╝  │
  │            3e gpt-5.6-sol implements each fix     │
  │            re-review, bounded to 2-3 rounds       ▼
  │            3f FALLBACK: code-reviewer (opus) + language reviewer
  │               + security-reviewer → review-triage → GATE C → fix-implementer
  │
  └─ Phase 4  Handback (04-handback.md)
```

Two hard gates (A and C) and one soft checkpoint (the compact summary at the end
of Phase 2). Phase 0 is explicitly "a reminder, not a gate".

---

## Run state: `.orchestrate/<slug>/`

Before Phase 1 the orchestrator creates a run directory in the project root.
This is external memory — the point is that a compaction event does not lose the
run.

```
.orchestrate/<slug>/
  00-investigation/{code,research,risk}.md
  01-plan.md                     # written only after GATE A clears
  02-units/unit-NN-<name>.md     # spec, then the unit's handoff appended
  03-review/
    codex/                       # written by the pipeline
      status.json  events.log
      01-hunt.json               # gpt-5.5 findings
      02-adjudicated.json / .md  # + gpt-5.6-sol status/fix_plan per finding
      fixes/fix-F-01.md
    claude-findings.md           # fallback path only
    triage.md                    # triage output + user decisions + path taken
    fixes/fix-01.md              # fallback path only
  04-handback.md
```

The command instructs the orchestrator to mention this directory once and to
suggest `.gitignore`-ing it, and — crucially — to *re-read from it* rather than
re-deriving state from conversation history when context grows.

## Token budget protocol

Every subagent spawn carries a verbatim budget block: **~100k tokens**, stop at
~80k if not done, and return a "Budget exhaustion" partial report naming what's
done, what's left, and a specific ask. Each agent definition carries the matching
format — see `## Budget exhaustion format` in
[`investigator-code.md`](../claude-code/agents/investigator-code.md),
[`unit-implementer.md`](../claude-code/agents/unit-implementer.md),
[`fix-implementer.md`](../claude-code/agents/fix-implementer.md), and the others.

The command is explicit that a budget request is a normal outcome, and that a
request for +200k on a 100k unit "usually means the unit was mis-scoped and
should be split, not just funded further."

## Context-rot discipline

Four rules, all about protecting the orchestrator's context: subagents return
**compact structured reports**, never raw file dumps or full diffs (need a diff?
run `git diff` yourself); extract what matters into run-state files and let the
rest go; batch independent calls into a single parallel message; prefer many
small sharply-scoped assignments over one broad one.

---

## Phase 1 — Investigate & Grill

### Fan-out

| Investigator | Model | Tools | Answers |
|---|---|---|---|
| `investigator-code` | sonnet | Read, Grep, Glob, Bash | what exists, structure, call sites, conventions, prior art |
| `investigator-research` | sonnet | WebSearch, WebFetch, Read, Grep, Glob | library/API/framework facts, version constraints |
| `investigator-risk` | **opus** | Read, Grep, Glob, Bash | blast radius, load-bearing assumptions, undecided tradeoffs |

All three are hard read-only. `investigator-code` requires a `file:line` citation
or an explicit "inferred, not confirmed" tag on every claim.
`investigator-risk` is deliberately on a stronger model and is told to form
hypotheses *before* grepping — "this agent exists specifically to avoid the
shallow-first-pass trap" — and that "a risk with no file:line tie-in is noise."

The orchestrator is told to always include `investigator-risk` for anything
non-trivial, because its **"Undecided tradeoffs (feed these into the grill-me
session)"** section is what seeds Phase 1c. For architecture-heavy work it also
routes to `architect`; for pinned library specifics it prefers `docs-lookup`
(Context7) over generic web research.

Questions must be specific. The command's own example contrast: not *"look into
this feature area"* but *"confirm how existing auth middleware validates session
tokens and where it's called from."*

### Grill

Phase 1c is an interrogation, not a formality. The orchestrator keeps asking —
`AskUserQuestion` for bounded choices, plain questions otherwise — until:

- scope boundaries are explicit (what's in, what's explicitly out)
- every investigator-flagged tradeoff has a real decision attached, "not defaults
  you picked silently"
- risk tolerance is stated for anything flagged medium/high
- acceptance criteria are concrete enough that a unit-implementer won't guess

### GATE A

The plan is written to `01-plan.md` and presented. **No implementation subagent
is spawned until the user explicitly approves.** Silence or a tangential reply is
not approval.

---

## Phase 2 — Implement, unit by unit

**Unit sizing** is the load-bearing concept. Each unit must:

- fit well inside the 100k budget
- touch a bounded, *named* set of files
- be independently verifiable

Each unit's plan entry carries: goal, exact file scope, acceptance criteria,
dependencies, assigned skill(s), and a suggested model.

### The handoff contract

[`unit-implementer`](../claude-code/agents/unit-implementer.md) (sonnet; tools
include `Skill`) refuses vague work: *"If your assignment is missing a file scope
or acceptance criteria, stop and report that gap rather than guessing."*

Its hard constraints:

- **Scope discipline** — touching an out-of-scope file is a *blocking dependency
  report*, not a silent edit, because "silent overlap causes merge conflicts
  between parallel units."
- **Minimal diffs** — no drive-by refactors, no speculative abstraction.
- **Skill loading first** — if the assignment names `tdd-workflow`,
  `python-patterns`, `api-design`, etc., invoke it via the `Skill` tool *before*
  writing code.
- **No fabricated success** — "Do not report green when it isn't."

It returns a fixed-shape handoff (Status / What changed / Skill(s) used / Tests /
Deviations from plan / Blocking dependencies / Open questions / Tokens used) —
explicitly "not a full diff."

The orchestrator batches independent units into one parallel message, runs
dependent units sequentially feeding the prior handoff forward, escalates
plan-flagged high-risk units to opus, and keeps a one-line ledger per unit
(Done / Done with caveats / Blocked) instead of holding handoff text in context.

Language build failures route to the specific resolver (`go-build-resolver`,
`rust-build-resolver`, `cpp-build-resolver`, …), not `unit-implementer`.

---

## Phase 3 — Codex-first adversarial review

Claude does not review or fix code itself while Codex is available. It starts the
sub-workflow, feeds it scope and focus, triages what comes back, and gates every
fix on the user.

### The pipeline

`claude-code/scripts/codex-review-pipeline/cli.mjs` (installed at
`~/.claude/scripts/codex-review-pipeline/cli.mjs`). See
[its README](../claude-code/scripts/codex-review-pipeline/README.md) and
[`lib/config.mjs`](../claude-code/scripts/codex-review-pipeline/lib/config.mjs)
for the defaults below.

| Stage | Model | Effort | Sandbox | Prompt | Output |
|---|---|---|---|---|---|
| `hunt` | `gpt-5.5` | high | read-only | `prompts/hunt.md` | `01-hunt.json` |
| `adjudicate` | `gpt-5.6-sol` | xhigh | read-only | `prompts/adjudicate.md` | `02-adjudicated.json` + `.md` |
| `implement` | `gpt-5.6-sol` | xhigh | **workspace-write** | `prompts/implement.md` | `fixes/fix-<id>.md` |

`review` = `hunt` then `adjudicate`. Commands:

```bash
node cli.mjs preflight  --out .orchestrate/<slug>/03-review/codex
node cli.mjs review     --base main --focus "<risk areas>" --out <dir> --cwd <root>
node cli.mjs implement  --finding F-01 --out <dir> --cwd <root>
```

The prompts set the stance: hunt is told to *"find concrete defects in the
change, not to validate it"*; adjudicate makes 5.6-sol "independently verify"
each finding against the repo before deciding; implement opens with *"The user
has explicitly approved this specific finding for a fix. Nothing else is
approved."*

Not everything goes to the adjudicator: only findings that are `complex`,
high-stakes but uncertain, or low-confidence. Simple findings at or above
`autoConfirmConfidence` (default `0.85`) are confirmed as-is with
`decided_by: hunter`. `--all` sends everything.

Other defaults: per-stage wall clock `25 min` (`CODEX_PIPELINE_TIMEOUT_MS`),
diff text over `200 KB` replaced with a stat summary so Codex reads files itself
(`CODEX_PIPELINE_MAX_DIFF_BYTES`). Model/effort are env-overridable via
`CODEX_HUNT_MODEL` / `CODEX_HUNT_EFFORT` / `CODEX_ADJUDICATE_*` /
`CODEX_IMPLEMENT_*`. Hardening: repository content is wrapped in a per-run random
delimiter and declared untrusted in every prompt; finding ids are sanitised
before use in filenames; `--out` must resolve inside `--cwd`.

### Exit codes and what the orchestrator does

| Exit | Meaning | Orchestrator action |
|---|---|---|
| `0` | ok | continue to the next sub-step |
| `1` | real error (usually a bad `--base`) | read `status.json`, fix, retry once, then fall back |
| `2` | usage error — bad flags | fix the assignment, re-run |
| `3` | nothing to review in scope | **not a pass.** Stop, show the scope label, confirm base ref, re-run. Never triage on this. |
| `75` | Codex unavailable: rate limit / depleted / auth / unavailable / timeout / malformed output | switch to the Claude fallback path (3f) |

Exit 75 is `EX_TEMPFAIL` and is the whole reason the fallback exists. Exit 75
during `hunt` means nothing usable; exit 75 during `adjudicate` means
`01-hunt.json` survived and gets handed to `review-triage` so Claude adjudicates
instead of re-hunting from zero.

### The runner is a firewall

[`codex-review-runner`](../claude-code/agents/codex-review-runner.md) (sonnet,
tools: Bash + Read) exists so raw findings never enter the orchestrator's
context. Its rules:

- **Exactly one `Bash` call per assignment.**
- **Never run `implement` unless the assignment quotes the user's explicit
  approval for that specific finding id.**
- Never pass `--force` unless the assignment states the user's human decision.
- Never paste `01-hunt.json` / `02-adjudicated.json` back.
- **Never retry a run that exited 75** — report the fallback immediately.
- Never fix, summarize, or editorialize on findings.

It returns a ≤25-line status block: exit code, outcome, models used, finding
counts, artifact paths, first 3 error lines, adjudication gaps, dirty files, and
a single "Orchestrator action" line.

### Triage

[`review-triage`](../claude-code/agents/review-triage.md) (**opus**, read-only:
Read/Grep/Glob) turns the adjudicated JSON into a ranked, de-duplicated list.

- It **preserves** `status`, `decided_by`, and `fix_plan` verbatim — it may rank
  within a verdict but never overrule a `confirmed` / `rejected`.
- `rejected` findings go in their own section, not the ranked list.
- Every `needs-human` finding becomes a concrete question for the user, quoting
  the decision the adjudicator said is needed.
- `decided_by: adjudicator-missing` findings are surfaced as unverified.
- Anything triage itself notices goes in a separate "not from Codex — your own
  observation, unverified" section, never blended in.
- It fixes nothing and never recommends auto-applying anything.

### GATE C — per-fix user approval

The triage is presented and the user picks which findings to fix, one by one.
`needs-human` findings get their specific question asked and the answer recorded.
From the command: *"Do not spawn a single implementation run before the user has
approved that specific finding... don't soften it because you technically could
act unilaterally."*

### Implementing fixes

Each approved finding gets its own `implement --finding <id>` run with the user's
approval quoted verbatim. Overlapping fixes run sequentially, independent ones in
parallel. After each: run tests, check `git diff --stat`, file the report path.

If `implement` exits 75 or 1, the orchestrator first checks
`partial_edits_possible` / `dirty_files` — a killed run can leave half-applied
edits. It shows the user `git diff` for those files and lets them decide;
**never reverts automatically.** Then it switches that fix *and all remaining
approved fixes* to `fix-implementer` — no alternating per fix.

Re-review runs 3b again with `--focus "verify the fixes for <ids>; look for
regressions they introduced"`, bounded to **2-3 rounds** total, after which
residual risk is handed to the user explicitly rather than looping.

### 3f — The Claude fallback path

Announced to the user once, with its reason; never swapped silently.

1. **Hunt** — `code-reviewer` escalated to **opus** (it is replacing a frontier
   reviewer), plus the matching language reviewer and `security-reviewer` if the
   plan touched auth, data, or payments. They review `git diff <base>...HEAD`
   with the adversarial stance and return findings **in the pipeline's hunt
   shape** (id, severity, complexity, confidence, `file:line`, recommendation) so
   triage input stays uniform.
2. **Adjudicate + triage** — `review-triage` (opus) acts as adjudicator here,
   marking each finding confirmed / rejected / needs-human with rationale, and
   saying plainly these are Claude verdicts, not Codex ones.
3. **GATE C** exactly as in 3d.
4. **Implement** — one
   [`fix-implementer`](../claude-code/agents/fix-implementer.md) per approved
   finding (sonnet; opus for security/data-integrity-critical). One finding, one
   fix; minimal targeted change; write a test that would have failed before;
   *"Don't just silence the symptom."* If the finding carries a Codex
   `fix_plan`, follow it unless clearly wrong, and say so on deviation.
5. **Re-review** with the same reviewers, same 2-3 round bound.

Path selection is per round: if the fallback was for a rate limit, a later
verification round may retry `preflight` and return to Codex — but never
ping-pong within a round.

`/codex:adversarial-review` stays user-only and is not needed here, though the
user may still run it as an extra pass.

---

## Phase 4 — Handback

`04-handback.md` is written and presented with fixed sections: Summary, Units
delivered, Review outcome (Codex verdict, findings fixed vs. deferred), Tests,
**Budget notes** (which subagents needed escalation — "useful signal for future
unit-sizing"), Open follow-ups, and Next step. The orchestrator confirms no
orphaned background subagents are running and stops — it does not start new work
unasked.

---

## Escalation rule of thumb

From the command's routing table:

> Default every subagent to Sonnet. Escalate to Opus when the assignment involves
> (a) ambiguous tradeoffs with no clearly-correct answer, (b) security/data-integrity
> stakes, or (c) synthesizing/ranking many inputs (triage-style work). **Don't
> escalate for raw volume of files touched — that's a sign the unit should be
> split, not a reason to use a bigger model.**

Full per-phase routing is in [model-routing.md](./model-routing.md).

---

## When to use `/orchestrate` vs a plain session

| Use `/orchestrate` when | Use a plain session when |
|---|---|
| The task spans multiple files/subsystems and splits into independently verifiable units | It's a one-file edit, a typo, a rename, a dependency bump |
| Requirements are underspecified and you want to be interrogated first (Phase 1c is the main value) | You already know exactly what to write — the grill is pure overhead |
| The change is risky: auth, migrations, concurrency, money, tenant isolation | You're prototyping and the answer will be thrown away |
| You want a *different* frontier model attacking the diff, not the author reviewing itself | The change is too small to split — a one-unit run is a slower plain session |
| The session would otherwise blow its context (`.orchestrate/<slug>/` exists for this) | Codex isn't configured — it still works via 3f, but Phase 3's distinctive value is lost |
| You want an auditable trail: plan, handoffs, findings, decisions | |

Rough line: if you'd naturally write a plan document before starting, use
`/orchestrate`. If you'd just start typing, don't.

---

## The Codex-side `orchestrate` prompt is a different thing

[`codex/prompts/codex-commands/orchestrate.md`](../codex/prompts/codex-commands/orchestrate.md)
exists, but it is **not** a port of the four-phase workflow above. It is an
older, simpler *sequential agent chain* recipe run via:

```bash
~/.codex/scripts/codex-prompt orchestrate "[workflow-type] [task-description]"
```

with four canned chains:

| Workflow | Chain |
|---|---|
| `feature` | planner → tdd-guide → code-reviewer → security-reviewer |
| `bugfix` | planner → tdd-guide → code-reviewer |
| `refactor` | architect → code-reviewer → tdd-guide |
| `security` | security-reviewer → code-reviewer → architect |

Plus `custom <agents> <description>`. It defines a `HANDOFF: <prev> -> <next>`
document format, a final ORCHESTRATION REPORT with a SHIP / NEEDS WORK / BLOCKED
recommendation, an optional tmux+worktree mode
(`node scripts/orchestrate-worktrees.js plan.json --execute`, with `seedPaths`
for overlaying dirty local files into worker worktrees), and a "CONTROL PLANE"
handoff block for multi-session runs.

There are **no gates, no `.orchestrate/` run state, no budget protocol, and no
Codex-first review pipeline** in the Codex version. If you want the gated
workflow, run `/orchestrate` from Claude Code — Codex participates as the review
engine in Phase 3 rather than driving.
