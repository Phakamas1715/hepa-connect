// Prepared target registry for HEPA-GLUE Engine - Nam Phong District, Khon Kaen.
// Replace or extend PREPARED_PATIENTS with the real prepared list when it is ready.

export type SubDistrict = {
  id: string;
  name: string;
  target: number;
  riskDensity: number;
  screened: number;
};

export type HbvHdcPerformance = {
  id: string;
  name: string;
  unitType: "hospital" | "primary_care";
  target: number;
  hdcScreened: number;
};

export const HBV_DASHBOARD_NHSO_SCREENED = 392;

export const HBV_HDC_REPORTED_TOTAL = 13465;

export const HBV_HDC_PERFORMANCE: HbvHdcPerformance[] = [
  { id: "NPH", name: "โรงพยาบาลน้ำพอง", unitType: "hospital", target: 598, hdcScreened: 13463 },
  { id: "NP", name: "รพ.สต.น้ำพอง", unitType: "primary_care", target: 334, hdcScreened: 1 },
  { id: "WC", name: "รพ.สต.วังชัย", unitType: "primary_care", target: 625, hdcScreened: 0 },
  { id: "NK", name: "รพ.สต.หนองกุง", unitType: "primary_care", target: 485, hdcScreened: 0 },
  { id: "BY", name: "รพ.สต.บัวใหญ่", unitType: "primary_care", target: 507, hdcScreened: 0 },
  { id: "KB", name: "รพ.สต.บ้านคำบง", unitType: "primary_care", target: 305, hdcScreened: 1 },
  { id: "MW", name: "รพ.สต.ม่วงหวาน", unitType: "primary_care", target: 360, hdcScreened: 0 },
  { id: "TM", name: "รพ.สต.บ้านท่ามะเดื่อ", unitType: "primary_care", target: 180, hdcScreened: 0 },
  { id: "BK", name: "รพ.สต.บ้านขาม", unitType: "primary_care", target: 365, hdcScreened: 0 },
  { id: "BL", name: "รพ.สต.บ้านเหล่าใหญ่", unitType: "primary_care", target: 180, hdcScreened: 0 },
  { id: "KY", name: "รพ.สต.บ้านโคกใหญ่", unitType: "primary_care", target: 193, hdcScreened: 0 },
  { id: "BN", name: "รพ.สต.บัวเงิน", unitType: "primary_care", target: 518, hdcScreened: 0 },
  { id: "SM", name: "รพ.สต.ทรายมูล", unitType: "primary_care", target: 222, hdcScreened: 0 },
  { id: "NW", name: "รพ.สต.บ้านหนองหว้า", unitType: "primary_care", target: 183, hdcScreened: 0 },
  { id: "TK", name: "รพ.สต.ท่ากระเสริม", unitType: "primary_care", target: 248, hdcScreened: 0 },
  { id: "PT", name: "รพ.สต.กุดพังทุย", unitType: "primary_care", target: 430, hdcScreened: 0 },
  { id: "KS", name: "รพ.สต.กุดน้ำใส", unitType: "primary_care", target: 235, hdcScreened: 1 },
  { id: "NS", name: "รพ.สต.สะอาด", unitType: "primary_care", target: 326, hdcScreened: 0 },
  {
    id: "KMW_KNK",
    name: "รพ.สต.คำแก่นคูณ (รวม KMW/KNK)",
    unitType: "primary_care",
    target: 262,
    hdcScreened: 0,
  },
];

export function buildHbvCupSummary(rows: HbvHdcPerformance[] = HBV_HDC_PERFORMANCE) {
  const targetTotal = rows.reduce((sum, row) => sum + row.target, 0);
  const hdcRowTotal = rows.reduce((sum, row) => sum + row.hdcScreened, 0);
  const hospitalHdc = rows
    .filter((row) => row.unitType === "hospital")
    .reduce((sum, row) => sum + row.hdcScreened, 0);
  const primaryCareHdc = rows
    .filter((row) => row.unitType === "primary_care")
    .reduce((sum, row) => sum + row.hdcScreened, 0);
  const primaryCareWithHdc = rows.filter(
    (row) => row.unitType === "primary_care" && row.hdcScreened > 0,
  ).length;

  return {
    targetTotal,
    dashboardNhsoScreened: HBV_DASHBOARD_NHSO_SCREENED,
    hdcReportedTotal: HBV_HDC_REPORTED_TOTAL,
    hdcRowTotal,
    hdcTotalVariance: hdcRowTotal - HBV_HDC_REPORTED_TOTAL,
    hospitalHdc,
    primaryCareHdc,
    primaryCareWithHdc,
    dashboardPct: percent(HBV_DASHBOARD_NHSO_SCREENED, targetTotal),
    primaryCareHdcPct: percent(primaryCareHdc, targetTotal),
    hdcReportedPct: percent(HBV_HDC_REPORTED_TOTAL, targetTotal),
  };
}

