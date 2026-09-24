import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "../cli.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(here, "..", "cli.mjs");
const FAKE = path.join(here, "fixtures", "fake-codex.mjs");

function makeRepo() {
  const dir = mkdtempSync(path.join(tmpdir(), "crp-repo-"));
  const git = (...args) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@t");
  git("config", "user.name", "t");
  mkdirSync(path.join(dir, "src"));
  writeFileSync(path.join(dir, "src", "a.js"), "export const a = 1;\n");
  git("add", ".");
  git("commit", "-q", "-m", "init");
  writeFileSync(path.join(dir, "src", "a.js"), "export const a = 2;\n");
  writeFileSync(path.join(dir, "src", "new.js"), "export const n = 1;\n");
  return dir;
}

function run(cwd, args, env = {}) {
  const result = spawnSync(process.execPath, [CLI, ...args, "--cwd", cwd, "--out", "review-out"], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, CODEX_BIN: FAKE, ...env }
  });
  let json = null;
  try { json = JSON.parse(result.stdout); } catch { /* usage errors print text */ }
  return { code: result.status, json, stdout: result.stdout, stderr: result.stderr };
}

test("parseArgs handles value flags, boolean flags, and rejects unknown ones", () => {
  const parsed = parseArgs(["review", "--base", "main", "--all", "--focus", "auth flow"]);
  assert.equal(parsed.command, "review");
  assert.deepEqual(parsed.options, { base: "main", all: true, focus: "auth flow" });
  assert.throws(() => parseArgs(["hunt", "--nope"]), /Unknown flag/);
  assert.throws(() => parseArgs(["hunt", "--base"]), /requires a value/);
  assert.throws(() => parseArgs(["hunt", "stray"]), /Unexpected argument/);
});

test("preflight succeeds with fake codex and reports models per stage", () => {
  const repo = makeRepo();
  const { code, json } = run(repo, ["preflight"]);
  assert.equal(code, 0);
  assert.equal(json.ok, true);
  assert.equal(json.models.hunt, "gpt-5.5@high");
  assert.equal(json.models.adjudicate, "gpt-5.6-sol@xhigh");
  assert.equal(json.models.implement, "gpt-5.6-sol@xhigh");
});

test("preflight exits 75 when codex is not logged in", () => {
  const repo = makeRepo();
  const { code, json } = run(repo, ["preflight"], { FAKE_CODEX_LOGIN: "Not logged in" });
  assert.equal(code, 75);
  assert.equal(json.fallback, true);
  assert.equal(json.kind, "auth");
});

test("review runs hunt then adjudicate, writes artifacts, merges decisions", () => {
  const repo = makeRepo();
  const { code, json } = run(repo, ["review"]);
  assert.equal(code, 0, json && JSON.stringify(json));
  assert.equal(json.stage, "adjudicate");
  assert.equal(json.adjudicated, 2);
  assert.equal(json.auto_confirmed, 1);
  const out = path.join(repo, "review-out");
  assert.ok(existsSync(path.join(out, "01-hunt.json")));
  const adjudicated = JSON.parse(readFileSync(path.join(out, "02-adjudicated.json"), "utf8"));
  const byId = Object.fromEntries(adjudicated.findings.map((f) => [f.id, f]));
  assert.equal(byId["F-01"].status, "confirmed");
  assert.equal(byId["F-01"].decided_by, "adjudicator");
  assert.equal(byId["F-02"].status, "confirmed");
  assert.equal(byId["F-02"].decided_by, "hunter");
  assert.equal(byId["F-03"].status, "rejected");
  assert.equal(adjudicated.counts.rejected, 1);
  assert.ok(readFileSync(path.join(out, "02-adjudicated.md"), "utf8").includes("F-01"));
  assert.ok(existsSync(path.join(out, "status.json")));
  assert.equal(readFileSync(path.join(out, "events.log"), "utf8").trim().split("\n").length, 2);
});

test("review exits 75 and records pending ids when adjudication is rate limited", () => {
  const repo = makeRepo();
  const { code, json } = run(repo, ["review"], { FAKE_CODEX_FAIL_STAGE: "adjudicate" });
  assert.equal(code, 75);
  assert.equal(json.stage, "adjudicate");
  assert.equal(json.kind, "rate-limit");
  assert.deepEqual(json.pending, ["F-01", "F-03"]);
  assert.ok(existsSync(path.join(repo, "review-out", "01-hunt.json")), "hunt output is preserved for the Claude fallback");
});

