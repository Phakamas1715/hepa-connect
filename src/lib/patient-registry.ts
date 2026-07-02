import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PREPARED_PATIENTS, type Patient, type Persona } from "@/lib/hepa-data";
import { serverEnv } from "@/lib/server-env";

type PatientRegistryStore = {
  upserts: Patient[];
  deletedHns: string[];
  googleSheetPatients: Patient[];
  lastGoogleSyncAt?: string;
  lastGoogleSyncError?: string;
};

const PERSONAS: Persona[] = [
  "The Forgetful",
  "The Fearful",
  "The Denier",
  "The Engaged",
  "The Striver",
];

const DEFAULT_PATIENT_ROSTER_SHEET_ID = "1vvx-UIaeoMQn1e4prFKOw0xY0ggpTx6AR8-y900ADXM";

const PATIENT_ROSTER_SHEETS: Array<{
  code: string;
  sheetName: string;
  subdistrict?: string;
}> = [
  { code: "PT", sheetName: "รพ.สต.พังทุย", subdistrict: "พังทุย" },
  { code: "NK", sheetName: "รพ.สต.หนองกุง", subdistrict: "หนองกุง" },
  { code: "KS", sheetName: "รพ.สต.กุดน้ำใส", subdistrict: "กุดน้ำใส" },
  { code: "BK", sheetName: "รพ.สต.บ้านขาม", subdistrict: "บ้านขาม" },
  { code: "BY", sheetName: "รพ.สต.บัวใหญ่", subdistrict: "บัวใหญ่" },
  { code: "KB", sheetName: "รพ.สต.บ้านคำบง", subdistrict: "สะอาด" },
  { code: "WC", sheetName: "รพ.สต.วังชัย", subdistrict: "วังชัย" },
  { code: "MW", sheetName: "รพ.สต.ม่วงหวาน", subdistrict: "ม่วงหวาน" },
  { code: "BN", sheetName: "รพ.สต.บัวเงิน", subdistrict: "บัวเงิน" },
  { code: "NP", sheetName: "รพ.สต.น้ำพอง", subdistrict: "น้ำพอง" },
  { code: "TK", sheetName: "รพ.สต.ท่ากระเสริม", subdistrict: "ท่ากระเสริม" },
  { code: "NS", sheetName: "รพ.สต.นาศรี", subdistrict: "สะอาด" },
  { code: "SM", sheetName: "รพ.สต.ทรายมูล", subdistrict: "ทรายมูล" },
  { code: "KY", sheetName: "รพ.สต.โคกใหญ่", subdistrict: "บัวเงิน" },
  { code: "KMW", sheetName: "รพ.สต.คำแก่นคูณ (เขตม่วงหวาน)", subdistrict: "ม่วงหวาน" },
  { code: "NW", sheetName: "รพ.สต.บ้านหนองหว้า", subdistrict: "ทรายมูล" },
  { code: "BL", sheetName: "รพ.สต.บ้านเหล่าใหญ่", subdistrict: "บ้านขาม" },
  { code: "TM", sheetName: "รพ.สต.บ้านท่ามะเดื่อ", subdistrict: "ท่ากระเสริม" },
  { code: "KNK", sheetName: "รพ.สต.คำแก่นคูณ (เขตหนองกุง)", subdistrict: "หนองกุง" },
];

function registryPath() {
  return serverEnv("HEPA_PATIENT_REGISTRY_PATH") || resolve(process.cwd(), "data", "patient-registry.json");
}

function nowIso() {
  return new Date().toISOString();
}

function emptyStore(): PatientRegistryStore {
  return { upserts: [], deletedHns: [], googleSheetPatients: [] };
}

export function readPatientRegistryStore(): PatientRegistryStore {
  const path = registryPath();
  if (!existsSync(path)) return emptyStore();
  return { ...emptyStore(), ...JSON.parse(readFileSync(path, "utf8")) };
}