export const HBV_CUP_SUMMARY = buildHbvCupSummary();

export const SUBDISTRICTS: SubDistrict[] = [
  { id: "SM", name: "รพ.สต.ทรายมูล", target: 295, riskDensity: 0.49, screened: 0 },
  { id: "BY", name: "รพ.สต.บัวใหญ่", target: 367, riskDensity: 0.61, screened: 0 },
  { id: "BL", name: "รพ.สต.บ้านเหล่าใหญ่", target: 228, riskDensity: 0.56, screened: 0 },
  { id: "NK", name: "รพ.สต.หนองกุง", target: 455, riskDensity: 0.65, screened: 0 },
  { id: "NP", name: "รพ.สต.น้ำพอง", target: 286, riskDensity: 0.63, screened: 0 },
  { id: "WC", name: "รพ.สต.วังชัย", target: 376, riskDensity: 0.55, screened: 0 },
  { id: "KB", name: "รพ.สต.บ้านคำบง", target: 333, riskDensity: 0.7, screened: 0 },
  { id: "NW", name: "รพ.สต.บ้านหนองหว้า", target: 244, riskDensity: 0.53, screened: 0 },
  { id: "TM", name: "รพ.สต.บ้านท่ามะเดื่อ", target: 238, riskDensity: 0.51, screened: 0 },
  { id: "MW", name: "รพ.สต.ม่วงหวาน", target: 318, riskDensity: 0.74, screened: 0 },
  { id: "TK", name: "รพ.สต.ท่ากระเสริม", target: 298, riskDensity: 0.52, screened: 0 },
  { id: "KY", name: "รพ.สต.โคกใหญ่", target: 254, riskDensity: 0.59, screened: 0 },
  { id: "NS", name: "รพ.สต.นาศรี", target: 276, riskDensity: 0.57, screened: 0 },
  { id: "BK", name: "รพ.สต.บ้านขาม", target: 402, riskDensity: 0.68, screened: 0 },
  { id: "KMW", name: "รพ.สต.คำแก่นคูณ (เขตม่วงหวาน)", target: 220, riskDensity: 0.66, screened: 0 },
  { id: "KNK", name: "รพ.สต.คำแก่นคูณ (เขตหนองกุง)", target: 42, riskDensity: 0.66, screened: 0 },
  { id: "BN", name: "รพ.สต.บัวเงิน", target: 340, riskDensity: 0.58, screened: 0 },
  { id: "KS", name: "รพ.สต.กุดน้ำใส", target: 412, riskDensity: 0.72, screened: 0 },
  { id: "PT", name: "รพ.สต.พังทุย", target: 421, riskDensity: 0.83, screened: 0 },
];

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
  serviceUnitCode?: string;
};

export const TARGET_REGISTRY_SOURCE = {
  label: "รายชื่อกลางที่ทีมเตรียมไว้",
  description:
    "ใช้เป็น master list สำหรับแดชบอร์ดและทะเบียน Care Gap ไม่เริ่มจาก dashboard/query ของ IT",
  updatedAt: "2026-06-29",
};

