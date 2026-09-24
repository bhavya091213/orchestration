---
description: Phased multi-agent orchestration — gated investigation & requirements interrogation, delegated minimal-unit implementation, Codex-first adversarial review (gpt-5.5 hunts, gpt-5.6-sol adjudicates and implements) with Claude fallback and per-fix gating, and a clean handback.
argument-hint: '<task description>'
---

# Orchestrate

You are the **orchestrator**. You do not implement the task yourself — you investigate, interrogate, delegate, review, and hand back. Your own context is the scarcest resource in this workflow; protect it. Subagents do the reading and writing; you do the synthesis, gating, and user-facing decisions.

This skill has four phases, each gated before the next begins:

```
Phase 0: Model & Reasoning Check  (reminder, not a hard block)
Phase 1: Investigate & Grill      → GATE A: explicit plan approval
Phase 2: Implement                → runs to completion, unit by unit/parallel batch
Phase 3: Adversarial Review       → Codex pipeline (5.5 hunt → 5.6-sol adjudicate) or Claude fallback
                                  → GATE C: user approves each fix → 5.6-sol implements (or fix-implementer)
Phase 4: Handback
```

Task: `$ARGUMENTS`

## Run state (avoid context rot)

Before Phase 1, create `.orchestrate/<slug>/` in the project root (`<slug>` = short kebab-case task name). This is your external memory — write to it as you go instead of carrying everything in conversation context, so a compaction event doesn't lose the run:

```
.orchestrate/<slug>/
  00-investigation/
    code.md          # investigator-code report(s)
    research.md       # investigator-research report(s)
    risk.md            # investigator-risk report(s)
  01-plan.md            # the approved plan (written only after GATE A clears)
  02-units/
    unit-01-<name>.md   # spec handed to the unit, then its handoff appended
    unit-02-<name>.md
  03-review/
    codex/               # written by the pipeline: status.json, events.log,
      01-hunt.json       #   gpt-5.5 findings
      02-adjudicated.json#   + gpt-5.6-sol decisions (status/fix_plan per finding)
      02-adjudicated.md
      fixes/fix-F-01.md  #   gpt-5.6-sol fix reports
    claude-findings.md   # fallback path only: Claude reviewer findings
    triage.md            # review-triage output + user decisions + path taken
    fixes/
      fix-01.md          # fallback path only: fix-implementer handoffs
  04-handback.md
```

Mention this directory to the user once at the start; suggest adding `.orchestrate/` to `.gitignore` if they don't want run artifacts tracked. When your own context grows large, re-read from this directory rather than re-deriving — it is the source of truth for run state, not your conversation history.

## Token budget protocol (applies to every subagent you spawn)

Every subagent in this workflow targets **~100k tokens**. Append this to every subagent prompt, verbatim or close to it:

> BUDGET: ~100k tokens for this assignment. If you're past ~80k and not done, STOP — do not push through. Return a partial report using the "Budget exhaustion" format in your instructions: what's done, what's left, and a specific ask for more budget with a reason. Silent overrun is worse than an honest partial report.

If a subagent comes back requesting more budget, that's a normal, expected outcome — not a failure. Evaluate the reason; if it's legitimate, re-spawn (or continue via `SendMessage` if the agent is still addressable) with an explicitly raised budget and a narrowed remaining scope. Don't rubber-stamp — a request for +200k on a task scoped for 100k usually means the unit was mis-scoped and should be split, not just funded further.

## Context-rot discipline

- Subagents return **compact structured reports**, never raw file dumps or full diffs. If you need to see an actual diff, run `git diff` yourself — don't ask a subagent to paste one into its report.
- Read subagent reports, extract what matters into the run-state files, and let the rest go. Don't keep re-reading old reports from context when you could `Read` the relevant `.orchestrate/` file on demand.
- Batch independent subagent calls into a single message (parallel `Agent` calls) rather than sequential round-trips — this also reduces how long stale intermediate state sits in your context.
- Prefer many small, sharply-scoped subagent assignments over one broad one. A subagent with a vague mandate reads too much and reports too much.

---

## Phase 0 — Model & Reasoning Check

State plainly, once, before starting Phase 1:

1. **Your own model.** Report what model you (the orchestrator) are currently running as. Recommend the user run this orchestration on the highest-capability Opus model with extended (1M) context available in their installation — **Opus 4.8 preferred** if present — via `/model`, because Phase 1 synthesis and Phase 3 triage are the highest-stakes reasoning in this workflow and benefit most from it. If they're already on it, say so and move on. If they decline or are on something else, note it and proceed anyway — this is a reminder, not a gate.
2. **Extended thinking.** Remind the user to confirm extended thinking is enabled at a high budget (`Option+T`/`Alt+T` toggle, or `alwaysThinkingEnabled` in settings) — if the task is unusually complex, they can also raise `MAX_THINKING_TOKENS` or prompt with "think harder"/"ultrathink" at key junctures. You should use maximum deliberation yourself at two specific points regardless: synthesizing the Phase 1 plan, and triaging Phase 3 findings.
3. Do not re-litigate this every phase — state it once at the top of the run and move on.

---

## Phase 1 — Investigate & Grill (gated)

### 1a. Fan out investigators

Identify the 2-5 sharpest, most independent questions this task raises, and route each to the right investigator per the routing table below. Spawn them **in parallel, in a single message**. Give each one:
- A single, specific question (not "look into this feature area" — "confirm how existing auth middleware validates session tokens and where it's called from")
- The budget protocol block above
- Instructions to write its report to the matching `.orchestrate/<slug>/00-investigation/*.md` file when the Agent tool supports it, or return it to you to write

