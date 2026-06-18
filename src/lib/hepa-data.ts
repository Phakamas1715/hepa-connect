// Mock data for HEPA-GLUE Engine — Nam Phong District, Khon Kaen

export const KPI = {
  targetPopulation: 6556,
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

export type SubDistrict = {
  id: string;
  name: string;
  target: number;
  riskDensity: number; // relative risk index
  screened: number;
};

export const SUBDISTRICTS: SubDistrict[] = [
  { id: "01", name: "รพ.สต.กุดน้ำใส", target: 412, riskDensity: 0.72, screened: 0 },
  { id: "02", name: "รพ.สต.สะอาด", target: 388, riskDensity: 0.81, screened: 0 },
  { id: "03", name: "รพ.สต.หนองกุง", target: 455, riskDensity: 0.65, screened: 0 },
  { id: "04", name: "รพ.สต.บัวเงิน", target: 340, riskDensity: 0.58, screened: 0 },
  { id: "05", name: "รพ.สต.บัวใหญ่", target: 367, riskDensity: 0.61, screened: 0 },
  { id: "06", name: "รพ.สต.ทรายมูล", target: 295, riskDensity: 0.49, screened: 0 },
  { id: "07", name: "รพ.สต.ม่วงหวาน", target: 318, riskDensity: 0.74, screened: 0 },
  { id: "08", name: "รพ.สต.บ้านขาม", target: 402, riskDensity: 0.68, screened: 0 },
  { id: "09", name: "รพ.สต.วังชัย", target: 376, riskDensity: 0.55, screened: 0 },
  { id: "10", name: "รพ.สต.หนองโน", target: 285, riskDensity: 0.62, screened: 0 },
  { id: "11", name: "รพ.สต.คำบง", target: 333, riskDensity: 0.7, screened: 0 },
  { id: "12", name: "รพ.สต.พังทุย", target: 421, riskDensity: 0.83, screened: 0 },
  { id: "13", name: "รพ.สต.ท่ากระเสริม", target: 298, riskDensity: 0.52, screened: 0 },
  { id: "14", name: "รพ.สต.บ้านโคก", target: 356, riskDensity: 0.6, screened: 0 },
  { id: "15", name: "รพ.สต.โนนทอง", target: 312, riskDensity: 0.57, screened: 0 },
  { id: "16", name: "รพ.สต.ห้วยโจด", target: 274, riskDensity: 0.46, screened: 0 },
  { id: "17", name: "รพ.สต.โคกสูง", target: 361, riskDensity: 0.69, screened: 0 },
  { id: "18", name: "รพ.สต.นาฝาย", target: 263, riskDensity: 0.51, screened: 0 },
];

export function allocateKits(totalKits: number, subs: SubDistrict[]) {
  const totalTarget = subs.reduce((s, x) => s + x.target, 0);
  const totalRisk = subs.reduce((s, x) => s + x.riskDensity, 0);
  return subs.map((s) => {
    const alloc =
      totalKits * (0.6 * (s.target / totalTarget) + 0.4 * (s.riskDensity / totalRisk));
    return { ...s, allocation: Math.round(alloc) };
  });
}

export type Persona = "The Forgetful" | "The Fearful" | "The Denier" | "The Engaged";

export type Patient = {
  hn: string;
  name: string;
  village: string;
  subdistrict: string;
  testDate: string;
  fiscalYear: string;
  hbsag: "Positive" | "Negative" | "N/A";
  hbsab: "Positive" | "Negative" | "N/A";
  hcvAb: "Positive" | "Negative" | "N/A";
  hcvVL: "Detected" | "Not Detected" | "รอผล" | "ไม่พอตรวจขอเจาะใหม่" | "N/A";
  persona: Persona;
  reported?: boolean;
  txId?: string;
  reportedAt?: string;
};

export const PATIENTS: Patient[] = [
  { hn: "NPH-66-0142", name: "นายสมชาย ทองดี", village: "บ้านกุดน้ำใส ม.3", subdistrict: "กุดน้ำใส", testDate: "2026-01-12", fiscalYear: "2569", hbsag: "Positive", hbsab: "Negative", hcvAb: "Negative", hcvVL: "N/A", persona: "The Fearful" },
  { hn: "NPH-66-0188", name: "นางมาลี ศรีสุข", village: "บ้านสะอาด ม.1", subdistrict: "สะอาด", testDate: "2026-01-18", fiscalYear: "2569", hbsag: "Negative", hbsab: "Negative", hcvAb: "Positive", hcvVL: "รอผล", persona: "The Forgetful" },
  { hn: "NPH-66-0214", name: "นายบุญมา แก้วใส", village: "บ้านหนองกุง ม.5", subdistrict: "หนองกุง", testDate: "2026-01-22", fiscalYear: "2569", hbsag: "Negative", hbsab: "Negative", hcvAb: "Positive", hcvVL: "ไม่พอตรวจขอเจาะใหม่", persona: "The Denier" },
  { hn: "NPH-66-0231", name: "นางสาวพิมพ์ใจ จันทร์เพ็ญ", village: "บ้านพังทุย ม.2", subdistrict: "พังทุย", testDate: "2026-01-25", fiscalYear: "2569", hbsag: "Positive", hbsab: "Negative", hcvAb: "Negative", hcvVL: "N/A", persona: "The Forgetful" },
  { hn: "NPH-66-0256", name: "นายประยูร อินทร์แก้ว", village: "บ้านม่วงหวาน ม.4", subdistrict: "ม่วงหวาน", testDate: "2026-02-02", fiscalYear: "2569", hbsag: "Negative", hbsab: "Negative", hcvAb: "Positive", hcvVL: "Detected", persona: "The Fearful" },
  { hn: "NPH-66-0271", name: "นางบัวลา ทาสีคำ", village: "บ้านบัวเงิน ม.6", subdistrict: "บัวเงิน", testDate: "2026-02-05", fiscalYear: "2569", hbsag: "Negative", hbsab: "Positive", hcvAb: "Negative", hcvVL: "N/A", persona: "The Engaged" },
  { hn: "NPH-66-0289", name: "นายคำพา ดวงดี", village: "บ้านขาม ม.7", subdistrict: "บ้านขาม", testDate: "2026-02-09", fiscalYear: "2569", hbsag: "Positive", hbsab: "Negative", hcvAb: "Positive", hcvVL: "รอผล", persona: "The Denier" },
  { hn: "NPH-66-0301", name: "นางสมหญิง ภูมิดี", village: "บ้านวังชัย ม.2", subdistrict: "วังชัย", testDate: "2026-02-14", fiscalYear: "2569", hbsag: "Negative", hbsab: "Negative", hcvAb: "Positive", hcvVL: "ไม่พอตรวจขอเจาะใหม่", persona: "The Forgetful" },
  { hn: "NPH-66-0318", name: "นายเสริมศักดิ์ พงษ์ศรี", village: "บ้านคำบง ม.1", subdistrict: "คำบง", testDate: "2026-02-18", fiscalYear: "2569", hbsag: "Positive", hbsab: "Negative", hcvAb: "Negative", hcvVL: "N/A", persona: "The Fearful" },
  { hn: "NPH-66-0327", name: "นางอรทัย แสงทอง", village: "บ้านโคกสูง ม.8", subdistrict: "โคกสูง", testDate: "2026-02-21", fiscalYear: "2569", hbsag: "Negative", hbsab: "Negative", hcvAb: "Positive", hcvVL: "Detected", persona: "The Engaged" },
  { hn: "NPH-66-0344", name: "นายทวีศักดิ์ พรมมา", village: "บ้านทรายมูล ม.3", subdistrict: "ทรายมูล", testDate: "2026-02-26", fiscalYear: "2569", hbsag: "Positive", hbsab: "Negative", hcvAb: "Negative", hcvVL: "N/A", persona: "The Forgetful" },
  { hn: "NPH-66-0359", name: "นางสมปอง ใจดี", village: "บ้านนาฝาย ม.5", subdistrict: "นาฝาย", testDate: "2026-03-01", fiscalYear: "2569", hbsag: "Negative", hbsab: "Positive", hcvAb: "Negative", hcvVL: "N/A", persona: "The Engaged" },
];

export const PERSONA_NUDGES: Record<Persona, { sms: string; script: string }> = {
  "The Fearful": {
    sms: "เรียน {name} โรงพยาบาลน้ำพองขอเรียนว่า ยา Sofvel รักษาไวรัสตับอักเสบซีหายขาด 99% และฟรี 100% ตามนโยบายรัฐ ปลอดภัย ไม่มีผลข้างเคียงรุนแรง นัดพบแพทย์ {date} โทร 043-xxx-xxx",
    script:
      "1) ทักทายอย่างอบอุ่น ไม่ตัดสิน\n2) เน้นความเป็นความลับและสิทธิผู้ป่วย\n3) สื่อสาร: 'การรักษาฟรี 100% และผู้ป่วยกว่า 99% หายขาดภายใน 12 สัปดาห์'\n4) ไม่ใช้คำว่า 'โรคร้าย' — ใช้ 'ภาวะที่รักษาให้หายได้'\n5) เสนอนัดแบบยืดหยุ่น มี อสม. พาไป",
  },
  "The Forgetful": {
    sms: "คุณ {name} — นัดเจาะเลือดยืนยันผลที่ รพ.น้ำพอง วัน{date} เวลา 08:00 น. กรุณามาก่อนเวลา 15 นาที ตอบ '1' เพื่อยืนยัน หรือโทร 043-xxx-xxx",
    script:
      "1) ใช้ Nudge แบบ Commitment Device — ให้ผู้ป่วยยืนยันด้วยตนเอง\n2) ส่ง SMS เตือน 3 ครั้ง: 3 วันก่อน / 1 วันก่อน / เช้าวันนัด\n3) ระบุชื่อแพทย์ ชื่อพยาบาลเฉพาะ (Personal Touch)\n4) เสนอ Default Option: 'นัดอัตโนมัติทุกวันพุธ เว้นแต่จะแจ้งเลื่อน'",
  },
  "The Denier": {
    sms: "เรียน {name} ผลตรวจของท่านต้องการการยืนยันเพิ่มเติม การละเลยอาจนำไปสู่ภาวะตับแข็ง — แต่หากรักษาวันนี้ มีโอกาสหาย 99% ฟรีทั้งหมด นัด {date}",
    script:
      "1) ใช้ Loss Aversion Framing — เน้นสิ่งที่จะเสียหากไม่รักษา\n2) ยกตัวอย่างผู้ป่วยในชุมชนที่หายขาด (Social Proof)\n3) ให้ข้อมูลทางวิทยาศาสตร์ พร้อม Visual Aid\n4) ชวน อสม. หรือสมาชิกครอบครัวร่วมรับฟัง\n5) ปิดด้วย: 'การไม่ตัดสินใจ ก็คือการเลือกที่จะเสี่ยง'",
  },
  "The Engaged": {
    sms: "ขอบคุณคุณ {name} ที่ใส่ใจสุขภาพ นัดติดตามผลครั้งถัดไป {date} ที่ รพ.น้ำพอง",
    script: "ติดตามปกติ ขอบคุณการให้ความร่วมมือ — ใช้เป็น Champion Patient เพื่อเป็นกำลังใจให้ผู้อื่น",
  },
};

export const MOPH_CONFIG = {
  hospitalCode: "11000",
  hospitalName: "โรงพยาบาลน้ำพอง",
  username: "jane",
  password: "Nph133",
  portals: [
    { id: "ddsdoe", url: "ddsdoe.ddc.moph.go.th", name: "Hep-BC-DDC Portal", status: "connected" as const },
    { id: "d506", url: "d506portal.ddc.moph.go.th", name: "D506 Surveillance Portal", status: "connected" as const },
    { id: "doe", url: "doeportal.moph.go.th", name: "DOE National Portal", status: "connected" as const },
  ],
};

export function isPositive(p: Patient) {
  return p.hbsag === "Positive" || p.hcvAb === "Positive";
}

export function hasCareGap(p: Patient) {
  return p.hcvVL === "รอผล" || p.hcvVL === "ไม่พอตรวจขอเจาะใหม่" || isPositive(p);
}