function writePatientRegistryStore(store: PatientRegistryStore) {
  const path = registryPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(store, null, 2), "utf8");
}

function sourcePatients(store: PatientRegistryStore) {
  return store.googleSheetPatients.length ? store.googleSheetPatients : PREPARED_PATIENTS;
}

export function listPatients() {
  const store = readPatientRegistryStore();
  const rows = new Map<string, Patient>();

  for (const patient of sourcePatients(store)) {
    if (patient.hn) rows.set(patient.hn, patient);
  }
  for (const patient of store.upserts) {
    if (patient.hn) rows.set(patient.hn, patient);
  }
  for (const hn of store.deletedHns) rows.delete(hn);

  return {
    patients: Array.from(rows.values()),
    meta: {
      source: store.googleSheetPatients.length ? "google-sheet" : "prepared-list",
      preparedCount: PREPARED_PATIENTS.length,
      googleSheetCount: store.googleSheetPatients.length,
      editedCount: store.upserts.length,
      deletedCount: store.deletedHns.length,
      lastGoogleSyncAt: store.lastGoogleSyncAt,
      lastGoogleSyncError: store.lastGoogleSyncError,
      storePath: registryPath(),
    },
  };
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeResult(value: unknown) {
  const text = cleanText(value);
  if (!text) return "";
  const lower = text.toLowerCase();
  if (lower === "detected") return "Detected";
  if (lower === "not detected") return "Not Detected";
  if (["pos", "positive", "พบ", "บวก", "+"].includes(lower)) return "Positive";
  if (["neg", "negative", "ไม่พบ", "ลบ", "-"].includes(lower)) return "Negative";
  return text;
}

export function normalizePatient(input: Record<string, unknown>, existing?: Patient): Patient {
  const hn = cleanText(input.hn ?? input.HN ?? existing?.hn);
  if (!hn) throw new Error("ต้องระบุ HN");

  const persona = cleanText(input.persona ?? existing?.persona) as Persona;
  const reportedRaw = input.reported ?? existing?.reported ?? false;
  const reported =
    reportedRaw === true ||
    String(reportedRaw).toLowerCase() === "true" ||
    String(reportedRaw).trim() === "1" ||
    String(reportedRaw).trim() === "รายงานแล้ว";

  return {
    ...existing,
    hn,
    name: cleanText(input.name ?? input.fullName ?? input.patientName ?? existing?.name),
    cid: cleanText(input.cid ?? input.idNumber ?? existing?.cid),
    birth_date: cleanText(input.birth_date ?? input.birthDate ?? existing?.birth_date),
    testDate: cleanText(input.testDate ?? input.test_date ?? existing?.testDate) || nowIso().slice(0, 10),
    subdistrict: cleanText(input.subdistrict ?? input.tambon ?? existing?.subdistrict),
    village: cleanText(input.village ?? input.moo ?? existing?.village),
    rapid_hbv_result: normalizeResult(input.rapid_hbv_result ?? input.rapidHbv ?? existing?.rapid_hbv_result),
    rapid_hcv_result: normalizeResult(input.rapid_hcv_result ?? input.rapidHcv ?? existing?.rapid_hcv_result),
    hbsag: normalizeResult(input.hbsag ?? input.HBsAg ?? existing?.hbsag),
    hcvAb: normalizeResult(input.hcvAb ?? input.hcv_ab ?? input["HCV Ab"] ?? existing?.hcvAb),
    hcvVL: normalizeResult(input.hcvVL ?? input.hcv_vl ?? input["HCV RNA"] ?? existing?.hcvVL),
    persona: PERSONAS.includes(persona) ? persona : existing?.persona || "The Engaged",
    last_nudge_date: cleanText(input.last_nudge_date ?? existing?.last_nudge_date) || undefined,
    nudge_count: Number(input.nudge_count ?? existing?.nudge_count ?? 0) || 0,
    care_status: cleanText(input.care_status ?? input.careStatus ?? existing?.care_status) || "Pending",
    moph_sync_status: cleanText(input.moph_sync_status ?? existing?.moph_sync_status) || undefined,
    reported,
    txId: cleanText(input.txId ?? existing?.txId) || undefined,
    reportedAt: cleanText(input.reportedAt ?? existing?.reportedAt) || undefined,
    moph_transaction_id: cleanText(input.moph_transaction_id ?? existing?.moph_transaction_id) || undefined,
    moph_last_sync: cleanText(input.moph_last_sync ?? existing?.moph_last_sync) || undefined,
    fiscalYear: cleanText(input.fiscalYear ?? input.fiscal_year ?? existing?.fiscalYear) || undefined,
    hbsab: normalizeResult(input.hbsab ?? input.HBsAb ?? existing?.hbsab) || undefined,
    created_at: existing?.created_at || nowIso(),
    updated_at: nowIso(),
    status: cleanText(input.status ?? existing?.status) || "active",
    serviceUnitCode: cleanText(input.serviceUnitCode ?? input.service_unit_code ?? existing?.serviceUnitCode),
  };
}

export function upsertPatient(input: Record<string, unknown>) {
  const store = readPatientRegistryStore();
  const existing = listPatients().patients.find((patient) => patient.hn === cleanText(input.hn ?? input.HN));
  const patient = normalizePatient(input, existing);

  store.deletedHns = store.deletedHns.filter((hn) => hn !== patient.hn);
  store.upserts = [patient, ...store.upserts.filter((item) => item.hn !== patient.hn)];
  writePatientRegistryStore(store);
  return patient;
}

export function deletePatient(hn: string) {
  const store = readPatientRegistryStore();
  const cleanHn = cleanText(hn);
  if (!cleanHn) throw new Error("ต้องระบุ HN");
  store.upserts = store.upserts.filter((patient) => patient.hn !== cleanHn);
  if (!store.deletedHns.includes(cleanHn)) store.deletedHns.unshift(cleanHn);
  writePatientRegistryStore(store);
  return { hn: cleanHn };
}

function googleSheetCsvUrl() {
  const direct = serverEnv("GOOGLE_SHEET_CSV_URL") || serverEnv("PATIENT_GOOGLE_SHEET_CSV_URL");
  if (direct) return direct;

  const sheetId = serverEnv("GOOGLE_SHEET_ID") || serverEnv("PATIENT_GOOGLE_SHEET_ID");
  if (!sheetId) return "";
  const gid = serverEnv("GOOGLE_SHEET_GID") || serverEnv("PATIENT_GOOGLE_SHEET_GID") || "0";
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

function patientRosterWorkbookId() {
  return (
    serverEnv("GOOGLE_SHEET_ID") ||
    serverEnv("PATIENT_GOOGLE_SHEET_ID") ||
    serverEnv("HEPA_SCREENING_ROSTER_SHEET_ID") ||
    DEFAULT_PATIENT_ROSTER_SHEET_ID
  );
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((item) => item.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((item) => item.trim())) rows.push(row);
  return rows;
}

function pick(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value != null && value !== "") return value;
  }
  return "";
}

