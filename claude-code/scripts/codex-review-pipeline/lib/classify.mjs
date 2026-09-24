// Pure classification of Codex failure text. Kept free of I/O so it is trivially
// unit-testable and reusable by the runner agent if it ever needs to re-classify
// a stored log.

const PATTERNS = Object.freeze([
  {
    kind: "rate-limit",
    fallback: true,
    re: /\b429\b|usage[_ -]?limit|rate[_ -]?limit|too many requests|insufficient_quota|\bquota\b|hit your (usage )?limit|reached your (usage |plan )?limit|out of credits|plan limit|usage.*(depleted|exhausted)|try again (later|in)/i
  },
  {
    kind: "auth",
    fallback: true,
    re: /\b401\b|\b403\b|unauthori[sz]ed|not logged in|unauthenticated|login required|invalid (api[_ ]key|token)|authentication (failed|required)|please (run )?`?codex login/i
  },
  {
    kind: "unavailable",
    fallback: true,
    re: /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|EAI_AGAIN|\b50[234]\b|service unavailable|bad gateway|gateway timeout|network error|failed to connect|connection (refused|reset)|command not found|ENOENT|spawn .* failed/i
  },
  {
    kind: "config",
    fallback: true,
    re: /model .*not (supported|found)|not supported when using codex|model metadata .*not found|unsupported (model|reasoning)|invalid_request_error|unknown (model|option|argument)/i
  }
]);

export function classifyFailure(text) {
  const haystack = String(text ?? "");
  if (!haystack.trim()) {
    return { kind: "unknown", fallback: false };
  }
  const match = PATTERNS.find((entry) => entry.re.test(haystack));
  return match ? { kind: match.kind, fallback: match.fallback } : { kind: "unknown", fallback: false };
}

// "timeout" and "malformed" are produced by the exec/stage layer, not by text
// matching, but they also mean Codex did not deliver a usable result.
const NON_TEXT_FALLBACK_KINDS = new Set(["timeout", "malformed"]);

export function isFallbackKind(kind) {
  return PATTERNS.some((entry) => entry.kind === kind && entry.fallback) || NON_TEXT_FALLBACK_KINDS.has(kind);
}
