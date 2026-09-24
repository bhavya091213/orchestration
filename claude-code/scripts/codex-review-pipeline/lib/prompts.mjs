import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const PROMPTS_DIR = path.join(ROOT, "prompts");
export const SCHEMAS_DIR = path.join(ROOT, "schemas");

export function schemaPath(fileName) {
  return path.join(SCHEMAS_DIR, fileName);
}

// Fill {{PLACEHOLDER}} tokens. Missing keys are left as an explicit marker so a
// template bug is visible in the prompt instead of silently blank.
export function renderPrompt(fileName, vars) {
  const template = readFileSync(path.join(PROMPTS_DIR, fileName), "utf8");
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : `[[missing:${key}]]`
  );
}