function stableRosterHn(input: { serviceUnitCode: string; rowNumber: number; cid?: string; name?: string }) {
  const seed = `${input.serviceUnitCode}|${input.rowNumber}|${input.cid || ""}|${input.name || ""}`;
  const digest = createHash("sha256").update(seed).digest("hex").slice(0, 8).toUpperCase();
  return `${input.serviceUnitCode}-${String(input.rowNumber).padStart(4, "0")}-${digest}`;
}

function mapSheetRow(row: Record<string, string>) {
  return normalizePatient({
    hn: pick(row, ["hn", "HN", "เลข HN", "รหัสผู้ป่วย"]),
    name: pick(row, ["name", "ชื่อ", "ชื่อ-สกุล", "ชื่อ-นามสกุล", "patient_name"]),
    cid: pick(row, ["cid", "เลขบัตร", "เลขบัตรประชาชน", "idNumber"]),
    birth_date: pick(row, ["birth_date", "วันเกิด", "birthDate"]),
    testDate: pick(row, ["testDate", "วันที่ตรวจ", "test_date"]),
    subdistrict: pick(row, ["subdistrict", "ตำบล", "tambon"]),
    village: pick(row, ["village", "หมู่", "หมู่ที่", "moo"]),
    serviceUnitCode: pick(row, ["serviceUnitCode", "รหัสพื้นที่", "unit_code", "รหัสหน่วยบริการ"]),
    rapid_hbv_result: pick(row, ["rapid_hbv_result", "Rapid HBV"]),
    rapid_hcv_result: pick(row, ["rapid_hcv_result", "Rapid HCV"]),
    hbsag: pick(row, ["hbsag", "HBsAg"]),
    hcvAb: pick(row, ["hcvAb", "HCV Ab", "hcv_ab"]),
    hcvVL: pick(row, ["hcvVL", "HCV RNA", "hcv_vl"]),
    persona: pick(row, ["persona"]),
    care_status: pick(row, ["care_status", "สถานะ", "careStatus"]),
    reported: pick(row, ["reported", "รายงานแล้ว"]),
    fiscalYear: pick(row, ["fiscalYear", "ปีงบ"]),
    status: pick(row, ["status"]),
  });
}

