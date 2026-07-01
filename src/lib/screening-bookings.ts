import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { HEPA_SERVICE_AREAS, type HepaServiceArea } from "@/lib/hepa-service-area";
import { serverEnv } from "@/lib/server-env";

export type ScreeningRiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type ScreeningBookingStatus = "reserved" | "confirmed" | "cancelled";

export type ScreeningRiskFactors = {
  bornBefore2535: boolean;
  familyHistory: boolean;
  bloodTransfusion: boolean;
  drugUse: boolean;
  uncleanTattoo: boolean;
  multiplePartners: boolean;
  chronicLiverDisease: boolean;
};

export type ScreeningBookingInput = {
  fullName: string;
  phone: string;
  birthYear: number;
  gender?: string;
  idNumber?: string;
  consentAccepted?: boolean;
  rosterVerification?: ScreeningRosterVerification;
  riskFactors: ScreeningRiskFactors;
  selectedServiceUnitCode: string;
  preferredDate?: string;
  lineUserId?: string;
  lineDisplayName?: string;
};

export type ScreeningRosterVerification = {
  matched: boolean;
  sourceSheet: string;
  rowNumber?: number;
  matchedBy?: "cid" | "phone_name" | "name";
  checkedAt: string;
};

export type ScreeningBooking = Omit<ScreeningBookingInput, "idNumber"> & {
  id: string;
  bookingCode: string;
  cidLast4?: string;
  riskLevel: ScreeningRiskLevel;
  riskCount: number;
  recommendation: string;
  selectedServiceUnit: Pick<HepaServiceArea, "code" | "unitName" | "unitType" | "subdistrict">;
  status: ScreeningBookingStatus;
  consentAccepted: boolean;
  consentAcceptedAt: string;
  consentNoticeVersion: string;
  rosterVerified: boolean;
  rosterVerifiedAt?: string;
  rosterSourceSheet?: string;
  rosterRowNumber?: number;
  rosterMatchedBy?: "cid" | "phone_name" | "name";
  createdAt: string;
  updatedAt: string;
};

export type ScreeningStore = {
  bookings: ScreeningBooking[];
};

export const SCREENING_RISK_LABEL: Record<ScreeningRiskLevel, string> = {
  LOW: "ความเสี่ยงทั่วไป",
  MEDIUM: "เข้าเกณฑ์ตรวจฟรีตามปีเกิด",
  HIGH: "มีปัจจัยเสี่ยง ควรรับการคัดกรอง",
};

export const SCREENING_CONSENT_NOTICE_VERSION = "pdpa-screening-v1-2026-07-01";
const DEFAULT_SCREENING_ROSTER_SHEET_ID = "1vvx-UIaeoMQn1e4prFKOw0xY0ggpTx6AR8-y900ADXM";

// Source: Google Sheet 1vvx-UIaeoMQn1e4prFKOw0xY0ggpTx6AR8-y900ADXM.
// Online workbook row total is 2,000 kits.
// NPH hospital direct quota (113) is intentionally excluded from LINE screening per ops request.
const SERVICE_QUOTA: Record<string, number> = {
  PT: 136,
  NK: 131,
  KS: 127,
  BK: 122,
  BY: 111,
  KB: 110,
  WC: 109,
  MW: 109,
  BN: 103,
  NP: 96,
  TK: 91,
  NS: 90,
  SM: 89,
  KY: 87,
  KMW: 85,
  NW: 82,
  BL: 80,
  TM: 79,
  KNK: 50,
  NPGKS: 0,
};

const INITIAL_BOOKED: Record<string, number> = {};