export const PREPARED_PATIENTS: Patient[] = [
  {
    hn: "HN-1001",
    name: "สมชาย ทรายมูล",
    cid: "3400100000001",
    birth_date: "1974-02-12",
    testDate: "2026-06-01",
    subdistrict: "ทรายมูล",
    village: "หมู่ 1",
    rapid_hbv_result: "Positive",
    rapid_hcv_result: "Negative",
    hbsag: "Positive",
    hcvAb: "Negative",
    hcvVL: "Not Detected",
    persona: "The Fearful",
    care_status: "Pending",
    reported: false,
    serviceUnitCode: "SM",
  },
  {
    hn: "HN-1002",
    name: "มาลี บัวใหญ่",
    cid: "3400100000002",
    birth_date: "1968-08-20",
    testDate: "2026-05-24",
    subdistrict: "บัวใหญ่",
    village: "หมู่ 7",
    rapid_hbv_result: "Negative",
    rapid_hcv_result: "Positive",
    hbsag: "Negative",
    hcvAb: "Positive",
    hcvVL: "Pending",
    persona: "The Forgetful",
    nudge_count: 1,
    care_status: "Pending",
    reported: false,
    serviceUnitCode: "BY",
  },
  {
    hn: "HN-1003",
    name: "ประเสริฐ บ้านขาม",
    cid: "3400100000003",
    birth_date: "1980-01-05",
    testDate: "2026-06-10",
    subdistrict: "บ้านขาม",
    village: "หมู่ 8",
    rapid_hbv_result: "Negative",
    rapid_hcv_result: "Positive",
    hbsag: "Negative",
    hcvAb: "Positive",
    hcvVL: "Detected",
    persona: "The Denier",
    care_status: "Pending",
    reported: false,
    serviceUnitCode: "BL",
  },
  {
    hn: "HN-1004",
    name: "วิไล หนองกุง",
    cid: "3400100000004",
    birth_date: "1972-11-03",
    testDate: "2026-06-12",
    subdistrict: "หนองกุง",
    village: "หมู่ 3",
    rapid_hbv_result: "Negative",
    rapid_hcv_result: "Negative",
    hbsag: "Negative",
    hcvAb: "Negative",
    hcvVL: "Not Detected",
    persona: "The Engaged",
    care_status: "Complete",
    reported: true,
    serviceUnitCode: "NK",
  },
  {
    hn: "HN-1005",
    name: "บุญมี น้ำพอง",
    cid: "3400100000005",
    birth_date: "1965-04-18",
    testDate: "2026-06-15",
    subdistrict: "น้ำพอง",
    village: "หมู่ 2",
    rapid_hbv_result: "Negative",
    rapid_hcv_result: "Positive",
    hbsag: "Negative",
    hcvAb: "Positive",
    hcvVL: "Awaiting Result",
    persona: "The Striver",
    care_status: "Pending",
    reported: false,
    serviceUnitCode: "NP",
  },
  {
    hn: "HN-1006",
    name: "สุภาพ วังชัย",
    cid: "3400100000006",
    birth_date: "1970-07-09",
    testDate: "2026-06-03",
    subdistrict: "วังชัย",
    village: "หมู่ 11",
    rapid_hbv_result: "Negative",
    rapid_hcv_result: "Negative",
    hbsag: "Negative",
    hcvAb: "Negative",
    hcvVL: "Not Detected",
    persona: "The Engaged",
    care_status: "Complete",
    reported: true,
    serviceUnitCode: "WC",
  },
  {
    hn: "HN-1007",
    name: "ทองดี สะอาด",
    cid: "3400100000007",
    birth_date: "1962-09-22",
    testDate: "2026-06-05",
    subdistrict: "สะอาด",
    village: "หมู่ 6",
    rapid_hbv_result: "Positive",
    rapid_hcv_result: "Negative",
    hbsag: "Positive",
    hcvAb: "Negative",
    hcvVL: "Not Detected",
    persona: "The Fearful",
    care_status: "Pending",
    reported: false,
    serviceUnitCode: "KB",
  },
  {
    hn: "HN-1008",
    name: "ลำดวน ทรายมูล",
    cid: "3400100000008",
    birth_date: "1978-12-30",
    testDate: "2026-06-18",
    subdistrict: "ทรายมูล",
    village: "หมู่ 4",
    rapid_hbv_result: "Negative",
    rapid_hcv_result: "Positive",
    hbsag: "Negative",
    hcvAb: "Positive",
    hcvVL: "ไม่พอตรวจขอเจาะใหม่",
    persona: "The Forgetful",
    care_status: "Pending",
    reported: false,
    serviceUnitCode: "NW",
  },
  {
    hn: "HN-1009",
    name: "สำราญ ท่ากระเสริม",
    cid: "3400100000009",
    birth_date: "1969-03-14",
    testDate: "2026-06-20",
    subdistrict: "ท่ากระเสริม",
    village: "หมู่ 7",
    rapid_hbv_result: "Negative",
    rapid_hcv_result: "Negative",
    hbsag: "Negative",
    hcvAb: "Negative",
    hcvVL: "Not Detected",
    persona: "The Engaged",
    care_status: "Complete",
    reported: true,
    serviceUnitCode: "TM",
  },
  {
    hn: "HN-1010",
    name: "คำแพง ม่วงหวาน",
    cid: "3400100000010",
    birth_date: "1961-10-02",
    testDate: "2026-06-22",
    subdistrict: "ม่วงหวาน",
    village: "หมู่ 9",
    rapid_hbv_result: "Negative",
    rapid_hcv_result: "Positive",
    hbsag: "Negative",
    hcvAb: "Positive",
    hcvVL: "Detected",
    persona: "The Denier",
    care_status: "On Treatment",
    reported: true,
    serviceUnitCode: "MW",
  },
  {
    hn: "HN-1011",
    name: "สุรีย์ ท่ากระเสริม",
    cid: "3400100000011",
    birth_date: "1977-01-19",
    testDate: "2026-06-08",
    subdistrict: "ท่ากระเสริม",
    village: "หมู่ 3",
    rapid_hbv_result: "Negative",
    rapid_hcv_result: "Pending",
    hbsag: "Negative",
    hcvAb: "Pending",
    hcvVL: "Pending",
    persona: "The Striver",
    care_status: "Pending",
    reported: false,
    serviceUnitCode: "TK",
  },
  {
    hn: "HN-1012",
    name: "ประภา บัวเงิน",
    cid: "3400100000012",
    birth_date: "1964-05-27",
    testDate: "2026-06-11",
    subdistrict: "บัวเงิน",
    village: "หมู่ 9",
    rapid_hbv_result: "Negative",
    rapid_hcv_result: "Negative",
    hbsag: "Negative",
    hcvAb: "Negative",
    hcvVL: "Not Detected",
    persona: "The Engaged",
    care_status: "Complete",
    reported: true,
    serviceUnitCode: "KY",
  },
  {
    hn: "HN-1013",
    name: "ชาญชัย สะอาด",
    cid: "3400100000013",
    birth_date: "1971-06-06",
    testDate: "2026-06-09",
    subdistrict: "สะอาด",
    village: "หมู่ 1",
    rapid_hbv_result: "Positive",
    rapid_hcv_result: "Positive",
    hbsag: "Positive",
    hcvAb: "Positive",
    hcvVL: "Detected",
    persona: "The Fearful",
    care_status: "Pending",
    reported: false,
    serviceUnitCode: "NS",
  },
  {
    hn: "HN-1014",
    name: "บุญส่ง บ้านขาม",
    cid: "3400100000014",
    birth_date: "1966-02-24",
    testDate: "2026-06-07",
    subdistrict: "บ้านขาม",
    village: "หมู่ 4",
    rapid_hbv_result: "Negative",
    rapid_hcv_result: "Negative",
    hbsag: "Negative",
    hcvAb: "Negative",
    hcvVL: "Not Detected",
    persona: "The Engaged",
    care_status: "Complete",
    reported: true,
    serviceUnitCode: "BK",
  },
  {
    hn: "HN-1015",
    name: "มณี ม่วงหวาน",
    cid: "3400100000015",
    birth_date: "1963-08-16",
    testDate: "2026-06-16",
    subdistrict: "ม่วงหวาน",
    village: "หมู่ 5",
    rapid_hbv_result: "Negative",
    rapid_hcv_result: "Positive",
    hbsag: "Negative",
    hcvAb: "Positive",
    hcvVL: "รอผล",
    persona: "The Forgetful",
    care_status: "Pending",
    reported: false,
    serviceUnitCode: "KMW",
  },
  {
    hn: "HN-1016",
    name: "นิภา บัวเงิน",
    cid: "3400100000016",
    birth_date: "1975-04-01",
    testDate: "2026-06-17",
    subdistrict: "บัวเงิน",
    village: "หมู่ 4",
    rapid_hbv_result: "Negative",
    rapid_hcv_result: "Negative",
    hbsag: "Negative",
    hcvAb: "Negative",
    hcvVL: "Not Detected",
    persona: "The Engaged",
    care_status: "Complete",
    reported: true,
    serviceUnitCode: "BN",
  },
  {
    hn: "HN-1017",
    name: "เทียนชัย กุดน้ำใส",
    cid: "3400100000017",
    birth_date: "1960-12-12",
    testDate: "2026-06-21",
    subdistrict: "กุดน้ำใส",
    village: "หมู่ 3",
    rapid_hbv_result: "Negative",
    rapid_hcv_result: "Positive",
    hbsag: "Negative",
    hcvAb: "Positive",
    hcvVL: "Detected",
    persona: "The Denier",
    care_status: "On Treatment",
    reported: true,
    serviceUnitCode: "KS",
  },
  {
    hn: "HN-1018",
    name: "สายใจ พังทุย",
    cid: "3400100000018",
    birth_date: "1967-09-07",
    testDate: "2026-06-19",
    subdistrict: "พังทุย",
    village: "หมู่ 5",
    rapid_hbv_result: "Negative",
    rapid_hcv_result: "Positive",
    hbsag: "Negative",
    hcvAb: "Positive",
    hcvVL: "Detected",
    persona: "The Striver",
    care_status: "Cured",
    reported: true,
    serviceUnitCode: "PT",
  },
];

