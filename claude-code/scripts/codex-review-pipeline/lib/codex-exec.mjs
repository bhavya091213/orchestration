import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { classifyFailure } from "./classify.mjs";
import { CODEX_BIN, LIMITS } from "./config.mjs";

// Build the argv for one `codex exec` run. Non-interactive runs must never
// block on approvals, so approval_policy is forced to "never" and safety comes
// from the sandbox mode instead.
export function buildArgs({ model, effort, sandbox, ephemeral, cwd, schemaFile, lastMessageFile }) {
  const args = [
    "exec",
    "--json",
    "--color",
    "never",
    "--skip-git-repo-check",
    "-C",
    cwd,
    "-m",
    model,
    "-c",
    `model_reasoning_effort=${JSON.stringify(effort)}`,
    "-c",
    'approval_policy="never"',
    "-s",
    sandbox,
    "-o",
    lastMessageFile
  ];
  const withEphemeral = ephemeral ? [...args, "--ephemeral"] : args;
  const withSchema = schemaFile ? [...withEphemeral, "--output-schema", schemaFile] : withEphemeral;
  return [...withSchema, "-"];
}

// Returns the parsed events plus how many non-empty lines were not JSON, so a
// corrupted stream is visible in the status instead of silently dropped.
function parseEvents(stdout) {
  const lines = stdout.split("\n").map((line) => line.trim()).filter(Boolean);
  const events = [];
  let dropped = 0;
  for (const line of lines) {
    try {
      events.push(JSON.parse(line));
    } catch {
      dropped += 1;
    }
  }
  return { events, dropped };
}

function extractErrors(events) {
  return events.flatMap((event) => {
    if (event.type === "error" && event.message) return [event.message];
    if (event.type === "turn.failed") return [event.error?.message ?? "turn failed"];
    if (event.type === "item.completed" && event.item?.type === "error" && event.item.message) return [event.item.message];
    return [];
  });
}

function readLastMessage(file) {
  return existsSync(file) ? readFileSync(file, "utf8") : "";
}

// Run codex once. Resolves (never rejects) with a structured outcome:
// { ok, kind, fallback, errors, usage, lastMessage, exitCode, timedOut }
export function runCodex({ prompt, timeoutMs = LIMITS.timeoutMs, ...spec }) {
  const args = buildArgs(spec);
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    let stdinError = null;

    const finish = (outcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };

    let child;
    try {
      child = spawn(CODEX_BIN, args, { cwd: spec.cwd, stdio: ["pipe", "pipe", "pipe"], env: process.env });
    } catch (error) {
      finish(failure({ errors: [error.message], stderr: "", exitCode: null, timedOut: false, lastMessage: "", diagnostics: null }));
      return;
    }

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5000).unref();
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      finish(failure({ errors: [error.message], stderr, exitCode: null, timedOut, lastMessage: "", diagnostics: null }));
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      const { events, dropped } = parseEvents(stdout);
      const errors = extractErrors(events);
      const completed = events.find((event) => event.type === "turn.completed");
      const lastMessage = readLastMessage(spec.lastMessageFile);
      const diagnostics = { dropped_event_lines: dropped, stdin_error: stdinError };
      if (timedOut) {
        finish({ ok: false, kind: "timeout", fallback: true, errors: [...errors, `timed out after ${timeoutMs}ms`], usage: null, lastMessage, exitCode, timedOut, stderr, diagnostics });
        return;
      }
      if (exitCode === 0 && completed && !events.some((e) => e.type === "turn.failed")) {
        finish({ ok: true, kind: null, fallback: false, errors, usage: completed.usage ?? null, lastMessage, exitCode, timedOut: false, stderr, diagnostics });
        return;
      }
      finish(failure({ errors, stderr, exitCode, timedOut: false, lastMessage, diagnostics }));
    });

    // EPIPE here means codex exited before reading the prompt; the close
    // handler reports the real cause, but the fact is kept for the status.
    child.stdin.on("error", (error) => (stdinError = error.message));
    child.stdin.end(prompt);
  });
}

// Classification looks only at error events and stderr, never at model prose
// on stdout, so a finding that mentions "429" or "quota" cannot be mistaken for
// a rate limit.
function failure({ errors, stderr, exitCode, timedOut, lastMessage, diagnostics }) {
  const { kind, fallback } = classifyFailure([...errors, stderr].join("\n"));
  const reported = errors.length > 0 ? errors : [stderr.trim() || `codex exited ${exitCode}`];
  return { ok: false, kind, fallback, errors: reported, usage: null, lastMessage, exitCode, timedOut, stderr, diagnostics };
}

export function parseStructuredOutput(lastMessage) {
  const text = String(lastMessage ?? "").trim();
  if (!text) throw new Error("Codex returned an empty final message.");
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) return JSON.parse(fenced[1]);
    throw new Error(`Codex final message was not valid JSON: ${text.slice(0, 200)}`);
  }
}