const ROSTER_SHEET_BY_UNIT_CODE: Record<string, string> = {
  PT: "รพ.สต.พังทุย",
  NK: "รพ.สต.หนองกุง",
  KS: "รพ.สต.กุดน้ำใส",
  BK: "รพ.สต.บ้านขาม",
  BY: "รพ.สต.บัวใหญ่",
  KB: "รพ.สต.บ้านคำบง",
  WC: "รพ.สต.วังชัย",
  MW: "รพ.สต.ม่วงหวาน",
  BN: "รพ.สต.บัวเงิน",
  NP: "รพ.สต.น้ำพอง",
  TK: "รพ.สต.ท่ากระเสริม",
  NS: "รพ.สต.นาศรี",
  SM: "รพ.สต.ทรายมูล",
  KY: "รพ.สต.โคกใหญ่",
  KMW: "รพ.สต.คำแก่นคูณ (เขตม่วงหวาน)",
  NW: "รพ.สต.บ้านหนองหว้า",
  BL: "รพ.สต.บ้านเหล่าใหญ่",
  TM: "รพ.สต.บ้านท่ามะเดื่อ",
  KNK: "รพ.สต.คำแก่นคูณ (เขตหนองกุง)",
};

function storePath() {
  return (
    serverEnv("HEPA_SCREENING_STORE_PATH") ||
    resolve(process.cwd(), "data", "screening-bookings.json")
  );
}

function nowIso() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

function emptyStore(): ScreeningStore {
  return { bookings: [] };
}

export function readScreeningStore(): ScreeningStore {
  const path = storePath();
  if (!existsSync(path)) return emptyStore();
  return { ...emptyStore(), ...JSON.parse(readFileSync(path, "utf8")) };
}

export function writeScreeningStore(store: ScreeningStore) {
  const path = storePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(store, null, 2), "utf8");
}

export function getScreeningStorePath() {
  return storePath();
}

export function getScreeningServiceUnits() {
  const unique = new Map<string, HepaServiceArea>();
  for (const area of HEPA_SERVICE_AREAS) {
    if (area.code === "NPH") continue;
    if (!unique.has(area.code)) unique.set(area.code, area);
  }
  const rows = Array.from(unique.values()).map((area) => ({
    code: area.code,
    unitName: area.unitName,
    unitType: area.unitType,
    subdistrict: area.subdistrict,
    quota: SERVICE_QUOTA[area.code] ?? 0,
    initialBooked: INITIAL_BOOKED[area.code] ?? 0,
  }));
  return rows.sort((a, b) => a.unitName.localeCompare(b.unitName, "th"));
}

export function evaluateScreeningRisk(input: Pick<ScreeningBookingInput, "birthYear" | "riskFactors">) {
  const riskFactors = input.riskFactors;
  const bornBefore2535 = input.birthYear <= 2535 || riskFactors.bornBefore2535;
  const riskCount = Object.entries(riskFactors).filter(
    ([key, value]) => key !== "bornBefore2535" && value,
  ).length;

  if (riskCount > 0) {
    return {
      riskLevel: "HIGH" as const,
      riskCount,
      recommendation:
        "มีปัจจัยเสี่ยงต่อไวรัสตับอักเสบ B/C ควรรับการเจาะเลือดคัดกรองตามหน่วยบริการที่เลือก",
    };
  }

  if (bornBefore2535) {
    return {
      riskLevel: "MEDIUM" as const,
      riskCount,
      recommendation:
        "เกิดก่อน พ.ศ. 2535 เข้าเกณฑ์สิทธิคัดกรองไวรัสตับอักเสบ B/C ฟรี 1 ครั้งตามโครงการ",
    };
  }

  return {
    riskLevel: "LOW" as const,
    riskCount,
    recommendation:
      "ความเสี่ยงทั่วไป แนะนำรับการตรวจคัดกรองอย่างน้อย 1 ครั้งในชีวิตหรือตามคำแนะนำของเจ้าหน้าที่",
  };
}

function maskCid(idNumber?: string) {
  const digits = (idNumber || "").replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : undefined;
}

function bookingCode() {
  return `HEP-NP-${Math.floor(100000 + Math.random() * 900000)}`;
}

function screeningRosterSheetId() {
  return serverEnv("HEPA_SCREENING_ROSTER_SHEET_ID") || DEFAULT_SCREENING_ROSTER_SHEET_ID;
}

