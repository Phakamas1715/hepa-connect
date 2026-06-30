import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { isHosxpSyncFresh, readHosxpSync } from "@/lib/hosxp-sync-store";
import { resolveHosxpProxyUrl } from "@/lib/hosxp-proxy-url";
import { serverEnv } from "@/lib/server-env";
import { getKumhosHosxpProxyStatus } from "@/lib/kumhos-client";

export type HealthState = "ready" | "partial" | "blocked";

export type HealthProbe = {
  checkedAt: string;
  state: HealthState;
  ok: boolean;
  detail: string;
  latencyMs: number;
};

export type AutomationHealthCache = {
  version: 1;
  updatedAt: string;
  hosxpBridge?: HealthProbe;
  hepatitisFeed?: HealthProbe;
  kumhos?: HealthProbe;
};

const CACHE_TTL_MS = Number(serverEnv("HEPA_AUTOMATION_HEALTH_TTL_MS") || 300_000);
const BRIDGE_TIMEOUT_MS = Number(serverEnv("HEPA_HOSXP_BRIDGE_TIMEOUT_MS") || 4_000);
const KUMHOS_TIMEOUT_MS = Number(serverEnv("HEPA_KUMHOS_TIMEOUT_MS") || 6_000);

function cachePath() {
  const configured = serverEnv("HEPA_AUTOMATION_HEALTH_PATH");
  if (configured) return resolve(configured);
  const storePath = serverEnv("HEPA_AGENT_STORE_PATH") || "data/hepa-agent-store.json";
  return resolve(dirname(resolve(storePath)), "automation-health.json");
}

function readCacheFile(): AutomationHealthCache | null {
  const path = cachePath();
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as AutomationHealthCache;
  } catch {
    return null;
  }
}

export function writeHealthCache(cache: AutomationHealthCache) {
  const path = cachePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(cache, null, 2), "utf8");
}

