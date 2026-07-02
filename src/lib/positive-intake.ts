import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { audit, readAgentStore, writeAgentStore } from "@/lib/hepa-agent-store";
import { HEPA_PRIMARY_CARE_UNITS } from "@/lib/hepa-service-area";
import { serverEnv } from "@/lib/server-env";

export type PositiveIntakeStatus = "new" | "agent_queued" | "contacted" | "closed";

export type PositiveIntakeInput = {
  fullName: string;
  testFacilityCode: string;
  testFacilityName?: string;
  positiveResult?: string;
  consentAccepted?: boolean;
  lineUserId?: string;
  lineDisplayName?: string;
};

export type PositiveIntakeRecord = {
  id: string;
  caseCode: string;
  fullName: string;
  testFacilityCode: string;
  testFacilityName: string;
  positiveResult: string;
  status: PositiveIntakeStatus;
  consentAccepted: true;
  consentAcceptedAt: string;
  consentNoticeVersion: string;
  lineUserId?: string;
  lineDisplayName?: string;
  agentTaskId?: string;
  createdAt: string;
  updatedAt: string;
};

type PositiveIntakeStore = {
  records: PositiveIntakeRecord[];
};

export const POSITIVE_INTAKE_CONSENT_NOTICE_VERSION = "pdpa-positive-intake-v1-2026-07-01";

const POSITIVE_RESULT_OPTIONS = [
  "ผลบวกไวรัสตับอักเสบบี (HBsAg)",
  "ผลบวกไวรัสตับอักเสบซี (Anti-HCV)",
  "ตรวจพบเชื้อไวรัสตับอักเสบซี (HCV RNA)",
  "ไม่แน่ใจ / รอผลยืนยัน",
];

const LEGACY_POSITIVE_RESULTS: Record<string, string> = {
  "HBsAg positive": POSITIVE_RESULT_OPTIONS[0],
  "Anti-HCV positive": POSITIVE_RESULT_OPTIONS[1],
  "HCV RNA detected": POSITIVE_RESULT_OPTIONS[2],
  "ไม่แน่ใจ/รอเจ้าหน้าที่ตรวจสอบ": POSITIVE_RESULT_OPTIONS[3],
};

export function getPositiveResultOptions() {
  return POSITIVE_RESULT_OPTIONS;
}

export function getPositiveIntakeFacilities() {
  return HEPA_PRIMARY_CARE_UNITS.map((unit) => ({
    code: unit.code,
    name: unit.unitName,
  }));
}

function storePath() {
  return (
    serverEnv("HEPA_POSITIVE_INTAKE_STORE_PATH") ||
    resolve(process.cwd(), "data", "positive-intake.json")
  );
}

function emptyStore(): PositiveIntakeStore {
  return { records: [] };
}

function nowIso() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

function caseCode() {
  return `POS-NP-${Math.floor(100000 + Math.random() * 900000)}`;
}

function cleanText(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function readStore(): PositiveIntakeStore {
  const path = storePath();
  if (!existsSync(path)) return emptyStore();
  return { ...emptyStore(), ...JSON.parse(readFileSync(path, "utf8")) };
}

function writeStore(store: PositiveIntakeStore) {
  const path = storePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(store, null, 2), "utf8");
}

function resolveFacility(code: string, fallbackName?: string) {
  const found = getPositiveIntakeFacilities().find((item) => item.code === code);
  if (found) return found.name;
  return cleanText(fallbackName);
}

function normalizePositiveResult(value: unknown) {
  const result = cleanText(value);
  if (!result) return POSITIVE_RESULT_OPTIONS[3];
  return LEGACY_POSITIVE_RESULTS[result] || result;
}

