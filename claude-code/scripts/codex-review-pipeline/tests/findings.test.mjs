import { test } from "node:test";
import assert from "node:assert/strict";
import { assignIds, sortBySeverity, needsAdjudication, partitionFindings, mergeDecisions, summarize, unmatchedDecisionIds } from "../lib/findings.mjs";

const f = (over) => ({ id: "", severity: "medium", complexity: "simple", confidence: 0.9, recommendation: "rec", ...over });

test("assignIds fills missing ids without mutating input", () => {
  const input = [f({ id: "" }), f({ id: "KEEP" }), f({})];
  const out = assignIds(input);
  assert.deepEqual(out.map((x) => x.id), ["F-01", "KEEP", "F-03"]);
  assert.equal(input[0].id, "");
});

test("assignIds replaces ids that are not safe path tokens", () => {
  const out = assignIds([f({ id: "../../../../tmp/pwned" }), f({ id: "F-02" }), f({ id: "a".repeat(40) }), f({ id: "ok_id-1" })]);
  assert.deepEqual(out.map((x) => x.id), ["F-01", "F-02", "F-03", "ok_id-1"]);
});

test("mergeDecisions marks findings the adjudicator dropped as needs-human, not hunter-confirmed", () => {
  const merged = mergeDecisions([f({ id: "F-01", complexity: "complex" }), f({ id: "F-02" })], [], ["F-01"]);
  assert.equal(merged[0].status, "needs-human");
  assert.equal(merged[0].decided_by, "adjudicator-missing");
  assert.equal(merged[1].status, "confirmed");
  assert.equal(merged[1].decided_by, "hunter");
});

test("unmatchedDecisionIds reports decisions for unknown findings", () => {
  assert.deepEqual(unmatchedDecisionIds([f({ id: "F-01" })], [{ id: "F-01" }, { id: "F-99" }]), ["F-99"]);
});

test("sortBySeverity orders critical first then by confidence", () => {
  const out = sortBySeverity([f({ id: "a", severity: "low" }), f({ id: "b", severity: "critical", confidence: 0.5 }), f({ id: "c", severity: "critical", confidence: 0.9 })]);
  assert.deepEqual(out.map((x) => x.id), ["c", "b", "a"]);
});

test("needsAdjudication routes complex, uncertain-high-stakes, and low-confidence findings", () => {
  assert.equal(needsAdjudication(f({ complexity: "complex" })), true);
  assert.equal(needsAdjudication(f({ severity: "high", confidence: 0.7 })), true);
  assert.equal(needsAdjudication(f({ severity: "high", confidence: 0.9 })), false);
  assert.equal(needsAdjudication(f({ severity: "low", confidence: 0.5 })), true);
  assert.equal(needsAdjudication(f({ severity: "low", confidence: 0.95 })), false);
  assert.equal(needsAdjudication(f({ severity: "low", confidence: 0.95 }), { all: true }), true);
});

test("partitionFindings splits into toAdjudicate and autoConfirmed", () => {
  const { toAdjudicate, autoConfirmed } = partitionFindings([f({ id: "x", complexity: "complex" }), f({ id: "y" })]);
  assert.deepEqual(toAdjudicate.map((x) => x.id), ["x"]);
  assert.deepEqual(autoConfirmed.map((x) => x.id), ["y"]);
});

test("mergeDecisions applies adjudicator verdicts and defaults the rest to hunter-confirmed", () => {
  const merged = mergeDecisions(
    [f({ id: "F-01" }), f({ id: "F-02", recommendation: "orig" })],
    [{ id: "F-01", verdict: "rejected", severity: "low", confidence: 0.2, rationale: "nope", fix_plan: "", files_to_touch: [] }]
  );
  assert.equal(merged[0].status, "rejected");
  assert.equal(merged[0].decided_by, "adjudicator");
  assert.equal(merged[0].severity, "low");
  assert.equal(merged[1].status, "confirmed");
  assert.equal(merged[1].decided_by, "hunter");
  assert.equal(merged[1].fix_plan, "orig");
});

test("summarize counts statuses and excludes rejected from severity totals", () => {
  const s = summarize([
    { status: "confirmed", severity: "critical" },
    { status: "rejected", severity: "critical" },
    { status: "needs-human", severity: "medium" }
  ]);
  assert.equal(s.total, 3);
  assert.equal(s.confirmed, 1);
  assert.equal(s.rejected, 1);
  assert.equal(s.needs_human, 1);
  assert.equal(s.by_severity.critical, 1);
  assert.equal(s.by_severity.medium, 1);
});
