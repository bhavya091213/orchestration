#!/usr/bin/env node
// Codex review pipeline: gpt-5.5 hunts bugs, gpt-5.6-sol adjudicates the complex
// ones, gpt-5.6-sol implements user-approved fixes. Exit 75 means Codex could
// not deliver (rate limit, usage depleted, auth, unavailable) and the caller
// should fall back to Claude's own review.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { EXIT, STAGES, DEFAULT_OUT_DIR, CODEX_BIN } from "./lib/config.mjs";
import { classifyFailure } from "./lib/classify.mjs";
import { hunt, adjudicate, implement } from "./lib/stages.mjs";
import { recordStatus, ensureDir } from "./lib/io.mjs";

const USAGE = `Usage:
  codex-review-pipeline preflight [--out <dir>]
  codex-review-pipeline hunt        [--base <ref>] [--focus "<text>"] [--out <dir>] [--cwd <dir>]
  codex-review-pipeline adjudicate  [--base <ref>] [--focus "<text>"] [--all] [--findings <hunt.json>] [--out <dir>] [--cwd <dir>]
  codex-review-pipeline review      (hunt + adjudicate)  [same flags]
  codex-review-pipeline implement   --finding <id> [--force] [--out <dir>] [--cwd <dir>]

Exit codes: 0 ok · 1 error · 2 usage · 3 nothing to review (NOT reviewed) · 75 fall back to Claude review (Codex unavailable/rate-limited/depleted)
--out must resolve inside --cwd. --findings points adjudicate at a different hunt JSON (default <out>/01-hunt.json).
Models: hunt=${STAGES.hunt.model}@${STAGES.hunt.effort}  adjudicate=${STAGES.adjudicate.model}@${STAGES.adjudicate.effort}  implement=${STAGES.implement.model}@${STAGES.implement.effort}
Override with CODEX_HUNT_MODEL / CODEX_HUNT_EFFORT / CODEX_ADJUDICATE_* / CODEX_IMPLEMENT_* env vars.`;

const VALUE_FLAGS = new Set(["base", "focus", "out", "cwd", "finding", "findings"]);
const BOOL_FLAGS = new Set(["all", "force", "help"]);

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const name = token.slice(2);
    if (BOOL_FLAGS.has(name)) {
      options[name] = true;
    } else if (VALUE_FLAGS.has(name)) {
      const value = rest[i + 1];
      if (value == null || value.startsWith("--")) throw new Error(`Flag --${name} requires a value.`);
      options[name] = value;
      i += 1;
    } else {
      throw new Error(`Unknown flag: ${token}`);
    }
  }
  return { command, options };
}

function preflight(outDir) {
  const version = spawnSync(CODEX_BIN, ["--version"], { encoding: "utf8" });
  if (version.error || version.status !== 0) {
    const detail = version.error?.message || version.stderr || "codex --version failed";
    return { exitCode: EXIT.FALLBACK, status: recordStatus(outDir, { stage: "preflight", ok: false, fallback: true, kind: "unavailable", errors: [detail] }) };
  }
  const login = spawnSync(CODEX_BIN, ["login", "status"], { encoding: "utf8" });
  const loginText = `${login.stdout ?? ""}${login.stderr ?? ""}`.trim();
  if (login.status !== 0 || /not logged in/i.test(loginText)) {
    const { kind } = classifyFailure(loginText || "not logged in");
    return { exitCode: EXIT.FALLBACK, status: recordStatus(outDir, { stage: "preflight", ok: false, fallback: true, kind: kind === "unknown" ? "auth" : kind, errors: [loginText || "not logged in"] }) };
  }
  const status = recordStatus(outDir, {
    stage: "preflight",
    ok: true,
    fallback: false,
    kind: null,
    codex: version.stdout.trim(),
    login: loginText,
    models: Object.fromEntries(Object.values(STAGES).map((s) => [s.name, `${s.model}@${s.effort}`]))
  });
  return { exitCode: EXIT.OK, status };
}

class UsageError extends Error {}

function resolveOutDir(cwd, requested) {
  const outDir = path.resolve(cwd, requested || DEFAULT_OUT_DIR);
  const relative = path.relative(cwd, outDir);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new UsageError(`--out must be inside the project root (${cwd}); got ${outDir}`);
  }
  return ensureDir(outDir);
}

async function dispatch({ command, options }) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const outDir = resolveOutDir(cwd, options.out);
  const common = { cwd, outDir, base: options.base || null, focus: options.focus || "" };
  switch (command) {
    case "preflight":
      return preflight(outDir);
    case "hunt":
      return hunt(common);
    case "adjudicate":
      return adjudicate({ ...common, all: Boolean(options.all), findingsFile: options.findings ? path.resolve(cwd, options.findings) : null });
    case "review": {
      const first = await hunt(common);
      if (first.exitCode !== EXIT.OK || first.status.empty) return first;
      return adjudicate({ ...common, all: Boolean(options.all) });
    }
    case "implement":
      if (!options.finding) throw new UsageError("implement requires --finding <id>.");
      return implement({ cwd, outDir, findingId: options.finding, force: Boolean(options.force) });
    default:
      throw new UsageError(USAGE);
  }
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
    if (!parsed.command || parsed.options.help) {
      console.log(USAGE);
      process.exit(EXIT.OK);
    }
  } catch (error) {
    console.error(error.message);
    console.error(USAGE);
    process.exit(EXIT.USAGE);
  }
  try {
    const { exitCode, status } = await dispatch(parsed);
    console.log(JSON.stringify(status, null, 2));
    process.exit(exitCode);
  } catch (error) {
    const exitCode = error instanceof UsageError ? EXIT.USAGE : EXIT.ERROR;
    const failure = { stage: parsed.command, ok: false, fallback: false, kind: error instanceof UsageError ? "usage" : "error", errors: [error.message] };
    // Record even thrown errors so status.json never shows a stale earlier success.
    try {
      const cwd = path.resolve(parsed.options.cwd || process.cwd());
      recordStatus(resolveOutDir(cwd, parsed.options.out), failure);
    } catch {
      // Out dir itself was the problem; stdout still carries the error.
    }
    console.log(JSON.stringify(failure, null, 2));
    process.exit(exitCode);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
