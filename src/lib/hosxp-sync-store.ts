import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { serverEnv } from "@/lib/server-env";

export type HosxpSyncRecord = {
  hn: string;
  name?: string;
  test_date?: string;
  lab_code?: string;
  lab_name?: string;
  lab_result?: string;
  hbsag?: string;
  hcvAb?: string;
  hcvVL?: string;
  rapid_hbv_result?: string;
  rapid_hcv_result?: string;
  needs_followup?: boolean;
  source?: string;
};

export type HosxpSyncPayload = {
  version: 1;
  syncedAt: string;
  source: string;
  dateFrom?: string;
  dateTo?: string;
  records: HosxpSyncRecord[];
};

function storePath() {
  const configured = serverEnv("HEPA_HOSXP_SYNC_PATH");
  if (configured) return resolve(configured);
  const agentPath = serverEnv("HEPA_AGENT_STORE_PATH") || "data/hepa-agent-store.json";
  return resolve(dirname(resolve(agentPath)), "hosxp-sync.json");
}

export function readHosxpSync(): HosxpSyncPayload | null {
  const path = storePath();
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as HosxpSyncPayload;
  } catch {
    return null;
  }
}

export function writeHosxpSync(payload: HosxpSyncPayload) {
  const path = storePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(payload, null, 2), "utf8");
}

export function isHosxpSyncFresh(maxAgeMs = Number(serverEnv("HEPA_HOSXP_SYNC_MAX_AGE_MS") || 86_400_000)) {
  const sync = readHosxpSync();
  if (!sync?.syncedAt) return false;
  return Date.now() - new Date(sync.syncedAt).getTime() < maxAgeMs;
}

function positiveValue(value?: string | null) {
  const text = (value || "").toLowerCase();
  return ["positive", "reactive", "detected", "pos", "+", "พบ", "บวก"].some((n) => text.includes(n));
}

function normalizeIncomingRecord(raw: Record<string, unknown>): HosxpSyncRecord {
  const labResult = String(raw.lab_result ?? raw.lab_order_result ?? "");
  const labName = String(raw.lab_name ?? raw.lab_items_name_ref ?? "").toLowerCase();
  const hn = String(raw.hn ?? raw.patient_hn ?? "");
  const testDate = String(raw.test_date ?? raw.report_date ?? raw.order_date ?? raw.date ?? "");

  const record: HosxpSyncRecord = {
    hn,
    name: raw.name ? String(raw.name) : undefined,
    test_date: testDate || undefined,
    lab_code: raw.lab_code ? String(raw.lab_code) : undefined,
    lab_name: raw.lab_name ? String(raw.lab_name) : undefined,
    lab_result: labResult || undefined,
    needs_followup: Boolean(raw.needs_followup) || positiveValue(labResult),
    source: raw.source ? String(raw.source) : "hosxp_sync",
  };

  if (labName.includes("hbsag") || String(raw.lab_code || "").toUpperCase().includes("HB")) {
    record.hbsag = positiveValue(labResult) ? "Positive" : "Negative";
    record.rapid_hbv_result = record.hbsag;
  }
  if (labName.includes("hcv") || labName.includes("anti-hcv")) {
    record.hcvAb = positiveValue(labResult) ? "Positive" : "Negative";
    record.rapid_hcv_result = record.hcvAb;
  }
  if (labName.includes("rna") || labName.includes("viral load")) {
    record.hcvVL = positiveValue(labResult) ? "Detected" : "Not Detected";
  }

  if (raw.hbsag) record.hbsag = String(raw.hbsag);
  if (raw.hcvAb) record.hcvAb = String(raw.hcvAb);
  if (raw.hcvVL) record.hcvVL = String(raw.hcvVL);
  if (raw.rapid_hbv_result) record.rapid_hbv_result = String(raw.rapid_hbv_result);
  if (raw.rapid_hcv_result) record.rapid_hcv_result = String(raw.rapid_hcv_result);

  return record;
}

export function mergeHosxpSyncRecords(records: Array<Record<string, unknown>>, meta: {
  source: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const normalized = records.map(normalizeIncomingRecord).filter((r) => r.hn);
  const payload: HosxpSyncPayload = {
    version: 1,
    syncedAt: new Date().toISOString(),
    source: meta.source,
    dateFrom: meta.dateFrom,
    dateTo: meta.dateTo,
    records: normalized,
  };
  writeHosxpSync(payload);
  return payload;
}

export function getSyncedResultsForDate(date: string): HosxpSyncRecord[] {
  const sync = readHosxpSync();
  if (!sync?.records?.length) return [];
  return sync.records.filter((r) => !r.test_date || r.test_date.startsWith(date));
}

export function getSyncedPositiveResults(date: string) {
  return getSyncedResultsForDate(date).filter(
    (r) =>
      r.needs_followup ||
      r.hbsag === "Positive" ||
      r.rapid_hbv_result === "Positive" ||
      r.hcvAb === "Positive" ||
      r.rapid_hcv_result === "Positive" ||
      r.hcvVL === "Detected",
  );
}