test("hunt exits 75 on rate limit, 0 with empty flag when nothing to review", () => {
  const limited = run(makeRepo(), ["hunt"], { FAKE_CODEX_MODE: "ratelimit" });
  assert.equal(limited.code, 75);
  assert.equal(limited.json.kind, "rate-limit");

  const clean = makeRepo();
  spawnSync("git", ["add", "."], { cwd: clean });
  spawnSync("git", ["commit", "-q", "-m", "wip"], { cwd: clean });
  const empty = run(clean, ["hunt"]);
  assert.equal(empty.code, 3, "empty scope must not look like a passed review");
  assert.equal(empty.json.empty, true);
  assert.equal(empty.json.ok, false);
});

test("hunt with garbage output falls back as malformed", () => {
  const { code, json } = run(makeRepo(), ["hunt"], { FAKE_CODEX_MODE: "garbage" });
  assert.equal(code, 75);
  assert.equal(json.kind, "malformed");
});

test("implement refuses rejected findings, requires --force for needs-human, writes fix report for confirmed", () => {
  const repo = makeRepo();
  assert.equal(run(repo, ["review"]).code, 0);
  const rejected = run(repo, ["implement", "--finding", "F-03"]);
  assert.equal(rejected.code, 1);
  assert.match(rejected.json.errors[0], /rejected/);

  const adjudicatedFile = path.join(repo, "review-out", "02-adjudicated.json");
  const data = JSON.parse(readFileSync(adjudicatedFile, "utf8"));
  writeFileSync(adjudicatedFile, JSON.stringify({ ...data, findings: data.findings.map((f) => (f.id === "F-02" ? { ...f, status: "needs-human" } : f)) }));
  const human = run(repo, ["implement", "--finding", "F-02"]);
  assert.equal(human.code, 1);
  assert.match(human.json.errors[0], /needs a human decision/);

  const fixed = run(repo, ["implement", "--finding", "F-01"]);
  assert.equal(fixed.code, 0, JSON.stringify(fixed.json));
  assert.equal(fixed.json.finding, "F-01");
  assert.equal(fixed.json.model, "gpt-5.6-sol");
  const report = readFileSync(path.join(repo, "review-out", "fixes", "fix-F-01.md"), "utf8");
  assert.ok(report.includes("## Fix: F-01"));
  assert.ok(report.includes("git status --short"));
});

test("implement without --finding is a usage error (exit 2) and is recorded in status.json", () => {
  const repo = makeRepo();
  const { code, json } = run(repo, ["implement"]);
  assert.equal(code, 2);
  assert.match(json.errors[0], /--finding/);
  const status = JSON.parse(readFileSync(path.join(repo, "review-out", "status.json"), "utf8"));
  assert.equal(status.kind, "usage");
});

test("--out outside the project root is refused", () => {
  const repo = makeRepo();
  const result = spawnSync(process.execPath, [CLI, "preflight", "--cwd", repo, "--out", "../../escape"], { cwd: repo, encoding: "utf8", env: { ...process.env, CODEX_BIN: FAKE } });
  assert.equal(result.status, 2);
  assert.match(result.stdout, /inside the project root/);
});

test("--base that looks like a git option is rejected", () => {
  const doubleDash = run(makeRepo(), ["hunt", "--base", "--output=/tmp/should-not-exist"]);
  assert.equal(doubleDash.code, 2, "double-dash values are refused by the arg parser");
  const singleDash = run(makeRepo(), ["hunt", "--base", "-Doutput=/tmp/should-not-exist"]);
  assert.equal(singleDash.code, 1);
  assert.match(singleDash.json.errors[0], /looks like an option/);
});

test("--base review includes uncommitted and untracked work", () => {
  const repo = makeRepo();
  spawnSync("git", ["checkout", "-q", "-b", "feature"], { cwd: repo });
  const { code, json } = run(repo, ["review", "--base", "main"]);
  assert.equal(code, 0, JSON.stringify(json));
  const hunt = JSON.parse(readFileSync(path.join(repo, "review-out", "01-hunt.json"), "utf8"));
  assert.match(hunt.scope.label, /merge-base with main/);
});

test("garbage numeric env overrides fall back to defaults instead of instant timeouts", () => {
  const { code, json } = run(makeRepo(), ["hunt"], { CODEX_PIPELINE_TIMEOUT_MS: "25m", CODEX_PIPELINE_AUTO_CONFIRM_CONFIDENCE: "abc" });
  assert.equal(code, 0, JSON.stringify(json));
});

test("hostile finding ids are replaced before they reach the filesystem", () => {
  const repo = makeRepo();
  const { code } = run(repo, ["review"], { FAKE_CODEX_HOSTILE_ID: "1" });
  assert.equal(code, 0);
  const adjudicated = JSON.parse(readFileSync(path.join(repo, "review-out", "02-adjudicated.json"), "utf8"));
  assert.ok(adjudicated.findings.every((f) => /^[A-Za-z0-9_-]{1,16}$/.test(f.id)), JSON.stringify(adjudicated.findings.map((f) => f.id)));
  assert.ok(!existsSync(path.join(repo, ".orchestrate", "tmp")));
});
