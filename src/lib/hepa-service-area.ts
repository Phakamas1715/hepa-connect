import type { Patient } from "@/lib/hepa-data";

export type HepaServiceUnitType = "primary_care" | "hospital";

export type HepaServiceUnit = {
  code: string;
  unitName: string;
  unitType: HepaServiceUnitType;
};

export type HepaServiceArea = HepaServiceUnit & {
  subdistrict: string;
  villages: number[];
  coverageNote?: string;
};

const HOSPITAL_NAMPHONG: HepaServiceUnit = {
  code: "NPH",
  unitName: "โรงพยาบาลน้ำพอง",
  unitType: "hospital",
};

export const HEPA_PRIMARY_CARE_UNITS: HepaServiceUnit[] = [
  { code: "SM", unitName: "โรงพยาบาลส่งเสริมสุขภาพตำบลทรายมูล", unitType: "primary_care" },
  { code: "BY", unitName: "โรงพยาบาลส่งเสริมสุขภาพตำบลบัวใหญ่", unitType: "primary_care" },
  { code: "BL", unitName: "โรงพยาบาลส่งเสริมสุขภาพตำบลบ้านเหล่าใหญ่", unitType: "primary_care" },
  { code: "NK", unitName: "โรงพยาบาลส่งเสริมสุขภาพตำบลหนองกุง", unitType: "primary_care" },
  {
    code: "NP",
    unitName: "โรงพยาบาลส่งเสริมสุขภาพตำบลน้ำพอง (เขตน้ำพอง)",
    unitType: "primary_care",
  },
  {
    code: "NPGKS",
    unitName: "โรงพยาบาลส่งเสริมสุขภาพตำบลน้ำพอง (เขตกุดน้ำใส)",
    unitType: "primary_care",
  },
  { code: "WC", unitName: "โรงพยาบาลส่งเสริมสุขภาพตำบลวังชัย", unitType: "primary_care" },
  { code: "KB", unitName: "โรงพยาบาลส่งเสริมสุขภาพตำบลบ้านคำบง", unitType: "primary_care" },
  { code: "NW", unitName: "โรงพยาบาลส่งเสริมสุขภาพตำบลบ้านหนองหว้า", unitType: "primary_care" },
  { code: "TM", unitName: "โรงพยาบาลส่งเสริมสุขภาพตำบลบ้านท่ามะเดื่อ", unitType: "primary_care" },
  { code: "MW", unitName: "โรงพยาบาลส่งเสริมสุขภาพตำบลม่วงหวาน", unitType: "primary_care" },
  { code: "TK", unitName: "โรงพยาบาลส่งเสริมสุขภาพตำบลท่ากระเสริม", unitType: "primary_care" },
  { code: "KY", unitName: "โรงพยาบาลส่งเสริมสุขภาพตำบลโคกใหญ่", unitType: "primary_care" },
  { code: "NS", unitName: "โรงพยาบาลส่งเสริมสุขภาพตำบลนาศรี", unitType: "primary_care" },
  { code: "BK", unitName: "โรงพยาบาลส่งเสริมสุขภาพตำบลบ้านขาม", unitType: "primary_care" },
  {
    code: "KMW",
    unitName: "โรงพยาบาลส่งเสริมสุขภาพตำบลคำแก่นคูณ (เขตม่วงหวาน)",
    unitType: "primary_care",
  },
  {
    code: "KNK",
    unitName: "โรงพยาบาลส่งเสริมสุขภาพตำบลคำแก่นคูณ (เขตหนองกุง)",
    unitType: "primary_care",
  },
  { code: "BN", unitName: "โรงพยาบาลส่งเสริมสุขภาพตำบลบัวเงิน", unitType: "primary_care" },
  { code: "KS", unitName: "โรงพยาบาลส่งเสริมสุขภาพตำบลกุดน้ำใส", unitType: "primary_care" },
  { code: "PT", unitName: "โรงพยาบาลส่งเสริมสุขภาพตำบลพังทุย", unitType: "primary_care" },
];

