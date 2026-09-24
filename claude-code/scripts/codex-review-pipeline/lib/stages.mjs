import path from "node:path";
import { spawnSync } from "node:child_process";
import { STAGES, LIMITS, EXIT } from "./config.mjs";
import { collectScope, renderScope } from "./git-scope.mjs";
import { renderPrompt, schemaPath } from "./prompts.mjs";
import { runCodex, parseStructuredOutput } from "./codex-exec.mjs";
import { assignIds, sortBySeverity, partitionFindings, mergeDecisions, summarize, unmatchedDecisionIds } from "./findings.mjs";
import { isFallbackKind } from "./classify.mjs";
import { writeJson, writeText, readJson, recordStatus, ensureDir } from "./io.mjs";

export const FILES = Object.freeze({
  hunt: "01-hunt.json",
  adjudicated: "02-adjudicated.json",
  adjudicatedMd: "02-adjudicated.md",
  fixesDir: "fixes"
});

function stageSpec(stage, cwd, outDir, suffix = "") {
  return {
    model: stage.model,
    effort: stage.effort,
    sandbox: stage.sandbox,
    ephemeral: stage.ephemeral,
    cwd,
    schemaFile: stage.schema ? schemaPath(stage.schema) : null,
    lastMessageFile: path.join(outDir, `${stage.name}${suffix}.last.txt`)
  };
}

function failed(outDir, stage, outcome, extra = {}) {
  const status = recordStatus(outDir, {
    stage: stage.name,
    ok: false,
    fallback: outcome.fallback,
    kind: outcome.kind,
    model: stage.model,
    effort: stage.effort,
    errors: outcome.errors.slice(0, 5),
    diagnostics: outcome.diagnostics ?? null,
    ...extra
  });
  return { exitCode: isFallbackKind(outcome.kind) ? EXIT.FALLBACK : EXIT.ERROR, status };
}

function succeeded(outDir, stage, outcome, extra = {}) {
  const status = recordStatus(outDir, {
    stage: stage.name,
    ok: true,
    fallback: false,
    kind: null,
    model: stage.model,
    effort: stage.effort,
    usage: outcome.usage,
    diagnostics: outcome.diagnostics ?? null,
    ...extra
  });
  return { exitCode: EXIT.OK, status };
}

export async function hunt({ cwd, outDir, base, focus }) {
  const stage = STAGES.hunt;
  ensureDir(outDir);
  const scope = collectScope(cwd, { base, maxDiffBytes: LIMITS.maxDiffBytes });
  if (scope.isEmpty) {
    const status = recordStatus(outDir, { stage: stage.name, ok: false, fallback: false, kind: "empty", empty: true, scope: scope.label, message: "Nothing to review in the selected scope. NOT REVIEWED — confirm the scope/base before proceeding." });
    return { exitCode: EXIT.EMPTY, status };
  }
  const prompt = renderPrompt(stage.prompt, { USER_FOCUS: focus || "(none)", REVIEW_INPUT: renderScope(scope) });
  const outcome = await runCodex({ prompt, ...stageSpec(stage, cwd, outDir) });
  if (!outcome.ok) return failed(outDir, stage, outcome);

  let parsed;
  try {
    parsed = parseStructuredOutput(outcome.lastMessage);
  } catch (error) {
    return failed(outDir, stage, { ...outcome, kind: "malformed", fallback: true, errors: [error.message] });
  }
  const findings = sortBySeverity(assignIds(parsed.findings));
  const file = writeJson(path.join(outDir, FILES.hunt), { ...parsed, findings, scope: { label: scope.label, truncated: scope.truncated, bytes: scope.bytes } });
  return succeeded(outDir, stage, outcome, { verdict: parsed.verdict, findings: findings.length, file });
}

function renderAdjudicatedMarkdown(data) {
  const lines = [`# Codex review — adjudicated findings`, "", `Verdict (hunter): **${data.verdict}**`, "", data.summary, ""];
  if (data.adjudication_summary) lines.push(`Adjudicator: ${data.adjudication_summary}`, "");
  for (const f of data.findings) {
    lines.push(
      `## ${f.id} — ${f.title}`,
      `- status: **${f.status}** (by ${f.decided_by}) · severity: ${f.severity} · confidence: ${f.confidence} · complexity: ${f.complexity}`,
      `- location: \`${f.file}:${f.line_start}-${f.line_end}\``,
      `- risk: ${f.body}`,
      ...(f.adjudication_rationale ? [`- adjudication: ${f.adjudication_rationale}`] : []),
      `- fix plan: ${f.fix_plan || "(none)"}`,
      ""
    );
  }
  return lines.join("\n");
}

