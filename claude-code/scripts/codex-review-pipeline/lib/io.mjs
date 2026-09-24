import { mkdirSync, writeFileSync, readFileSync, existsSync, appendFileSync } from "node:fs";
import path from "node:path";

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeJson(file, data) {
  ensureDir(path.dirname(file));
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return file;
}

export function writeText(file, text) {
  ensureDir(path.dirname(file));
  writeFileSync(file, text, "utf8");
  return file;
}

export function readJson(file) {
  if (!existsSync(file)) throw new Error(`Missing file: ${file}`);
  return JSON.parse(readFileSync(file, "utf8"));
}

// status.json always reflects the most recent stage; events.log is append-only
// so a run that spans several invocations stays reconstructible.
export function recordStatus(outDir, status) {
  const stamped = { ...status, recorded_at: new Date().toISOString() };
  writeJson(path.join(outDir, "status.json"), stamped);
  appendFileSync(path.join(outDir, "events.log"), `${JSON.stringify(stamped)}\n`, "utf8");
  return stamped;
}