export function isProbeFresh(probe?: HealthProbe, ttlMs = CACHE_TTL_MS) {
  if (!probe?.checkedAt) return false;
  return Date.now() - new Date(probe.checkedAt).getTime() < ttlMs;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function probeHosxpBridge(): Promise<HealthProbe> {
  const started = Date.now();
  const proxyUrl = resolveHosxpProxyUrl();
  if (!proxyUrl) {
    return {
      checkedAt: new Date().toISOString(),
      state: "blocked",
      ok: false,
      detail: "ยังไม่ได้ตั้ง HEPA_HOSXP_PROXY_URL หรือ HEPA_HOSXP_PROXY_PUBLIC_URL",
      latencyMs: Date.now() - started,
    };
  }

  const url = new URL(proxyUrl);
  url.searchParams.set("action", "status");
  const token = serverEnv("HEPA_HOSXP_PROXY_TOKEN");

  try {
    const response = await withTimeout(
      fetch(url, {
        headers: {
          Accept: "application/json",
          ...(token ? { "X-HEPAGLUE-TOKEN": token } : {}),
        },
        signal: AbortSignal.timeout(BRIDGE_TIMEOUT_MS),
      }),
      BRIDGE_TIMEOUT_MS + 500,
      `HOSxP bridge timeout หลัง ${BRIDGE_TIMEOUT_MS}ms`,
    );
    const payload = (await response.json().catch(() => null)) as null | {
      ok?: boolean;
      error?: string;
      mysql_version?: string;
    };

    if (!response.ok || !payload?.ok) {
      return {
        checkedAt: new Date().toISOString(),
        state: "blocked",
        ok: false,
        detail: `bridge ตอบ ${response.status}: ${payload?.error || "ไม่สำเร็จ"}`,
        latencyMs: Date.now() - started,
      };
    }

    return {
      checkedAt: new Date().toISOString(),
      state: "ready",
      ok: true,
      detail: `เชื่อม HOSxP bridge ได้ (MySQL ${payload.mysql_version || "ok"})`,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "fetch failed";
    if (isHosxpSyncFresh()) {
      const sync = readHosxpSync();
      return {
        checkedAt: new Date().toISOString(),
        state: "ready",
        ok: true,
        detail: `ใช้ hospital push cache แทน (${sync?.records?.length || 0} records, synced ${sync?.syncedAt})`,
        latencyMs: Date.now() - started,
      };
    }
    const isPrivateLan = /172\.|192\.168\.|10\./.test(proxyUrl);
    return {
      checkedAt: new Date().toISOString(),
      state: "blocked",
      ok: false,
      detail: isPrivateLan
        ? `${message} — ใช้ deploy/hospital-push-to-vps.php บน Laragon (push ออกมา VPS) หรือ tunnel`
        : message,
      latencyMs: Date.now() - started,
    };
  }
}

export async function probeHepatitisFeed(): Promise<HealthProbe> {
  const started = Date.now();
  const proxyUrl = resolveHosxpProxyUrl();
  if (!proxyUrl) {
    return {
      checkedAt: new Date().toISOString(),
      state: "blocked",
      ok: false,
      detail: "ยังไม่ได้ตั้ง proxy URL สำหรับดึง lab hepatitis",
      latencyMs: Date.now() - started,
    };
  }

  const url = new URL(proxyUrl);
  url.searchParams.set("action", "hepatitis_labs");
  url.searchParams.set("limit", "1");
  const token = serverEnv("HEPA_HOSXP_PROXY_TOKEN");

  try {
    const response = await withTimeout(
      fetch(url, {
        headers: {
          Accept: "application/json",
          ...(token ? { "X-HEPAGLUE-TOKEN": token } : {}),
        },
        signal: AbortSignal.timeout(BRIDGE_TIMEOUT_MS),
      }),
      BRIDGE_TIMEOUT_MS + 500,
      `Hepatitis feed timeout หลัง ${BRIDGE_TIMEOUT_MS}ms`,
    );
    const payload = (await response.json().catch(() => null)) as null | {
      ok?: boolean;
      count?: number;
      error?: string;
    };

    if (response.ok && payload?.ok) {
      return {
        checkedAt: new Date().toISOString(),
        state: "ready",
        ok: true,
        detail: `ดึง HBsAg/Anti-HCV/HCV RNA ผ่าน bridge ได้ (${payload.count ?? 0} preview)`,
        latencyMs: Date.now() - started,
      };
    }
  } catch {
    // Fall through to KUMHOS probe.
  }

  try {
    const kumhos = await withTimeout(
      getKumhosHosxpProxyStatus(),
      KUMHOS_TIMEOUT_MS,
      `KUMHOS timeout หลัง ${KUMHOS_TIMEOUT_MS}ms`,
    );
    return {
      checkedAt: new Date().toISOString(),
      state: "ready",
      ok: true,
      detail: `KUMHOS pull สำเร็จ; lab codes ${Object.values(kumhos.codes).join(", ") || "-"}`,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    if (isHosxpSyncFresh()) {
      const sync = readHosxpSync();
      const positives = (sync?.records || []).filter((r) => r.needs_followup).length;
      return {
        checkedAt: new Date().toISOString(),
        state: "ready",
        ok: true,
        detail: `ใช้ข้อมูล push จากโรงพยาบาล (${sync?.records?.length || 0} records, ${positives} follow-up)`,
        latencyMs: Date.now() - started,
      };
    }
    return {
      checkedAt: new Date().toISOString(),
      state: "blocked",
      ok: false,
      detail: error instanceof Error ? error.message : "ดึง lab hepatitis ไม่สำเร็จ",
      latencyMs: Date.now() - started,
    };
  }
}

export async function probeKumhos(): Promise<HealthProbe> {
  const started = Date.now();
  try {
    const kumhos = await withTimeout(
      getKumhosHosxpProxyStatus(),
      KUMHOS_TIMEOUT_MS,
      `KUMHOS/HOSxP proxy timeout หลัง ${KUMHOS_TIMEOUT_MS}ms`,
    );
    return {
      checkedAt: new Date().toISOString(),
      state: "ready",
      ok: true,
      detail: `KUMHOS login/query สำเร็จ; test lab codes ${Object.values(kumhos.codes).join(", ") || "-"}`,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return {
      checkedAt: new Date().toISOString(),
      state: "blocked",
      ok: false,
      detail: error instanceof Error ? error.message : "KUMHOS proxy ไม่พร้อม",
      latencyMs: Date.now() - started,
    };
  }
}

export async function refreshAutomationHealthCache(): Promise<AutomationHealthCache> {
  const [hosxpBridge, hepatitisFeed, kumhos] = await Promise.all([
    probeHosxpBridge(),
    probeHepatitisFeed(),
    probeKumhos(),
  ]);

  const cache: AutomationHealthCache = {
    version: 1,
    updatedAt: new Date().toISOString(),
    hosxpBridge,
    hepatitisFeed,
    kumhos,
  };
  writeHealthCache(cache);
  return cache;
}

export function readAutomationHealthCache() {
  return readCacheFile();
}

let refreshInFlight: Promise<AutomationHealthCache> | null = null;

export function scheduleAutomationHealthRefresh(force = false) {
  const cache = readCacheFile();
  if (!force && cache && isProbeFresh({ checkedAt: cache.updatedAt, state: "ready", ok: true, detail: "", latencyMs: 0 })) {
    return;
  }
  if (refreshInFlight) return;
  refreshInFlight = refreshAutomationHealthCache()
    .catch((error) => {
      console.error("[automation-health] refresh failed", error);
      return readCacheFile() || {
        version: 1 as const,
        updatedAt: new Date().toISOString(),
      };
    })
    .finally(() => {
      refreshInFlight = null;
    });
}

export function probeToGate(id: string, name: string, probe: HealthProbe, required = true) {
  return {
    id,
    name,
    state: probe.state,
    detail: `${probe.detail} (${probe.latencyMs}ms, checked ${probe.checkedAt})`,
    required,
  };
}