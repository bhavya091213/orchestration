# Codex review pipeline

Three-stage adversarial review used by the `orchestrate` skill (Phase 3):

| Stage | Model | Sandbox | Output |
|---|---|---|---|
| `hunt` | gpt-5.5 @ high | read-only | `01-hunt.json` (schema: `schemas/hunt-output.schema.json`) |
| `adjudicate` | gpt-5.6-sol @ xhigh | read-only | `02-adjudicated.json` + `.md` |
| `implement` | gpt-5.6-sol @ xhigh | workspace-write | `fixes/fix-<id>.md` |

`review` = `hunt` then `adjudicate`. Only findings that are `complex`, high-stakes but
uncertain, or low-confidence go to the adjudicator; the rest are confirmed as-is
(`--all` sends everything). `implement` refuses `rejected` findings and requires
`--force` for `needs-human` ones.

```
node cli.mjs preflight  --out .orchestrate/<slug>/03-review/codex
node cli.mjs review     --base main --out .orchestrate/<slug>/03-review/codex
node cli.mjs implement  --finding F-01 --out .orchestrate/<slug>/03-review/codex
```

Exit codes: `0` ok · `1` error · `2` usage · `3` nothing to review (**not** a pass) · `75` **fall back to Claude review**
(rate limit / usage depleted / auth / unavailable / timeout / malformed output).
`--base <ref>` reviews everything since the merge-base with `ref`, including uncommitted
and untracked files. `--out` must resolve inside `--cwd`. `adjudicate --findings <file>`
reads a different hunt JSON than `<out>/01-hunt.json`. Repository content is wrapped in a
per-run random delimiter and declared untrusted in every prompt; finding ids are
sanitised before being used in file names.
`status.json` in the out dir always holds the last stage's result; `events.log` is append-only.

Override models and efforts with `CODEX_HUNT_MODEL`, `CODEX_HUNT_EFFORT`,
`CODEX_ADJUDICATE_MODEL`, `CODEX_ADJUDICATE_EFFORT`, `CODEX_IMPLEMENT_MODEL`,
`CODEX_IMPLEMENT_EFFORT`. Other knobs: `CODEX_PIPELINE_TIMEOUT_MS`,
`CODEX_PIPELINE_MAX_DIFF_BYTES`, `CODEX_PIPELINE_AUTO_CONFIRM_CONFIDENCE`, `CODEX_BIN`.

Tests: `node --test tests/*.test.mjs` (uses `tests/fixtures/fake-codex.mjs`, no network).