function assertValidInput(input: PositiveIntakeInput) {
  if (!cleanText(input.fullName)) throw new Error("กรุณาระบุชื่อ-นามสกุล");
  if (!cleanText(input.testFacilityCode)) throw new Error("กรุณาเลือกสถานบริการที่ตรวจ");
  if (resolveFacility(cleanText(input.testFacilityCode), input.testFacilityName) === "") {
    throw new Error("ไม่พบสถานบริการที่ตรวจ");
  }
  if (input.consentAccepted !== true) {
    throw new Error("กรุณายินยอมการใช้ข้อมูลส่วนบุคคลตาม PDPA ก่อนส่งข้อมูล");
  }
}

export function getPositiveIntakeSummary() {
  const store = readStore();
  const records = [...store.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const active = records.filter((item) => item.status !== "closed");
  return {
    checkedAt: nowIso(),
    storePath: storePath(),
    total: records.length,
    active: active.length,
    newCount: records.filter((item) => item.status === "new").length,
    agentQueued: records.filter((item) => item.status === "agent_queued").length,
    contacted: records.filter((item) => item.status === "contacted").length,
    closed: records.filter((item) => item.status === "closed").length,
    facilities: getPositiveIntakeFacilities(),
    resultOptions: getPositiveResultOptions(),
    records,
  };
}

export function createPositiveIntake(input: PositiveIntakeInput) {
  assertValidInput(input);
  const store = readStore();
  const createdAt = nowIso();
  const code = caseCode();
  const fullName = cleanText(input.fullName);
  const testFacilityCode = cleanText(input.testFacilityCode);
  const testFacilityName = resolveFacility(testFacilityCode, input.testFacilityName);
  const positiveResult = normalizePositiveResult(input.positiveResult);

  const agentStore = readAgentStore();
  const task = {
    id: id("task"),
    hn: code,
    type: "staff_escalation" as const,
    status: "pending" as const,
    persona: "positive_intake",
    lineUserId: input.lineUserId,
    message: `ผู้พบเชื้อยืนยันข้อมูลผ่าน LIFF: ${fullName} · สถานบริการที่ตรวจ ${testFacilityName} · ผล ${positiveResult}`,
    createdAt,
    updatedAt: createdAt,
  };
  agentStore.tasks.unshift(task);
  audit(agentStore, {
    actor: "system",
    action: "positive_intake_created",
    hn: code,
    detail: task.message,
  });
  writeAgentStore(agentStore);

  const record: PositiveIntakeRecord = {
    id: id("pos"),
    caseCode: code,
    fullName,
    testFacilityCode,
    testFacilityName,
    positiveResult,
    status: "agent_queued",
    consentAccepted: true,
    consentAcceptedAt: createdAt,
    consentNoticeVersion: POSITIVE_INTAKE_CONSENT_NOTICE_VERSION,
    lineUserId: input.lineUserId ? cleanText(input.lineUserId) : undefined,
    lineDisplayName: input.lineDisplayName ? cleanText(input.lineDisplayName) : undefined,
    agentTaskId: task.id,
    createdAt,
    updatedAt: createdAt,
  };

  store.records.unshift(record);
  writeStore(store);
  return { record, task };
}

export function updatePositiveIntakeStatus(idOrCode: string, status: PositiveIntakeStatus) {
  const store = readStore();
  const record = store.records.find((item) => item.id === idOrCode || item.caseCode === idOrCode);
  if (!record) throw new Error("ไม่พบรายการผู้พบเชื้อ");
  record.status = status;
  record.updatedAt = nowIso();
  writeStore(store);

  const agentStore = readAgentStore();
  const task = agentStore.tasks.find((item) => item.id === record.agentTaskId);
  if (task) {
    task.status = status === "closed" ? "closed" : status === "contacted" ? "contacted" : "pending";
    task.updatedAt = record.updatedAt;
  }
  audit(agentStore, {
    actor: "staff",
    action: "positive_intake_status_updated",
    hn: record.caseCode,
    detail: `เปลี่ยนสถานะเป็น ${status}${task ? ` · ซิงก์ task ${task.id}` : ""}`,
  });
  writeAgentStore(agentStore);

  return record;
}