function mapRosterRow(input: {
  row: Record<string, string>;
  serviceUnitCode: string;
  sourceSheet: string;
  rowNumber: number;
  subdistrict?: string;
}) {
  const firstName = pick(input.row, ["ชื่อ", "firstname", "firstName"]);
  const lastName = pick(input.row, ["สกุล", "นามสกุล", "lastname", "lastName"]);
  const fullName =
    pick(input.row, ["name", "ชื่อ-สกุล", "ชื่อ-นามสกุล", "patient_name"]) ||
    [firstName, lastName].filter(Boolean).join(" ");
  const cid = pick(input.row, ["เลขบัตรประชาชน", "cid", "CID", "idNumber"]);
  const hn =
    pick(input.row, ["hn", "HN", "เลข HN", "รหัสผู้ป่วย"]) ||
    stableRosterHn({
      serviceUnitCode: input.serviceUnitCode,
      rowNumber: input.rowNumber,
      cid,
      name: fullName,
    });

  return normalizePatient({
    hn,
    name: fullName,
    cid,
    birth_date: pick(input.row, ["วันเกิด", "birth_date", "birthDate"]),
    testDate: pick(input.row, ["วันที่ตรวจ", "testDate", "test_date"]) || nowIso().slice(0, 10),
    subdistrict: pick(input.row, ["ตำบล", "subdistrict", "tambon"]) || input.subdistrict || input.sourceSheet,
    village: pick(input.row, ["หมู่", "หมู่ที่", "village", "moo"]),
    serviceUnitCode: input.serviceUnitCode,
    rapid_hbv_result: pick(input.row, ["Rapid HBV", "rapid_hbv_result"]),
    rapid_hcv_result: pick(input.row, ["Rapid HCV", "rapid_hcv_result"]),
    hbsag: pick(input.row, ["HBsAg", "hbsag"]),
    hcvAb: pick(input.row, ["HCV Ab", "hcvAb", "hcv_ab"]),
    hcvVL: pick(input.row, ["HCV RNA", "hcvVL", "hcv_vl"]),
    care_status: pick(input.row, ["สถานะ", "care_status", "careStatus"]) || "Roster",
    fiscalYear: pick(input.row, ["ปีงบ", "fiscalYear"]),
    status: "active",
  });
}

function rosterHeaderIndex(rows: string[][]) {
  return rows.findIndex((row) => {
    const cells = row.map((cell) => cell.trim());
    return (
      cells.includes("เลขบัตรประชาชน") &&
      cells.includes("ชื่อ") &&
      (cells.includes("สกุล") || cells.includes("นามสกุล") || cells.includes("ชื่อ-สกุล"))
    );
  });
}