function isScreened(patient: Patient) {
  return patient.rapid_hbv_result !== "Pending" || patient.rapid_hcv_result !== "Pending";
}

function percent(value: number, total: number) {
  return total > 0 ? Number(((value / total) * 100).toFixed(2)) : 0;
}

function scoreFromPct(value: number) {
  if (value >= 90) return 5;
  if (value >= 75) return 4;
  if (value >= 60) return 3;
  if (value >= 40) return 2;
  return 1;
}

export function buildSubdistrictDashboard(patients: Patient[] = PREPARED_PATIENTS): SubDistrict[] {
  return SUBDISTRICTS.map((subdistrict) => {
    const unitPatients = patients.filter((patient) => patient.serviceUnitCode === subdistrict.id);
    const screened = unitPatients.filter(isScreened).length;
    const careGaps = unitPatients.filter(hasCareGap).length;
    const positives = unitPatients.filter(isPositive).length;
    const riskDensity = unitPatients.length
      ? Number(((positives + careGaps) / (unitPatients.length * 2)).toFixed(2))
      : 0;
    return {
      ...subdistrict,
      target: unitPatients.length,
      screened,
      riskDensity,
    };
  });
}

export function buildKpiFromPatients(patients: Patient[] = PREPARED_PATIENTS) {
  const targetPopulation = patients.length;
  const hbvScreened = patients.filter(
    (patient) => patient.rapid_hbv_result && patient.rapid_hbv_result !== "Pending",
  ).length;
  const hcvScreened = patients.filter(
    (patient) => patient.rapid_hcv_result && patient.rapid_hcv_result !== "Pending",
  ).length;
  const hcvPositive = patients.filter(
    (patient) => patient.hcvAb === "Positive" || patient.hcvVL === "Detected",
  ).length;
  const confirmed = patients.filter(
    (patient) => patient.hcvVL === "Detected" || patient.hcvVL === "Not Detected",
  ).length;
  const onTreatment = patients.filter(
    (patient) => patient.care_status === "On Treatment" || patient.care_status === "Cured",
  ).length;
  const cured = patients.filter((patient) => patient.care_status === "Cured").length;
  const hbvPct = percent(hbvScreened, targetPopulation);
  const hcvPct = percent(hcvScreened, targetPopulation);

  return {
    targetPopulation,
    hbv: { screened: hbvScreened, pct: hbvPct, score: scoreFromPct(hbvPct) },
    hcv: { screened: hcvScreened, pct: hcvPct, score: scoreFromPct(hcvPct) },
    hcvCascade: {
      screened: hcvScreened,
      positive: hcvPositive,
      confirmed,
      onTreatment,
      cured,
      linkagePct: percent(onTreatment, hcvPositive),
    },
  };
}