export function isScreeningRosterRequired() {
  return serverEnv("HEPA_SCREENING_ROSTER_REQUIRED") !== "false";
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

function cleanDigits(value?: string) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeLookupText(value?: string) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function rowValue(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return "";
}

export async function verifyScreeningRosterEligibility(
  input: Pick<ScreeningBookingInput, "fullName" | "phone" | "idNumber" | "selectedServiceUnitCode">,
): Promise<ScreeningRosterVerification> {
  const sourceSheet = ROSTER_SHEET_BY_UNIT_CODE[input.selectedServiceUnitCode];
  const checkedAt = nowIso();
  if (!sourceSheet) {
    throw new Error("ยังไม่ได้ตั้งค่า Google Sheet รายชื่อสำหรับหน่วยบริการนี้");
  }

  const sheetId = screeningRosterSheetId();
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sourceSheet)}`;
  const response = await fetch(csvUrl);
  if (!response.ok) {
    throw new Error(`ดึงรายชื่อจาก Google Sheet ไม่สำเร็จ: HTTP ${response.status}`);
  }

  const rows = parseCsv(await response.text());
  const headerIndex = rows.findIndex((row) =>
    row.some((cell) => cell.trim() === "เลขบัตรประชาชน") &&
    row.some((cell) => cell.trim() === "ชื่อ") &&
    row.some((cell) => cell.trim() === "เบอร์โทรศัพท์"),
  );
  if (headerIndex < 0) {
    throw new Error(`ไม่พบหัวตารางรายชื่อในชีต ${sourceSheet}`);
  }

  const headers = rows[headerIndex].map((item) => item.trim());
  const candidates = rows.slice(headerIndex + 1).map((cells, index) => ({
    rowNumber: headerIndex + index + 2,
    row: Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex]?.trim() || ""])),
  }));

  const inputCid = cleanDigits(input.idNumber);
  const inputPhone = cleanDigits(input.phone);
  const inputName = normalizeLookupText(input.fullName);

  for (const candidate of candidates) {
    const cid = cleanDigits(rowValue(candidate.row, ["เลขบัตรประชาชน", "cid", "CID"]));
    const phone = cleanDigits(rowValue(candidate.row, ["เบอร์โทรศัพท์", "phone"]));
    const firstName = rowValue(candidate.row, ["ชื่อ"]);
    const lastName = rowValue(candidate.row, ["สกุล"]);
    const fullName = normalizeLookupText(`${firstName}${lastName}`);
    const hasRosterData = Boolean(cid || phone || fullName);
    if (!hasRosterData) continue;

    if (inputCid.length >= 13 && cid && inputCid === cid) {
      return { matched: true, sourceSheet, rowNumber: candidate.rowNumber, matchedBy: "cid", checkedAt };
    }
    if (inputPhone.length >= 9 && phone && inputPhone === phone && inputName && fullName && inputName === fullName) {
      return { matched: true, sourceSheet, rowNumber: candidate.rowNumber, matchedBy: "phone_name", checkedAt };
    }
    if (!phone && !cid && inputName && fullName && inputName === fullName) {
      return { matched: true, sourceSheet, rowNumber: candidate.rowNumber, matchedBy: "name", checkedAt };
    }
  }

  throw new Error(`ไม่พบรายชื่อใน Google Sheet ของ ${sourceSheet} กรุณาติดต่อ รพ.สต. ให้ตรวจสอบ/นำเข้ารายชื่อก่อนจอง`);
}

export function getScreeningSummary() {
  const store = readScreeningStore();
  const units = getScreeningServiceUnits();
  const includedUnitCodes = new Set(units.map((unit) => unit.code));
  const countedBookings = store.bookings.filter((item) => includedUnitCodes.has(item.selectedServiceUnitCode));
  const activeBookings = countedBookings.filter((item) => item.status !== "cancelled");
  const totalQuota = units.reduce((sum, item) => sum + item.quota, 0);
  const initialBooked = units.reduce((sum, item) => sum + item.initialBooked, 0);
  const booked = initialBooked + activeBookings.length;

  return {
    checkedAt: nowIso(),
    storePath: getScreeningStorePath(),
    totalQuota,
    initialBooked,
    liveBookings: activeBookings.length,
    booked,
    remaining: Math.max(0, totalQuota - booked),
    percentage: totalQuota > 0 ? Math.min(100, Math.round((booked / totalQuota) * 100)) : 100,
    units: units.map((unit) => {
      const live = activeBookings.filter((item) => item.selectedServiceUnitCode === unit.code).length;
      const booked = unit.initialBooked + live;
      return {
        ...unit,
        liveBookings: live,
        booked,
        remaining: Math.max(0, unit.quota - booked),
        percentage: unit.quota > 0 ? Math.min(100, Math.round((booked / unit.quota) * 100)) : 100,
      };
    }),
    bookings: [...countedBookings].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

export function createScreeningBooking(input: ScreeningBookingInput) {
  const store = readScreeningStore();
  const unit = getScreeningServiceUnits().find((item) => item.code === input.selectedServiceUnitCode);
  if (!unit) throw new Error("ไม่พบสถานบริการที่เลือก");
  if (unit.quota <= 0) throw new Error("หน่วยบริการนี้ยังไม่มีโควตาคัดกรอง");
  if (!input.fullName.trim()) throw new Error("กรุณาระบุชื่อ-นามสกุล");
  if (!input.phone.trim()) throw new Error("กรุณาระบุเบอร์โทรศัพท์");
  if (!Number.isFinite(input.birthYear) || input.birthYear < 2400 || input.birthYear > 2600) {
    throw new Error("กรุณาระบุปีเกิด พ.ศ. ให้ถูกต้อง");
  }
  if (input.consentAccepted !== true) {
    throw new Error("กรุณายินยอมการใช้ข้อมูลส่วนบุคคลตาม PDPA ก่อนจองสิทธิ์");
  }
  if (isScreeningRosterRequired() && input.rosterVerification?.matched !== true) {
    throw new Error("กรุณาตรวจสอบรายชื่อจาก Google Sheet ของ รพ.สต. ก่อนจองสิทธิ์");
  }

  const summary = getScreeningSummary();
  const unitSummary = summary.units.find((item) => item.code === unit.code);
  if (unit.quota > 0 && unitSummary && unitSummary.remaining <= 0) {
    throw new Error("โควตาคัดกรองของหน่วยบริการนี้เต็มแล้ว กรุณาเลือกหน่วยบริการอื่น");
  }

  const createdAt = nowIso();
  const evaluation = evaluateScreeningRisk(input);
  const booking: ScreeningBooking = {
    id: id("screen"),
    bookingCode: bookingCode(),
    fullName: input.fullName.trim(),
    phone: input.phone.trim(),
    birthYear: input.birthYear,
    gender: input.gender || "",
    cidLast4: maskCid(input.idNumber),
    riskFactors: {
      ...input.riskFactors,
      bornBefore2535: input.birthYear <= 2535 || input.riskFactors.bornBefore2535,
    },
    selectedServiceUnitCode: unit.code,
    selectedServiceUnit: {
      code: unit.code,
      unitName: unit.unitName,
      unitType: unit.unitType,
      subdistrict: unit.subdistrict,
    },
    preferredDate: input.preferredDate || "",
    lineUserId: input.lineUserId,
    lineDisplayName: input.lineDisplayName,
    status: "reserved",
    consentAccepted: true,
    consentAcceptedAt: createdAt,
    consentNoticeVersion: SCREENING_CONSENT_NOTICE_VERSION,
    rosterVerified: input.rosterVerification?.matched === true,
    rosterVerifiedAt: input.rosterVerification?.checkedAt,
    rosterSourceSheet: input.rosterVerification?.sourceSheet,
    rosterRowNumber: input.rosterVerification?.rowNumber,
    rosterMatchedBy: input.rosterVerification?.matchedBy,
    createdAt,
    updatedAt: createdAt,
    ...evaluation,
  };

  store.bookings.unshift(booking);
  writeScreeningStore(store);
  return booking;
}

export function updateScreeningBookingStatus(idOrCode: string, status: ScreeningBookingStatus) {
  const store = readScreeningStore();
  const booking = store.bookings.find(
    (item) => item.id === idOrCode || item.bookingCode === idOrCode,
  );
  if (!booking) throw new Error("ไม่พบรายการจอง");
  booking.status = status;
  booking.updatedAt = nowIso();
  writeScreeningStore(store);
  return booking;
}