async function fetchRosterSheetPatients(workbookId: string, roster: (typeof PATIENT_ROSTER_SHEETS)[number]) {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${workbookId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(roster.sheetName)}`;
  const response = await fetch(csvUrl);
  if (!response.ok) throw new Error(`${roster.sheetName}: HTTP ${response.status}`);

  const rows = parseCsv(await response.text());
  const headerIndex = rosterHeaderIndex(rows);
  if (headerIndex < 0) throw new Error(`${roster.sheetName}: ไม่พบหัวตารางรายชื่อ`);

  const headers = rows[headerIndex].map((item) => item.trim());
  return rows
    .slice(headerIndex + 1)
    .map((cells, index) => ({
      rowNumber: headerIndex + index + 2,
      row: Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex]?.trim() || ""])),
    }))
    .filter(({ row }) => {
      const hasName = Boolean(pick(row, ["ชื่อ", "name", "ชื่อ-สกุล", "ชื่อ-นามสกุล"]));
      const hasCid = Boolean(pick(row, ["เลขบัตรประชาชน", "cid", "CID"]));
      const hasPhone = Boolean(pick(row, ["เบอร์โทรศัพท์", "phone"]));
      return hasName || hasCid || hasPhone;
    })
    .map(({ row, rowNumber }) =>
      mapRosterRow({
        row,
        rowNumber,
        serviceUnitCode: roster.code,
        sourceSheet: roster.sheetName,
        subdistrict: roster.subdistrict,
      }),
    );
}

async function syncPatientsFromRosterWorkbook(store: PatientRegistryStore) {
  const workbookId = patientRosterWorkbookId();
  const results = await Promise.allSettled(
    PATIENT_ROSTER_SHEETS.map((roster) => fetchRosterSheetPatients(workbookId, roster)),
  );
  const patients = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  const failures = results
    .map((result, index) =>
      result.status === "rejected"
        ? `${PATIENT_ROSTER_SHEETS[index].sheetName}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`
        : "",
    )
    .filter(Boolean);

  if (!patients.length) {
    store.lastGoogleSyncError = `Roster workbook failed: ${failures.join("; ")}`;
    writePatientRegistryStore(store);
    throw new Error(`ดึงรายชื่อจากชีต รพ.สต. ไม่สำเร็จ: ${failures.join("; ")}`);
  }

  store.googleSheetPatients = patients;
  store.lastGoogleSyncAt = nowIso();
  store.lastGoogleSyncError = failures.length ? `บางชีตดึงไม่ได้: ${failures.join("; ")}` : undefined;
  writePatientRegistryStore(store);
  return {
    count: patients.length,
    syncedAt: store.lastGoogleSyncAt,
    source: "service-roster-workbook",
    workbookId,
    sheetCount: PATIENT_ROSTER_SHEETS.length - failures.length,
    failedSheetCount: failures.length,
  };
}

export async function syncPatientsFromGoogleSheet() {
  const url = googleSheetCsvUrl();
  const store = readPatientRegistryStore();

  if (!url) return syncPatientsFromRosterWorkbook(store);

  const response = await fetch(url);
  if (!response.ok) {
    store.lastGoogleSyncError = `Google Sheet HTTP ${response.status}`;
    writePatientRegistryStore(store);
    throw new Error(`ดึง Google Sheet ไม่สำเร็จ: HTTP ${response.status}`);
  }

  const rows = parseCsv(await response.text());
  const headers = rows.shift()?.map((item) => item.trim()) || [];
  const patients = rows
    .map((cells) =>
      Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() || ""])),
    )
    .map(mapSheetRow)
    .filter((patient) => patient.hn);

  store.googleSheetPatients = patients;
  store.lastGoogleSyncAt = nowIso();
  store.lastGoogleSyncError = undefined;
  writePatientRegistryStore(store);
  return { count: patients.length, syncedAt: store.lastGoogleSyncAt, source: "single-sheet" };
}