export async function adjudicate({ cwd, outDir, base, focus, all = false, findingsFile }) {
  const stage = STAGES.adjudicate;
  const huntData = readJson(findingsFile || path.join(outDir, FILES.hunt));
  const findings = assignIds(huntData.findings);
  const { toAdjudicate, autoConfirmed } = partitionFindings(findings, { autoConfirmConfidence: LIMITS.autoConfirmConfidence, all });

  let decisions = [];
  let adjudicationSummary = null;
  let outcome = { usage: null };
  if (toAdjudicate.length > 0) {
    const scope = collectScope(cwd, { base, maxDiffBytes: LIMITS.maxDiffBytes });
    const prompt = renderPrompt(stage.prompt, {
      USER_FOCUS: focus || "(none)",
      FINDINGS_JSON: JSON.stringify(toAdjudicate, null, 2),
      REVIEW_INPUT: renderScope(scope)
    });
    outcome = await runCodex({ prompt, ...stageSpec(stage, cwd, outDir) });
    if (!outcome.ok) return failed(outDir, stage, outcome, { pending: toAdjudicate.map((f) => f.id) });
    try {
      const parsed = parseStructuredOutput(outcome.lastMessage);
      decisions = parsed.decisions;
      adjudicationSummary = parsed.summary;
    } catch (error) {
      return failed(outDir, stage, { ...outcome, kind: "malformed", fallback: true, errors: [error.message] });
    }
  }

  const sentIds = toAdjudicate.map((f) => f.id);
  const merged = sortBySeverity(mergeDecisions(findings, decisions, sentIds));
  const unmatched = unmatchedDecisionIds(findings, decisions);
  const missing = sentIds.filter((id) => !decisions.some((d) => d.id === id));
  const data = { ...huntData, findings: merged, adjudication_summary: adjudicationSummary, counts: summarize(merged), adjudication_gaps: { missing_decisions: missing, unmatched_decisions: unmatched } };
  const file = writeJson(path.join(outDir, FILES.adjudicated), data);
  writeText(path.join(outDir, FILES.adjudicatedMd), renderAdjudicatedMarkdown(data));
  return succeeded(outDir, stage, outcome, { adjudicated: toAdjudicate.length, auto_confirmed: autoConfirmed.length, counts: data.counts, adjudication_gaps: data.adjudication_gaps, file });
}

export async function implement({ cwd, outDir, findingId, force = false }) {
  const stage = STAGES.implement;
  const data = readJson(path.join(outDir, FILES.adjudicated));
  const finding = data.findings.find((f) => f.id === findingId);
  if (!finding) throw new Error(`No finding with id ${findingId} in ${FILES.adjudicated}.`);
  if (finding.status === "rejected") throw new Error(`${findingId} was rejected by the adjudicator; refusing to implement.`);
  if (finding.status === "needs-human" && !force) {
    throw new Error(`${findingId} needs a human decision. Re-run with --force after the user has decided, and put the decision in the fix plan.`);
  }
  const prompt = renderPrompt(stage.prompt, { FINDING_JSON: JSON.stringify(finding, null, 2), FINDING_ID: finding.id });
  const outcome = await runCodex({ prompt, ...stageSpec(stage, cwd, outDir, `-${finding.id}`) });
  const status = spawnSync("git", ["status", "--short"], { cwd, encoding: "utf8" });
  const statusFailed = Boolean(status.error) || status.status !== 0;
  const changed = statusFailed ? "" : status.stdout ?? "";
  const dirtyFiles = changed.trim().split("\n").filter(Boolean);
  const treeNote = statusFailed ? `(git status failed: ${status.error?.message ?? status.stderr})` : changed.trim() || "(clean)";
  const report = [outcome.lastMessage.trim() || "(Codex returned no report)", "", "### Working tree after fix (git status --short)", "```", treeNote, "```", ""].join("\n");
  const file = writeText(path.join(outDir, FILES.fixesDir, `fix-${finding.id}.md`), report);
  const tree = { dirty_files: dirtyFiles, git_status_failed: statusFailed };
  if (!outcome.ok) {
    // A killed or failed implement run may have left partial edits behind.
    // Surface them so the orchestrator inspects/reverts before any fallback.
    return failed(outDir, stage, outcome, { finding: finding.id, file, ...tree, partial_edits_possible: dirtyFiles.length > 0 });
  }
  return succeeded(outDir, stage, outcome, { finding: finding.id, file, changed_files: dirtyFiles.length, ...tree });
}