export const KPI = buildKpiFromPatients();

export const PERSONA_NUDGES: Record<Persona, { sms: string; script: string }> = {
  "The Fearful": {
    sms: "เรียนคุณ {name} โรงพยาบาลน้ำพองขอแจ้งว่า ผลคัดกรองไวรัสตับอักเสบควรได้รับการตรวจยืนยันเพิ่มเติม ข้อมูลของท่านเป็นความลับ นัดพบเจ้าหน้าที่ {date}",
    script:
      "1. ทักทายอย่างอบอุ่น ไม่ตัดสิน\n2. ย้ำเรื่องความเป็นส่วนตัว\n3. อธิบายว่าการตรวจยืนยันช่วยให้ดูแลได้เร็ว\n4. เสนอให้ อสม. หรือญาติช่วยพามาโรงพยาบาล",
  },
  "The Forgetful": {
    sms: "คุณ {name} มีนัดตรวจยืนยันผลไวรัสตับอักเสบที่โรงพยาบาลน้ำพอง วันที่ {date} กรุณามาก่อนเวลา 15 นาที หรือติดต่อเจ้าหน้าที่หากต้องการเลื่อนนัด",
    script:
      "1. ให้ผู้ป่วยยืนยันนัดด้วยตนเอง\n2. ส่งเตือน 3 วันก่อนนัด / 1 วันก่อนนัด / เช้าวันนัด\n3. ระบุชื่อทีมดูแลเพื่อเพิ่มความรู้สึกใกล้ชิด",
  },
  "The Denier": {
    sms: "เรียนคุณ {name} ผลตรวจของท่านควรได้รับการตรวจยืนยันเพิ่มเติม การดูแลตั้งแต่วันนี้ช่วยลดความเสี่ยงภาวะแทรกซ้อนได้ นัด {date}",
    script:
      "1. ใช้ข้อมูลที่เข้าใจง่าย\n2. เน้นว่าการตรวจยืนยันเป็นขั้นตอนป้องกัน\n3. ชวน อสม. หรือครอบครัวร่วมรับฟัง\n4. ปิดด้วยทางเลือกที่ชัดเจน",
  },
  "The Engaged": {
    sms: "ขอบคุณคุณ {name} ที่ใส่ใจสุขภาพ นัดติดตามผลครั้งถัดไป {date} ที่โรงพยาบาลน้ำพอง การมาตามนัดช่วยให้แผนดูแลต่อเนื่องและปลอดภัย",
    script: "ติดตามตามแผน ขอบคุณการให้ความร่วมมือ และชวนเป็นกำลังใจให้ผู้ป่วยรายอื่นในชุมชน",
  },
  "The Striver": {
    sms: "คุณ {name} เดินมาถูกทางแล้ว เหลือขั้นตอนตรวจยืนยันเพื่อเริ่มแผนดูแลและปิด care gap นัด {date} ที่โรงพยาบาลน้ำพอง",
    script:
      "1. ชื่นชมความพยายาม\n2. อธิบายขั้นตอนยืนยันผล\n3. เสนอความช่วยเหลือด้านเดินทางหรือประสาน อสม.",
  },
};

export const MOPH_CONFIG = {
  hospitalCode: "11000",
  hospitalName: "โรงพยาบาลน้ำพอง",
  username: "",
  password: "",
  portals: [
    {
      id: "ddsdoe",
      url: "ddsdoe.ddc.moph.go.th",
      name: "Hep-BC-DDC Portal",
      status: "connected" as const,
    },
    {
      id: "d506",
      url: "d506portal.ddc.moph.go.th",
      name: "D506 Surveillance Portal",
      status: "connected" as const,
    },
    {
      id: "doe",
      url: "doeportal.moph.go.th",
      name: "DOE National Portal",
      status: "connected" as const,
    },
  ],
};

export function isPositive(patient: Patient) {
  return (
    patient.hbsag === "Positive" || patient.hcvAb === "Positive" || patient.hcvVL === "Detected"
  );
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
