#!/usr/bin/env node
// Stand-in for the codex binary. Emits the same JSONL event shapes the real
// `codex exec --json` produces. Behaviour is chosen from the prompt so a single
// shim can serve hunt, adjudicate, and implement stages in one pipeline run.
import { writeFileSync } from "node:fs";

const argv = process.argv.slice(2);
if (argv[0] === "--version") { console.log("codex-cli 0.0.0-fake"); process.exit(0); }
if (argv[0] === "login") { console.log(process.env.FAKE_CODEX_LOGIN ?? "Logged in using ChatGPT"); process.exit(0); }

const outIndex = argv.indexOf("-o");
const outFile = outIndex >= 0 ? argv[outIndex + 1] : null;
const modelIndex = argv.indexOf("-m");
const model = modelIndex >= 0 ? argv[modelIndex + 1] : "?";
const effort = ((argv.find((a) => a.startsWith("model_reasoning_effort=")) || "").split("=")[1] || "?").replace(/"/g, "");

let prompt = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (prompt += c));
process.stdin.on("end", () => run());

const emit = (event) => console.log(JSON.stringify(event));

const RATE_LIMIT = '{"type":"error","status":429,"error":{"type":"usage_limit_reached","message":"You\'ve hit your usage limit. Try again later."}}';
const AUTH = '{"type":"error","status":401,"error":{"type":"invalid_request_error","message":"Unauthorized: not logged in"}}';
const BAD_MODEL = `{"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The '${model}' model is not supported when using Codex with a ChatGPT account."}}`;

function fail(message) {
  emit({ type: "thread.started", thread_id: "fake" });
  emit({ type: "turn.started" });
  emit({ type: "error", message });
  emit({ type: "turn.failed", error: { message } });
  process.exit(1);
}

function succeed(text) {
  emit({ type: "thread.started", thread_id: "fake" });
  emit({ type: "turn.started" });
  emit({ type: "item.completed", item: { id: "item_0", type: "agent_message", text } });
  emit({ type: "turn.completed", usage: { input_tokens: 100, output_tokens: 10, reasoning_output_tokens: 5, model, effort } });
  if (outFile) writeFileSync(outFile, text);
  process.exit(0);
}

function run() {
  const stage = prompt.includes("<findings_to_adjudicate>") ? "adjudicate" : prompt.includes("approved fix") ? "implement" : "hunt";
  const mode = process.env.FAKE_CODEX_MODE ?? "ok";
  if (mode === "ratelimit") return fail(RATE_LIMIT);
  if (mode === "auth") return fail(AUTH);
  if (mode === "badmodel") return fail(BAD_MODEL);
  if (mode === "crash") { console.error("segfault-ish"); process.exit(139); }
  if (mode === "crash-after-prose") {
    emit({ type: "thread.started", thread_id: "fake" });
    emit({ type: "item.completed", item: { id: "item_0", type: "agent_message", text: "The handler returns 429 when the quota is exhausted; rate limit logic looks fine." } });
    console.error("segfault-ish");
    process.exit(139);
  }
  if (mode === "hang") return setTimeout(() => {}, 60_000);
  if (mode === "garbage") return succeed("this is not json");
  if (process.env.FAKE_CODEX_FAIL_STAGE === stage) return fail(RATE_LIMIT);

  if (stage === "hunt") {
    return succeed(JSON.stringify({
      verdict: "needs-attention",
      summary: "Ship blocked: unchecked null path.",
      findings: [
        { id: process.env.FAKE_CODEX_HOSTILE_ID ? "../../../../tmp/pwned" : "F-01", severity: "critical", complexity: "complex", category: "data-integrity", title: "Partial write on retry", body: "Retry re-inserts rows without idempotency key.", file: "src/a.js", line_start: 10, line_end: 20, confidence: 0.9, recommendation: "Add idempotency key." },
        { id: "F-02", severity: "low", complexity: "simple", category: "error-handling", title: "Swallowed error", body: "catch {} hides failure.", file: "src/b.js", line_start: 3, line_end: 5, confidence: 0.95, recommendation: "Log and rethrow." },
        { id: "F-03", severity: "high", complexity: "simple", category: "correctness", title: "Off-by-one", body: "Loop bound uses <= on length.", file: "src/c.js", line_start: 7, line_end: 7, confidence: 0.7, recommendation: "Use <." }
      ],
      next_steps: ["Fix F-01 before merge."]
    }));
  }
  if (stage === "adjudicate") {
    return succeed(JSON.stringify({
      summary: "F-01 confirmed, F-03 was a false positive.",
      decisions: [
        { id: "F-01", verdict: "confirmed", severity: "critical", confidence: 0.95, rationale: "Traced retry path.", fix_plan: "Add idempotency key column and check before insert; test retry twice.", files_to_touch: ["src/a.js", "test/a.test.js"] },
        { id: "F-03", verdict: "rejected", severity: "low", confidence: 0.9, rationale: "Array is 1-indexed by construction.", fix_plan: "", files_to_touch: [] }
      ]
    }));
  }
  return succeed(`## Fix: F-01 — Partial write on retry\n\n### Status\nFixed & verified\n\n### Change\n- \`src/a.js:12\` — added idempotency check\n\n### Verification\nnpm test passed\n\n### Residual risk\nnone identified\n\n### Adjacent issues noticed but NOT fixed\nnone\n`);
}
