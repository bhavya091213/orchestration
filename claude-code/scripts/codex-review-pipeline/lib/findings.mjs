// Pure helpers for shaping hunt output and merging adjudication decisions.

const SEVERITY_RANK = Object.freeze({ critical: 4, high: 3, medium: 2, low: 1 });

const pad = (n) => String(n).padStart(2, "0");

// Ids end up in file names, so a model-supplied id is only kept when it is a
// short plain token. Anything else is replaced by the positional F-NN.
export const SAFE_ID = /^[A-Za-z0-9_-]{1,16}$/;

export function assignIds(findings) {
  return (findings ?? []).map((finding, index) => {
    const candidate = String(finding.id ?? "").trim();
    return { ...finding, id: SAFE_ID.test(candidate) ? candidate : `F-${pad(index + 1)}` };
  });
}

export function sortBySeverity(findings) {
  return [...findings].sort((a, b) => {
    const bySeverity = (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0);
    if (bySeverity !== 0) return bySeverity;
    return (b.confidence ?? 0) - (a.confidence ?? 0);
  });
}

// A finding needs the adjudicator when the hunter itself flagged it complex, or
// when it is high-stakes but not confidently established, or when confidence is
// low enough that acting on it blindly would waste an implementation run.
export function needsAdjudication(finding, { autoConfirmConfidence = 0.85, all = false } = {}) {
  if (all) return true;
  if (finding.complexity === "complex") return true;
  const confidence = Number(finding.confidence ?? 0);
  const highStakes = finding.severity === "critical" || finding.severity === "high";
  if (highStakes && confidence < autoConfirmConfidence) return true;
  return confidence < 0.6;
}

export function partitionFindings(findings, options) {
  return findings.reduce(
    (acc, finding) =>
      needsAdjudication(finding, options)
        ? { ...acc, toAdjudicate: [...acc.toAdjudicate, finding] }
        : { ...acc, autoConfirmed: [...acc.autoConfirmed, finding] },
    { toAdjudicate: [], autoConfirmed: [] }
  );
}

// Merge adjudicator decisions back onto the hunter's findings.
// - never sent to the adjudicator      -> confirmed, decided_by: hunter
// - sent but missing from `decisions`  -> needs-human, decided_by: adjudicator-missing
//   (a dropped complex finding must not masquerade as a confident simple one)
export function mergeDecisions(findings, decisions, adjudicatedIds = []) {
  const byId = new Map((decisions ?? []).map((decision) => [decision.id, decision]));
  const sent = new Set(adjudicatedIds);
  return findings.map((finding) => {
    const decision = byId.get(finding.id);
    if (!decision && sent.has(finding.id)) {
      return {
        ...finding,
        status: "needs-human",
        decided_by: "adjudicator-missing",
        adjudication_rationale: "The adjudicator returned no decision for this finding; treat as unverified.",
        fix_plan: finding.recommendation
      };
    }
    if (!decision) {
      return { ...finding, status: "confirmed", decided_by: "hunter", fix_plan: finding.recommendation };
    }
    return {
      ...finding,
      status: decision.verdict,
      decided_by: "adjudicator",
      severity: decision.severity ?? finding.severity,
      confidence: decision.confidence ?? finding.confidence,
      adjudication_rationale: decision.rationale,
      fix_plan: decision.fix_plan || finding.recommendation,
      files_to_touch: decision.files_to_touch ?? []
    };
  });
}

// Decision ids that match no finding are a contract violation worth reporting.
export function unmatchedDecisionIds(findings, decisions) {
  const known = new Set(findings.map((f) => f.id));
  return (decisions ?? []).map((d) => d.id).filter((id) => !known.has(id));
}

export function summarize(findings) {
  const count = (predicate) => findings.filter(predicate).length;
  return {
    total: findings.length,
    confirmed: count((f) => f.status === "confirmed"),
    rejected: count((f) => f.status === "rejected"),
    needs_human: count((f) => f.status === "needs-human"),
    by_severity: Object.fromEntries(
      Object.keys(SEVERITY_RANK).map((severity) => [severity, count((f) => f.severity === severity && f.status !== "rejected")])
    )
  };
}