function unit(code: string) {
  const found = HEPA_PRIMARY_CARE_UNITS.find((item) => item.code === code);
  if (!found) throw new Error(`Unknown HEPA service unit: ${code}`);
  return found;
}

export const HEPA_SERVICE_AREAS: HepaServiceArea[] = [
  {
    ...HOSPITAL_NAMPHONG,
    subdistrict: "น้ำพอง",
    villages: [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17],
  },
  { ...unit("SM"), subdistrict: "ทรายมูล", villages: [1, 2, 3, 7, 8, 9, 11] },
  {
    ...unit("BY"),
    subdistrict: "บัวใหญ่",
    villages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
  },
  { ...unit("BL"), subdistrict: "บ้านขาม", villages: [8, 11, 12, 13] },
  { ...unit("NK"), subdistrict: "หนองกุง", villages: [1, 2, 3, 4, 5, 6, 8, 9, 10, 11] },
  { ...unit("NP"), subdistrict: "น้ำพอง", villages: [2, 13], coverageNote: "เขตน้ำพอง" },
  {
    ...unit("NPGKS"),
    subdistrict: "กุดน้ำใส",
    villages: [6, 7, 8, 9],
    coverageNote: "เขตกุดน้ำใส",
  },
  {
    ...unit("WC"),
    subdistrict: "วังชัย",
    villages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
  },
  { ...unit("KB"), subdistrict: "สะอาด", villages: [6, 7, 8, 9, 11, 13, 14] },
  { ...unit("NW"), subdistrict: "ทรายมูล", villages: [4, 5, 6, 10] },
  { ...unit("TM"), subdistrict: "ท่ากระเสริม", villages: [6, 7, 8, 9] },
  { ...unit("MW"), subdistrict: "ม่วงหวาน", villages: [1, 2, 3, 4, 9, 11, 13, 14] },
  { ...unit("TK"), subdistrict: "ท่ากระเสริม", villages: [1, 2, 3, 4, 5, 10] },
  { ...unit("KY"), subdistrict: "บัวเงิน", villages: [8, 9, 11, 13] },
  { ...unit("NS"), subdistrict: "สะอาด", villages: [1, 2, 3, 4, 5, 10, 12] },
  { ...unit("BK"), subdistrict: "บ้านขาม", villages: [1, 2, 3, 4, 5, 6, 7, 9, 10] },
  {
    ...unit("KMW"),
    subdistrict: "ม่วงหวาน",
    villages: [5, 6, 7, 8, 10],
    coverageNote: "เขตม่วงหวาน",
  },
  { ...unit("KNK"), subdistrict: "หนองกุง", villages: [8], coverageNote: "เขตหนองกุง" },
  {
    ...unit("BN"),
    subdistrict: "บัวเงิน",
    villages: [1, 2, 3, 4, 5, 6, 7, 10, 12, 14, 15, 16, 17],
  },
  { ...unit("KS"), subdistrict: "กุดน้ำใส", villages: [1, 2, 3, 4, 5, 10] },
  { ...unit("PT"), subdistrict: "พังทุย", villages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] },
];

function normalizeThaiText(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, "");
}

export function normalizeVillageNo(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const match = String(value).match(/\d+/);
  return match ? Number(match[0]) : null;
}

export function resolveHepaServiceArea(input: Pick<Patient, "subdistrict" | "village">) {
  const subdistrict = normalizeThaiText(input.subdistrict);
  const villageNo = normalizeVillageNo(input.village);
  if (!subdistrict || villageNo === null) return null;

  const matches = HEPA_SERVICE_AREAS.filter(
    (area) =>
      normalizeThaiText(area.subdistrict) === subdistrict && area.villages.includes(villageNo),
  );
  return matches.at(-1) ?? null;
}
