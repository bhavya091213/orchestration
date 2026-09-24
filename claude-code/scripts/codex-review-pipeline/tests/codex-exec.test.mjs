import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
process.env.CODEX_BIN = path.join(here, "fixtures", "fake-codex.mjs");

let runCodex, buildArgs, parseStructuredOutput;
before(async () => ({ runCodex, buildArgs, parseStructuredOutput } = await import("../lib/codex-exec.mjs")));

const spec = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "crp-exec-"));
  return { model: "gpt-5.5", effort: "high", sandbox: "read-only", ephemeral: true, cwd: dir, schemaFile: null, lastMessageFile: path.join(dir, "last.txt"), prompt: "hunt <repository_context>" };
};

test("buildArgs pins non-interactive flags, model, effort, sandbox, schema", () => {
  const args = buildArgs({ model: "gpt-5.6-sol", effort: "xhigh", sandbox: "workspace-write", ephemeral: false, cwd: "/repo", schemaFile: "/s.json", lastMessageFile: "/last.txt" });
  assert.equal(args[0], "exec");
  assert.ok(args.includes("--json"));
  assert.deepEqual(args.slice(args.indexOf("-m"), args.indexOf("-m") + 2), ["-m", "gpt-5.6-sol"]);
  assert.ok(args.includes('model_reasoning_effort="xhigh"'));
  assert.ok(args.includes('approval_policy="never"'));
  assert.deepEqual(args.slice(args.indexOf("-s"), args.indexOf("-s") + 2), ["-s", "workspace-write"]);
  assert.ok(args.includes("--output-schema"));
  assert.ok(!args.includes("--ephemeral"));
  assert.equal(args.at(-1), "-");
});

test("successful run returns ok with usage and last message", async () => {
  const out = await runCodex(spec());
  assert.equal(out.ok, true);
  assert.equal(out.fallback, false);
  assert.equal(out.usage.model, "gpt-5.5");
  assert.equal(out.usage.effort, "high");
  assert.equal(JSON.parse(out.lastMessage).verdict, "needs-attention");
});

for (const [mode, kind] of [["ratelimit", "rate-limit"], ["auth", "auth"], ["badmodel", "config"]]) {
  test(`${mode} failure is classified ${kind} and flagged for fallback`, async () => {
    process.env.FAKE_CODEX_MODE = mode;
    try {
      const out = await runCodex(spec());
      assert.equal(out.ok, false);
      assert.equal(out.kind, kind);
      assert.equal(out.fallback, true);
      assert.ok(out.errors.length > 0);
    } finally {
      delete process.env.FAKE_CODEX_MODE;
    }
  });
}

test("crash without events is unknown and not fallback", async () => {
  process.env.FAKE_CODEX_MODE = "crash";
  try {
    const out = await runCodex(spec());
    assert.equal(out.ok, false);
    assert.equal(out.kind, "unknown");
    assert.equal(out.fallback, false);
  } finally {
    delete process.env.FAKE_CODEX_MODE;
  }
});

test("timeout kills the child and reports fallback", async () => {
  process.env.FAKE_CODEX_MODE = "hang";
  try {
    const out = await runCodex({ ...spec(), timeoutMs: 300 });
    assert.equal(out.ok, false);
    assert.equal(out.kind, "timeout");
    assert.equal(out.fallback, true);
    assert.equal(out.timedOut, true);
  } finally {
    delete process.env.FAKE_CODEX_MODE;
  }
});

test("failure classification ignores model prose on stdout", async () => {
  process.env.FAKE_CODEX_MODE = "crash-after-prose";
  try {
    const out = await runCodex(spec());
    assert.equal(out.ok, false);
    assert.equal(out.kind, "unknown", "a finding mentioning 429/quota must not be classified as a rate limit");
    assert.equal(out.fallback, false);
  } finally {
    delete process.env.FAKE_CODEX_MODE;
  }
});

test("parseStructuredOutput accepts raw and fenced JSON, rejects garbage", () => {
  assert.deepEqual(parseStructuredOutput('{"a":1}'), { a: 1 });
  assert.deepEqual(parseStructuredOutput('```json\n{"a":2}\n```'), { a: 2 });
  assert.throws(() => parseStructuredOutput("nope"), /not valid JSON/);
  assert.throws(() => parseStructuredOutput(""), /empty/);
});
