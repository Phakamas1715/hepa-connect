// Mock data for HEPA-GLUE Engine — Nam Phong District, Khon Kaen
import {
  HEPA_DISTRICT_HOSPITAL,
  HEPA_PRIMARY_CARE_UNITS,
  formatHepaServiceUnitShortName,
} from "@/lib/hepa-service-area";

export const HEPA_PROJECT_CONFIG = {
  districtName: "อำเภอน้ำพอง",
  provinceName: "ขอนแก่น",
  fiscalYear: "2569",
  targetBirthBeforeYear: 2535,
  hospitalCode: "11000",
  hospitalName: HEPA_DISTRICT_HOSPITAL.unitName,
  primaryCareUnitCount: HEPA_PRIMARY_CARE_UNITS.length,
  targetPopulation: 6556,
  primaryCareTargetPopulation: 5805,
} as const;

export const KPI = {
  targetPopulation: HEPA_PROJECT_CONFIG.targetPopulation,
  hbv: { screened: 2398, pct: 57.69, score: 1 },
  hcv: { screened: 2129, pct: 51.22, score: 1 },
  hcvCascade: {
    screened: 2129,
    positive: 101,
    confirmed: 78,
    onTreatment: 47,
    cured: 28,
    linkagePct: 46.53,
  },
};

const HEPA_UNIT_TARGETS: Record<string, Pick<SubDistrict, "target" | "riskDensity" | "screened">> = {
  SM: { target: 295, riskDensity: 0.49, screened: 0 },
  BY: { target: 367, riskDensity: 0.61, screened: 0 },
  BL: { target: 228, riskDensity: 0.56, screened: 0 },
  NK: { target: 455, riskDensity: 0.65, screened: 0 },
  NP: { target: 286, riskDensity: 0.63, screened: 0 },
  WC: { target: 376, riskDensity: 0.55, screened: 0 },
  KB: { target: 333, riskDensity: 0.7, screened: 0 },
  NW: { target: 244, riskDensity: 0.53, screened: 0 },
  TM: { target: 238, riskDensity: 0.51, screened: 0 },
  MW: { target: 318, riskDensity: 0.74, screened: 0 },
  TK: { target: 298, riskDensity: 0.52, screened: 0 },
  KY: { target: 254, riskDensity: 0.59, screened: 0 },
  NS: { target: 276, riskDensity: 0.57, screened: 0 },
  BK: { target: 402, riskDensity: 0.68, screened: 0 },
  KK: { target: 262, riskDensity: 0.66, screened: 0 },
  BN: { target: 340, riskDensity: 0.58, screened: 0 },
  KS: { target: 412, riskDensity: 0.72, screened: 0 },
  PT: { target: 421, riskDensity: 0.83, screened: 0 },
};

export type SubDistrict = {
  id: string;
  name: string;
  target: number;
  riskDensity: number;
  screened: number;
};

export const SUBDISTRICTS: SubDistrict[] = HEPA_PRIMARY_CARE_UNITS.map((unit) => {
  const metrics = HEPA_UNIT_TARGETS[unit.code];
  if (!metrics) throw new Error(`Missing HEPA unit target metrics for ${unit.code}`);
  return {
    id: unit.code,
    name: formatHepaServiceUnitShortName(unit.unitName),
    ...metrics,
  };
});

export function allocateKits(totalKits: number, subs: SubDistrict[]) {
  const totalTarget = subs.reduce((sum, item) => sum + item.target, 0);
  const totalRisk = subs.reduce((sum, item) => sum + item.riskDensity, 0);
  return subs.map((item) => {
    const allocation =
      totalKits * (0.6 * (item.target / totalTarget) + 0.4 * (item.riskDensity / totalRisk));
    return { ...item, allocation: Math.round(allocation) };
  });
}

export type Persona =
  | "The Forgetful"
  | "The Fearful"
  | "The Denier"
  | "The Engaged"
  | "The Striver";

export type Patient = {
  hn: string;
  name: string;
  cid: string;
  birth_date: string;
  testDate: string;
  subdistrict: string;
  village: string;
  rapid_hbv_result: string;
  rapid_hcv_result: string;
  hbsag: string;
  hcvAb: string;
  hcvVL: string;
  persona: Persona;
  last_nudge_date?: string;
  nudge_count?: number;
  care_status?: string;
  moph_sync_status?: string;
  reported: boolean;
  txId?: string;
  reportedAt?: string;
  moph_transaction_id?: string;
  moph_last_sync?: string;
  fiscalYear?: string;
  hbsab?: string;
  created_at?: string;
  updated_at?: string;
  status?: string;
};