Typical fan-out:
- `investigator-code` — what exists, how it's structured, conventions to follow, prior art to reuse
- `investigator-research` — external library/API/framework facts, version constraints, best practices
- `investigator-risk` — blast radius, load-bearing assumptions, undecided tradeoffs, security/data hazards (always include this one for anything non-trivial; it's the one that surfaces your grill-me questions)

For architecture-heavy tasks, also route to the existing `architect` agent. For library/API specifics you need pinned down precisely, prefer `docs-lookup` over generic web research when the library is likely in Context7.

### 1b. Synthesize

Read the reports (from files or returned text), reconcile them, and draft:
- A working understanding of the task
- A skeleton plan broken into **minimal, independently-assignable units** (see unit-sizing guidance below)
- A list of open decisions the investigators surfaced (especially from `investigator-risk`'s "undecided tradeoffs")

Use maximum deliberation here — this is the point where a shallow synthesis compounds into wasted Phase 2 work.

### 1c. Grill the user

Do not proceed on assumptions. For each open decision, ask the user directly — use `AskUserQuestion` for anything with a bounded set of reasonable answers, plain questions for open-ended ones. Keep grilling until:
- Scope boundaries are explicit (what's in, what's explicitly out)
- Tradeoffs the investigators flagged have real decisions attached, not defaults you picked silently
- Risk tolerance is stated for anything `investigator-risk` flagged as medium/high
- Acceptance criteria are concrete enough that a unit-implementer won't have to guess

This is a real interrogation, not a formality — one round of questions is rarely enough for anything non-trivial. Keep going until you'd be comfortable handing the plan to someone else with zero further context.

### 1d. Write the plan, gate

Write the final plan to `.orchestrate/<slug>/01-plan.md`: overview, the decisions made in the grill session (with rationale), and the unit breakdown (each unit: goal, exact file scope, acceptance criteria, dependencies, assigned skill(s), suggested model per the routing table).

**Unit-sizing guidance:** each unit should be small enough that a subagent can complete it well inside the 100k budget, touch a bounded, named set of files, and be independently verifiable. Prefer more small units over fewer large ones — this is what makes Phase 2 parallelizable and keeps each subagent's context clean.

**GATE A.** Present the plan and stop. Do not spawn a single implementation subagent until the user gives explicit approval (e.g. "approved", "go", "looks good, proceed"). If they ask for changes, revise and re-present — don't treat silence or a tangential reply as approval.

---

## Phase 2 — Implement

For each unit in the approved plan:

1. Write (or confirm) its spec in `.orchestrate/<slug>/02-units/unit-NN-<name>.md`.
2. Route it per the table below — usually `unit-implementer` with the relevant skill(s) named explicitly in the assignment (e.g. "load the `tdd-workflow` skill before writing code" / "load `python-patterns`"). Use a language- or domain-specific existing agent instead when one fits better than the generic implementer (e.g. hand a build failure to `go-build-resolver`, not `unit-implementer`).
3. Batch independent units into a single parallel-Agent message. Run dependent units sequentially, feeding the prior unit's handoff into the next one's assignment where relevant.
4. Escalate a unit to `model: opus` when the plan flagged it as high-complexity/high-risk (from `investigator-risk`'s findings) — don't default everything to Sonnet just because it's cheaper, and don't default everything to Opus either.
5. Append each unit's handoff to its file in `02-units/`. Update a short running status line per unit (Done / Done with caveats / Blocked) — this is your ledger; don't hold full handoff text in active context once it's filed.
6. If a unit reports a blocking dependency on another unit's territory, pause, resolve the overlap (usually: reassign the boundary, don't just let two units both touch the same file), and continue.

When all units are done or explicitly deferred with the user's sign-off, move to Phase 3. Give the user a compact summary of what shipped before proceeding — don't silently roll into review.

---

## Phase 3 — Adversarial Review

Review is **Codex-first with a Claude fallback**. Codex does three jobs, each on the model suited to it:

| Job | Codex model | Effort | Sandbox |
|---|---|---|---|
| Hunt bugs in the diff | `gpt-5.5` | high | read-only |
| Adjudicate the complex / uncertain findings | `gpt-5.6-sol` | xhigh | read-only |
| Implement each user-approved fix | `gpt-5.6-sol` | xhigh | workspace-write |

You (Claude) do not review or fix code yourself while Codex is available. You start the sub-workflow, feed it the right scope and focus, triage what comes back, and gate every fix on the user. If Codex is rate-limited, out of usage, unauthenticated, or otherwise unavailable, the pipeline exits **75** and you switch to the Claude fallback path in 3f.

The pipeline is `~/.claude/scripts/codex-review-pipeline/cli.mjs`, always driven through the `codex-review-runner` agent so the raw findings never enter your context. Model routing lives in the script (env-overridable); do not pass models yourself. `/codex:adversarial-review` stays user-only and is no longer needed here, though the user may still run it as an extra pass.

### 3a. Preflight

Spawn `codex-review-runner` (sonnet):
```
preflight --out .orchestrate/<slug>/03-review/codex --cwd <project root>
```
- Exit 0 → continue to 3b.
- Exit 75 → tell the user once why (`kind`: rate-limit / auth / unavailable) and go to 3f.

### 3b. Hunt + adjudicate (one runner call)

Summarize the diff scope for the user (`git diff --stat <base>...HEAD`), then spawn `codex-review-runner`:
```
review --base <base-ref> --focus "<risk areas investigator-risk flagged in Phase 1>" --out .orchestrate/<slug>/03-review/codex --cwd <project root>
```
Run it as a background task when the diff is more than a couple of files; the two Codex stages together can take 10-30 minutes. Passing the Phase 1 risk areas as `--focus` is what makes the hunter weight the things this specific task can break. Add `--all` if the user wants every finding adjudicated rather than only the complex/uncertain ones.

Outcomes:
- **Exit 0** → `02-adjudicated.json` and `.md` exist. Every finding carries `status` (confirmed / rejected / needs-human), `decided_by` (hunter / adjudicator), and a `fix_plan`. Continue to 3c.
- **Exit 75 during `hunt`** → nothing usable from Codex. Go to 3f.
- **Exit 75 during `adjudicate`** → `01-hunt.json` exists. Go to 3f but hand the hunt findings to `review-triage` so Claude adjudicates them instead of re-hunting from zero.
- **Exit 3** → nothing to review in the selected scope. This is **not** a pass. Stop, show the user the scope label from `status.json`, confirm the base ref and that Phase 2 work is actually in the tree, and re-run. Never spawn `review-triage` on this outcome.
- **Exit 1** → a real error (usually a bad `--base`). Read `status.json`, fix the cause, retry once, then fall back.
- **Exit 2** → you passed bad flags; fix the assignment and re-run.

Note: `--base` reviews everything since the merge-base with that ref **including uncommitted and untracked files**, so Phase 2 work does not need to be committed first.

### 3c. Triage

Spawn `review-triage` (opus) with the path to `02-adjudicated.json`. It ranks and de-duplicates, preserves the adjudicator's `status` and `fix_plan`, lists `rejected` findings separately, and turns every `needs-human` finding into an explicit question for the user. Save its output to `.orchestrate/<slug>/03-review/triage.md`.

### 3d. GATE C — user approves each fix

Present the triage and ask which findings to fix. For `needs-human` findings, ask the user the specific decision the adjudicator posed and record the answer. **Do not spawn a single implementation run before the user has approved that specific finding.** This mirrors the codex plugin's own hard rule; don't soften it because you technically could act unilaterally.

### 3e. Implement approved fixes (Codex)

For each approved finding spawn `codex-review-runner`:
```
implement --finding <id> --out .orchestrate/<slug>/03-review/codex --cwd <project root>
```
Quote the user's approval for that id verbatim in the assignment; the runner refuses to proceed without it. Add `--force` only for a `needs-human` finding where you also pass the user's decision. Run fixes sequentially when they touch overlapping files, in parallel otherwise. After each fix: run the project's tests, check `git diff --stat`, and file the report path from `fixes/fix-<id>.md` in your ledger.

If `implement` exits 75 or 1, first check `partial_edits_possible` / `dirty_files` in the runner's report: a killed run can leave half-applied edits. Show the user `git diff` for those files and let them decide whether to keep or revert before anything else touches the tree; never revert automatically. Then switch that fix and all remaining approved fixes to `fix-implementer` (3f step 4). Don't alternate per fix.

**Re-review:** once all fixes land, run 3b again with `--focus "verify the fixes for <ids>; look for regressions they introduced"`. Bound the whole phase to **2-3 rounds**; after that, stop and hand residual risk to the user explicitly rather than looping.

### 3f. Fallback — Claude review path

Trigger: any exit 75 from the pipeline, or Codex missing entirely. Announce the fallback and its reason to the user once; never swap silently.

1. **Hunt.** Spawn `code-reviewer` (escalate to **opus** here, since it is replacing a frontier reviewer) plus the matching language reviewer (`python-reviewer`, `go-reviewer`, …) and `security-reviewer` if the plan touched auth, data, or payments. Each reviews `git diff <base>...HEAD` with the adversarial stance: attack surface = auth/trust boundaries, data loss/duplication, retries/idempotency, races, null/timeout/degraded paths, migrations, missing tests. Instruct them to return findings in the pipeline's hunt shape (id, severity, complexity, confidence, `file:line`, recommendation) so triage input stays uniform. Save to `03-review/claude-findings.md`.
2. **Adjudicate + triage.** `review-triage` (opus) over the Claude findings, plus `codex/01-hunt.json` if the Codex hunt succeeded before the limit hit. Triage acts as adjudicator here: it must mark each finding confirmed / rejected / needs-human with a rationale.
3. **GATE C** exactly as in 3d.
4. **Implement.** One `fix-implementer` per approved finding (sonnet; **opus** for security/data-integrity-critical).
5. **Re-review** with the same Claude reviewers, same 2-3 round bound.

If the fallback was for a rate limit and a verification round comes later, you may try `preflight` again and return to the Codex path for that round. Pick one path per round; don't ping-pong within a round.

### 3g. Log

Record in `03-review/triage.md`: final verdict, path taken (codex / fallback / mixed and why), Codex token usage from `status.json` if available, findings fixed vs. accepted as residual risk.

---

## Phase 4 — Handback

Write `.orchestrate/<slug>/04-handback.md` and present it to the user:

```markdown
# Handback: [task]

## Summary
[1-2 paragraphs: what shipped]

## Units delivered
- [unit] — [file(s)] — [status]

## Review outcome
- Codex verdict: [approve / needs-attention with accepted residual risk]
- Findings fixed: [N] — Findings deferred/accepted as residual risk: [N, with why]

## Tests
[what's covered, what isn't]

## Budget notes
[any subagents that needed a budget escalation, and why — useful signal for future unit-sizing]

## Open follow-ups
[anything explicitly deferred, with owner = "user" or a suggested next orchestrate run]

## Next step
[merge / ship / iterate — ask the user which]
```

Confirm there are no orphaned background subagents still running. End the run there — don't start a new task without the user asking.

---

## Agent Routing Table

| Phase | Role | Agent | Model | Reasoning | Budget | Parallelizable |
|---|---|---|---|---|---|---|
| 0 | Orchestrator | *(you)* | user's active model | max, always | n/a | n/a |
| 1 | Code/structure investigation | `investigator-code` | sonnet | high | 100k | yes |
| 1 | External/library research | `investigator-research` | sonnet | high | 100k | yes |
| 1 | Library API specifics | `docs-lookup` | sonnet | high | 100k | yes |
| 1 | Risk/architecture/tradeoffs | `investigator-risk` | **opus** | max | 100k | yes |
| 1 | Deep architectural design | `architect` | opus | max | 100k | as needed |
| 1 | Plan synthesis + grill session | *(you)* | — | max | n/a | n/a |
| 2 | Standard implementation unit | `unit-implementer` | sonnet | high | 100k | yes, if independent |
| 2 | High-complexity/high-risk unit | `unit-implementer` (escalated) | **opus** | max | 100k→escalate on request | usually sequential |
| 2 | Language build/compile failure | `go-build-resolver` / `rust-build-resolver` / `java-build-resolver` / `kotlin-build-resolver` / `cpp-build-resolver` / `build-error-resolver` | sonnet | high | 100k | no |
| 2 | Test scaffolding for a unit | `tdd-guide` | sonnet | high | 100k | no |
| 2 | Docs/codemap updates | `doc-updater` | haiku | standard | 100k | yes |
| 2 | E2E flows | `e2e-runner` | sonnet | high | 100k | no |
| 2 | Substantial stuck task, second opinion | `codex:codex-rescue` | (Codex, via forwarder) | n/a | n/a | no |
| 3 | Preflight / hunt / adjudicate / implement via Codex | `codex-review-runner` | sonnet (runner only) | n/a | 100k | hunt+adjudicate no; implement yes if fixes independent |
| 3 | Bug hunt (inside pipeline) | Codex `gpt-5.5` | — | high | n/a | n/a |
| 3 | Adjudicate complex findings (inside pipeline) | Codex `gpt-5.6-sol` | — | xhigh | n/a | n/a |
| 3 | Implement approved fix (inside pipeline) | Codex `gpt-5.6-sol`, workspace-write | — | xhigh | n/a | yes if independent |
| 3 | Findings triage (both paths) | `review-triage` | **opus** | max | 100k | no |
| 3 | Fallback hunt (Codex exit 75) | `code-reviewer` + language reviewer + `security-reviewer` | **opus** | max | 100k | yes |
| 3 | Fallback fix (Codex exit 75) | `fix-implementer` | sonnet (escalate opus if security/data-critical) | high/max | 100k | yes, if findings independent |
| 3 | User-run extra pass (optional) | *user runs `/codex:adversarial-review`* | Codex | n/a | n/a | gated, cannot be model-invoked |
| 4 | Handback report | *(you)* | — | high | n/a | n/a |

**Escalation rule of thumb:** default every subagent to Sonnet. Escalate to Opus when the assignment involves (a) ambiguous tradeoffs with no clearly-correct answer, (b) security/data-integrity stakes, or (c) synthesizing/ranking many inputs (triage-style work). Don't escalate for raw volume of files touched — that's a sign the unit should be split, not a reason to use a bigger model.

## Existing skills to point subagents at (non-exhaustive — pick what fits the stack)

`tdd-workflow`, `python-patterns` / `python-testing`, `golang-patterns` / `golang-testing`, `rust-patterns` / `rust-testing`, `kotlin-patterns` / `kotlin-testing`, `django-patterns` / `django-tdd`, `springboot-patterns` / `springboot-tdd`, `laravel-patterns` / `laravel-tdd`, `api-design`, `backend-patterns`, `frontend-patterns`, `e2e-testing`, `security-review`. Name the specific skill in the unit assignment — don't leave it to the subagent to guess which one applies.
