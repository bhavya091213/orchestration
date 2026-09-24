// Central defaults for the Codex review pipeline. Every value can be overridden
// with an environment variable so the orchestrate skill never has to edit code
// to re-route a stage to a different model or effort.

export const EXIT = Object.freeze({
  OK: 0,
  ERROR: 1,
  USAGE: 2,
  // Nothing to review in the selected scope. Distinct from OK so the caller can
  // never mistake "reviewed zero lines" for "review passed".
  EMPTY: 3,
  // EX_TEMPFAIL: Codex could not deliver (rate limit, usage depleted, auth,
  // unavailable, timeout). The caller should fall back to Claude's own review.
  FALLBACK: 75
});

const env = (name, fallback) => {
  const value = process.env[name];
  return value == null || value.trim() === "" ? fallback : value.trim();
};

// A malformed numeric override must not silently become NaN (setTimeout(NaN)
// fires immediately; `x < NaN` is always false). Fall back to the default.
const envNumber = (name, fallback) => {
  const parsed = Number(env(name, String(fallback)));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const STAGES = Object.freeze({
  hunt: Object.freeze({
    name: "hunt",
    model: env("CODEX_HUNT_MODEL", "gpt-5.5"),
    effort: env("CODEX_HUNT_EFFORT", "high"),
    sandbox: "read-only",
    ephemeral: true,
    schema: "hunt-output.schema.json",
    prompt: "hunt.md"
  }),
  adjudicate: Object.freeze({
    name: "adjudicate",
    model: env("CODEX_ADJUDICATE_MODEL", "gpt-5.6-sol"),
    effort: env("CODEX_ADJUDICATE_EFFORT", "xhigh"),
    sandbox: "read-only",
    ephemeral: true,
    schema: "adjudicate-output.schema.json",
    prompt: "adjudicate.md"
  }),
  implement: Object.freeze({
    name: "implement",
    model: env("CODEX_IMPLEMENT_MODEL", "gpt-5.6-sol"),
    effort: env("CODEX_IMPLEMENT_EFFORT", "xhigh"),
    sandbox: "workspace-write",
    ephemeral: false,
    schema: null,
    prompt: "implement.md"
  })
});

export const LIMITS = Object.freeze({
  // Per-stage wall clock before the pipeline gives up and signals fallback.
  timeoutMs: envNumber("CODEX_PIPELINE_TIMEOUT_MS", 25 * 60 * 1000),
  // Diff text larger than this is replaced with a stat summary; Codex reads the
  // files itself instead of receiving a multi-megabyte prompt.
  maxDiffBytes: envNumber("CODEX_PIPELINE_MAX_DIFF_BYTES", 200 * 1024),
  // Findings at or above this confidence with "simple" complexity skip adjudication.
  autoConfirmConfidence: envNumber("CODEX_PIPELINE_AUTO_CONFIRM_CONFIDENCE", 0.85)
});

export const DEFAULT_OUT_DIR = ".orchestrate/_review/codex";
export const CODEX_BIN = env("CODEX_BIN", "codex");