export const PERSONA_NUDGES: Record<Persona, { sms: string; script: string }> = {
  "The Fearful": {
    sms:
      `เรียน {name} ${HEPA_PROJECT_CONFIG.hospitalName}ขอแจ้งว่า ยา Sofvel สำหรับรักษาไวรัสตับอักเสบซีรักษาหายขาดได้สูง และรับบริการฟรีตามนโยบายรัฐ ข้อมูลของท่านเป็นความลับ นัดพบแพทย์ {date} โทร 043-xxx-xxx`,
    script:
      "1. ทักทายอย่างอบอุ่น ไม่ตัดสิน\n2. ย้ำเรื่องความเป็นส่วนตัวและสิทธิผู้ป่วย\n3. อธิบายว่าการรักษาฟรี และผู้ป่วยส่วนใหญ่หายขาดภายใน 12 สัปดาห์\n4. ใช้คำว่า \"ภาวะที่รักษาให้หายได้\" แทนคำที่ทำให้กลัว\n5. เสนอให้ อสม. หรือญาติช่วยพามาโรงพยาบาล",
  },
  "The Forgetful": {
    sms:
      `คุณ {name} มีนัดตรวจยืนยันผลที่${HEPA_PROJECT_CONFIG.hospitalName} วัน{date} เวลา 08:00 น. กรุณามาก่อนเวลา 15 นาที ตอบ 1 เพื่อยืนยัน หรือโทร 043-xxx-xxx หากต้องการเลื่อนนัด`,
    script:
      "1. ใช้ commitment device ให้ผู้ป่วยยืนยันนัดด้วยตนเอง\n2. ส่งเตือน 3 ครั้ง: 3 วันก่อนนัด / 1 วันก่อนนัด / เช้าวันนัด\n3. ระบุชื่อทีมดูแลเพื่อเพิ่ม personal touch\n4. ตั้ง default option เป็นนัดประจำ เว้นแต่ผู้ป่วยแจ้งเลื่อน",
  },
  "The Denier": {
    sms:
      "เรียน {name} ผลตรวจของท่านควรได้รับการตรวจยืนยันเพิ่มเติม การละเลยอาจนำไปสู่ภาวะตับแข็งหรือตับอักเสบเรื้อรัง แต่หากดูแลตั้งแต่วันนี้มีโอกาสรักษาและป้องกันภาวะแทรกซ้อนได้ นัด {date}",
    script:
      "1. ใช้ loss aversion framing โดยเน้นสิ่งที่อาจเสียหากไม่ติดตาม\n2. ใช้ social proof จากผู้ป่วยในชุมชนที่รักษาสำเร็จ\n3. ให้ข้อมูลทางวิทยาศาสตร์แบบเข้าใจง่าย\n4. ชวน อสม. หรือสมาชิกครอบครัวร่วมรับฟัง\n5. ปิดด้วยประโยค: การไม่ตัดสินใจก็คือการเลือกความเสี่ยง",
  },
  "The Engaged": {
    sms:
      `ขอบคุณคุณ {name} ที่ใส่ใจสุขภาพ นัดติดตามผลครั้งถัดไป {date} ที่${HEPA_PROJECT_CONFIG.hospitalName} การมาตามนัดช่วยให้แผนดูแลไวรัสตับอักเสบต่อเนื่องและปลอดภัย`,
    script:
      "ติดตามตามแผน ขอบคุณการให้ความร่วมมือ และชวนเป็นกำลังใจให้ผู้ป่วยรายอื่นในชุมชน",
  },
  "The Striver": {
    sms:
      `คุณ {name} เดินมาถูกทางแล้ว เหลือขั้นตอนตรวจยืนยัน viral load เพื่อเริ่มแผนรักษา Sofvel และปิด care gap นัด {date} ที่${HEPA_PROJECT_CONFIG.hospitalName}`,
    script:
      "1. ชื่นชมความพยายามที่ผ่านมา\n2. อธิบายว่าขั้นตอนสุดท้ายคือ viral load confirmation\n3. ผูกผลลัพธ์กับเป้าหมายหายขาด SVR12\n4. เสนอความช่วยเหลือด้านเดินทางหรือประสาน อสม.",
  },
};

export const MOPH_CONFIG = {
  hospitalCode: HEPA_PROJECT_CONFIG.hospitalCode,
  hospitalName: HEPA_PROJECT_CONFIG.hospitalName,
  username: "jane",
  password: "Nph133",
  portals: [
    { id: "ddsdoe", url: "ddsdoe.ddc.moph.go.th", name: "Hep-BC-DDC Portal", status: "connected" as const },
    { id: "d506", url: "d506portal.ddc.moph.go.th", name: "D506 Surveillance Portal", status: "connected" as const },
    { id: "doe", url: "doeportal.moph.go.th", name: "DOE National Portal", status: "connected" as const },
  ],
};

export function isPositive(patient: Patient) {
  return patient.hbsag === "Positive" || patient.hcvAb === "Positive" || patient.hcvVL === "Detected";
}

export function hasCareGap(patient: Patient) {
  return (
    patient.hcvVL === "รอผล" ||
    patient.hcvVL === "ไม่พอตรวจขอเจาะใหม่" ||
    patient.hcvVL === "Pending" ||
    patient.hcvVL === "Awaiting Result" ||
    isPositive(patient) ||
    patient.care_status === "Pending"
  );
}
