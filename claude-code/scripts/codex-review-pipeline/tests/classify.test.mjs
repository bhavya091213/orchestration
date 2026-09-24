import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyFailure, isFallbackKind } from "../lib/classify.mjs";

const cases = [
  ["429 usage_limit_reached: You've hit your usage limit.", "rate-limit"],
  ["rate limit exceeded, try again in 20s", "rate-limit"],
  ["insufficient_quota for this plan", "rate-limit"],
  ["HTTP 401 Unauthorized", "auth"],
  ["Codex CLI is not logged in. Run codex login", "auth"],
  ["connect ECONNREFUSED 127.0.0.1:8787", "unavailable"],
  ["502 Bad Gateway", "unavailable"],
  ["spawn codex ENOENT", "unavailable"],
  ["The 'gpt-9' model is not supported when using Codex with a ChatGPT account.", "config"],
  ["Model metadata for `x` not found.", "config"],
  ["some unrelated stack trace", "unknown"],
  ["", "unknown"]
];

for (const [text, kind] of cases) {
  test(`classifyFailure(${JSON.stringify(text.slice(0, 40))}) -> ${kind}`, () => {
    const result = classifyFailure(text);
    assert.equal(result.kind, kind);
    assert.equal(result.fallback, kind !== "unknown");
  });
}

test("isFallbackKind covers timeout and known kinds but not unknown", () => {
  assert.equal(isFallbackKind("timeout"), true);
  assert.equal(isFallbackKind("malformed"), true);
  assert.equal(isFallbackKind("rate-limit"), true);
  assert.equal(isFallbackKind("unknown"), false);
});
