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
  riskFactors: ScreeningRiskFactors;
  selectedServiceUnitCode: string;
  preferredDate?: string;
  lineUserId?: string;
  lineDisplayName?: string;
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

const SERVICE_QUOTA: Record<string, number> = {
  PT: 150,
  NK: 150,
  KS: 150,
  BK: 150,
  NPH: 100,
  BY: 150,
  KB: 100,
  WC: 150,
  MW: 150,
  BN: 150,
  NP: 150,
  TK: 150,
  NS: 150,
  SM: 150,
  KY: 100,
  KMW: 100,
  NW: 100,
  BL: 100,
  TM: 100,
  KNK: 0,
  NPGKS: 0,
};

const INITIAL_BOOKED: Record<string, number> = {
  PT: 64,
  NK: 52,
  KS: 98,
  BK: 41,
  NPH: 45,
  BY: 33,
  KB: 48,
  WC: 87,
  MW: 76,
  BN: 59,
  NP: 91,
  TK: 34,
  NS: 62,
  SM: 55,
  KY: 29,
  KMW: 35,
  NW: 45,
  BL: 31,
  TM: 42,
  KNK: 0,
  NPGKS: 0,
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
    if (!unique.has(area.code)) unique.set(area.code, area);
  }
  const rows = Array.from(unique.values()).map((area) => ({
    code: area.code,
    unitName: area.unitName,
    unitType: area.unitType,
    subdistrict: area.subdistrict,
    quota: SERVICE_QUOTA[area.code] ?? (area.unitType === "hospital" ? 100 : 150),
    initialBooked: INITIAL_BOOKED[area.code] ?? 0,
  }));
  return rows.sort((a, b) => {
    if (a.code === "NPH") return -1;
    if (b.code === "NPH") return 1;
    return a.unitName.localeCompare(b.unitName, "th");
  });
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

export function getScreeningSummary() {
  const store = readScreeningStore();
  const units = getScreeningServiceUnits();
  const activeBookings = store.bookings.filter((item) => item.status !== "cancelled");
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
    bookings: [...store.bookings].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

export function createScreeningBooking(input: ScreeningBookingInput) {
  const store = readScreeningStore();
  const unit = getScreeningServiceUnits().find((item) => item.code === input.selectedServiceUnitCode);
  if (!unit) throw new Error("ไม่พบสถานบริการที่เลือก");
  if (!input.fullName.trim()) throw new Error("กรุณาระบุชื่อ-นามสกุล");
  if (!input.phone.trim()) throw new Error("กรุณาระบุเบอร์โทรศัพท์");
  if (!Number.isFinite(input.birthYear) || input.birthYear < 2400 || input.birthYear > 2600) {
    throw new Error("กรุณาระบุปีเกิด พ.ศ. ให้ถูกต้อง");
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
