import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const envCache = new Map<string, string>();
let loaded = false;

function loadLocalEnv() {
  if (loaded) return;
  loaded = true;

  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.replace(/^\uFEFF/, "").trim();
    if (!line || line.startsWith("#")) continue;
    const equalsAt = line.indexOf("=");
    if (equalsAt <= 0) continue;

    const key = line.slice(0, equalsAt).trim();
    let value = line.slice(equalsAt + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    envCache.set(key, value);
  }
}

export function serverEnv(key: string) {
  loadLocalEnv();
  return process.env[key] || envCache.get(key) || "";
}
