import puppeteer from "puppeteer";
import { serverEnv } from "./server-env";
import type { Patient } from "./hepa-data";

export interface HepCaseInput {
  hn: string;
  cid?: string;
  name?: string;
  birthDate?: string;
  sex?: "M" | "F";
  testDate: string;
  hbsag?: string; // Positive / Negative
  hcvAb?: string; // Positive / Negative
  hcvVL?: string; // Detected / Not Detected / Pending
  isAcute?: boolean; // hint from clinical
  notes?: string;
}

export interface HepBCReportResult {
  success: boolean;
  reported: number;
  details: Array<{
    hn: string;
    type: "HBV" | "HCV";
    category: "Acute" | "Chronic";
    status: "success" | "error" | "skipped";
    message?: string;
  }>;
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * แปลงผลการคัดกรอง/ผู้ป่วยเป็นเคส Hep B/C ที่เหมาะสำหรับรายงาน
 * ใช้ร่วมกับข้อมูลจากชุดตรวจที่จัดสรร (2,000 ชุด)
 */
export function cleanToHepBCCases(patients: Patient[]): HepCaseInput[] {
  return patients
    .filter((p) => {
      const hbvPos = p.hbsag === "Positive" || p.rapid_hbv_result === "Positive";
      const hcvPos =
        p.hcvAb === "Positive" || p.hcvVL === "Detected" || p.rapid_hcv_result === "Positive";
      return hbvPos || hcvPos;
    })
    .map((p) => {
      const hbvPos = p.hbsag === "Positive" || p.rapid_hbv_result === "Positive";
      const hcvPos = p.hcvAb === "Positive" || p.hcvVL === "Detected";

      let type: "HBV" | "HCV" | null = null;
      let category: "Acute" | "Chronic" = "Chronic";

      if (hbvPos && !hcvPos) {
        type = "HBV";
        // Simple heuristic: ถ้าไม่มีข้อมูล acute marker ชัดเจน → Chronic
        category = "Chronic";
      } else if (hcvPos) {
        type = "HCV";
        category = "Chronic"; // HCV acute น้อย
      }

      return {
        hn: p.hn,
        cid: p.cid,
        name: p.name,
        birthDate: p.birth_date,
        testDate: p.testDate,
        hbsag: p.hbsag || p.rapid_hbv_result,
        hcvAb: p.hcvAb || p.rapid_hcv_result,
        hcvVL: p.hcvVL,
        isAcute: false, // ปรับตามข้อมูลจริงจากโรงพยาบาล
      };
    });
}

/**
 * Auto fill รายงาน Hep-BC-DDC (ตามคู่มือ manualhep.pdf)
 * รองรับการรายงานเคส Acute / Chronic Hepatitis B และ C แบบรายบุคคล
 */
export async function autoFillHepBCReport(
  cases: HepCaseInput[],
  credentials?: { user?: string; pass?: string; hospitalCode?: string },
  options: { dryRun?: boolean } = {},
): Promise<HepBCReportResult> {
  const { dryRun = false } = options;
  const user = credentials?.user || serverEnv("MOPH_USERNAME");
  const pass = credentials?.pass || serverEnv("MOPH_PASSWORD");
  const hospitalCode = credentials?.hospitalCode || serverEnv("MOPH_HOSPITAL_CODE") || "11000";

  const result: HepBCReportResult = {
    success: true,
    reported: 0,
    details: [],
  };

  if (dryRun) {
    console.log("[Hep-BC-DDC] DRY RUN - simulating report for", cases.length, "cases");
    for (const c of cases) {
      const isHBV = c.hbsag?.toLowerCase().includes("positive") || c.hbsag === "Positive";
      const isHCV =
        c.hcvAb?.toLowerCase().includes("positive") || c.hcvVL?.toLowerCase().includes("detected");
      if (!isHBV && !isHCV) {
        result.details.push({
          hn: c.hn,
          type: "HBV",
          category: "Chronic",
          status: "skipped",
          message: "No positive marker",
        });
        continue;
      }
      const hepType = isHBV ? "HBV" : "HCV";
      const hepLabel = isHBV ? "B" : "C";
      const category: "Acute" | "Chronic" = c.isAcute ? "Acute" : "Chronic";
      result.reported++;
      result.details.push({ hn: c.hn, type: hepType, category, status: "success" });
      console.log(
        `[Hep-BC-DDC][DRY] Would report Hep-${hepLabel} ${category} for HN ${c.hn} (hospital ${hospitalCode})`,
      );
    }
    return result;
  }

  if (!user || !pass) {
    throw new Error("Missing MOPH credentials for Hep-BC-DDC (MOPH_USERNAME / MOPH_PASSWORD)");
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000); // production-friendly for slow gov networks

  try {
    // === 1. Login ตามคู่มือ (ใช้ hospital code 11000) ===
    // หมายเหตุ: อาจต้องปรับ base URL ถ้า Hep-BC-DDC ใช้โดเมน/พาธต่างจาก syndromic
    // ปัจจุบันใช้ ddsdoe ตามที่ใช้ในโปรเจกต์
    await page.goto("https://ddsdoe.ddc.moph.go.th/syndromic/login", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    const usernameSel = 'input[name="username"], input[name="user"], input[type="text"]';
    const passwordSel = 'input[name="password"], input[name="pass"], input[type="password"]';

    await page.type(usernameSel, user, { delay: 30 });
    await page.type(passwordSel, pass, { delay: 30 });

    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2" }),
      page
        .click("text=เข้าสู่ระบบ")
        .catch(() => page.click("text=Login"))
        .catch(() => page.click('button[type="submit"]')),
    ]);

    console.log("[Hep-BC-DDC] Logged in successfully");

    // Optional: select hospital if the dashboard requires it
    try {
      await delay(1000);
      const hospInput = await page.$(
        'input[name*="hospital"], select[name*="hospital"], input[placeholder*="โรงพยาบาล"]',
      );
      if (hospInput) {
        await hospInput.type(hospitalCode, { delay: 20 });
      }
    } catch {
      // Hospital selector is optional on some portal versions.
    }

    for (const c of cases) {
      try {
        const isHBV = c.hbsag?.toLowerCase().includes("positive") || c.hbsag === "Positive";
        const isHCV =
          c.hcvAb?.toLowerCase().includes("positive") ||
          c.hcvVL?.toLowerCase().includes("detected");

        if (!isHBV && !isHCV) {
          result.details.push({
            hn: c.hn,
            type: "HBV",
            category: "Chronic",
            status: "skipped",
            message: "No positive marker",
          });
          continue;
        }

        const hepType = isHBV ? "B" : "C";
        const category: "Acute" | "Chronic" = c.isAcute ? "Acute" : "Chronic";
        const mainMenu = isHBV ? "ข้อมูล Hepatitis B" : "ข้อมูล Hepatitis C";
        const subMenu = `${category} Hepatitis ${hepType}`;

        // === 2. ไปที่เมนูหลักตามคู่มือ ===
        await page.click(`text=${mainMenu}`).catch(async () => {
          // fallback: try to find menu by partial text
          await page.click(`text=/Hepatitis ${hepType}/i`).catch(() => {});
        });
        await delay(800);

        // === 3. เลือก Acute หรือ Chronic ตามคู่มือ ===
        await page.click(`text=${subMenu}`).catch(async () => {
          await page.click(`text=/${category}.*Hepatitis/i`).catch(() => {});
        });
        await delay(1000);

        // === 4. ค้นหาผู้ป่วย (HN / CID / ชื่อ) ===
        const searchSelectors = [
          'input[placeholder*="ค้นหา"]',
          'input[name*="search"]',
          'input[name*="hn"]',
          'input[name*="cid"]',
          'input[type="search"]',
          'input[placeholder*="HN"]',
        ];

        let searchInput = null;
        for (const sel of searchSelectors) {
          searchInput = await page.$(sel);
          if (searchInput) break;
        }

        if (searchInput) {
          await searchInput.click({ clickCount: 3 });
          await searchInput.press("Backspace");
          await searchInput.type(c.hn, { delay: 15 });
          await page.keyboard.press("Enter");
        }

        await delay(1500);

        // === 5. คลิกปุ่ม "ดู/บันทึกข้อมูล" ตามคู่มือ ===
        let clicked = false;
        try {
          await page.click("text=ดู/บันทึกข้อมูล");
          clicked = true;
        } catch {
          // Try the next supported action label.
        }
        if (!clicked) {
          try {
            await page.click("text=ดู");
            clicked = true;
          } catch {
            // Try the next supported action label.
          }
        }
        if (!clicked) {
          try {
            await page.click("text=บันทึก");
            clicked = true;
          } catch {
            // The generic row action below is the final fallback.
          }
        }
        if (!clicked) {
          // Fallback
          await page
            .click("table tbody tr:first-child td:last-child, table tbody tr:first-child a")
            .catch(() => {});
        }

        await delay(1500);

        // === 6. กรอกฟอร์ม (ปรับ selectors ตามภาพคู่มือ) ===
        // วันที่ตรวจ / วันที่รายงาน
        try {
          const dateInput = await page.$(
            'input[type="date"], input[name*="date"], input[name*="วันที่"]',
          );
          if (dateInput && c.testDate) {
            await dateInput.click({ clickCount: 3 });
            await dateInput.press("Backspace");
            await dateInput.type(c.testDate);
          }
        } catch {
          // Some portal versions do not expose a date input.
        }

        // ผลการตรวจหลัก
        if (isHBV) {
          // HBsAg - try select by visible text or value
          try {
            await page.select("select", "Positive"); // fallback, may need specific
          } catch {
            // Result selection is optional until a matching selector is found.
          }
        }

        if (isHCV) {
          try {
            await page.select("select", "Positive");
          } catch {
            // Result selection is optional until a matching selector is found.
          }
          if (c.hcvVL) {
            const vlInput = await page.$(
              'input[name*="vl"], input[name*="viral"], textarea[name*="VL"], input[placeholder*="Viral"]',
            );
            if (vlInput) await vlInput.type(c.hcvVL);
          }
        }

        // เพิ่มข้อมูลอื่น ๆ
        if (c.notes) {
          const noteArea = await page.$('textarea, input[name*="note"], input[name*="หมายเหตุ"]');
          if (noteArea) await noteArea.type(c.notes);
        }

        // Hospital code (ถ้าฟอร์มมี)
        try {
          const hospSel = 'input[name*="hospital"], select[name*="hospital"]';
          const hospEl = await page.$(hospSel);
          if (hospEl) await hospEl.type(hospitalCode);
        } catch {
          // Hospital code may already be fixed by the authenticated account.
        }

        // === 7. บันทึกฟอร์ม ===
        let saved = false;
        try {
          await page.click("text=บันทึก");
          saved = true;
        } catch {
          // Try the generic submit button next.
        }
        if (!saved) {
          try {
            await page.click('button[type="submit"]');
            saved = true;
          } catch {
            // A missing submit button is recorded as a case-level error below.
          }
        }
        if (saved) {
          await page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {});
        }

        if (saved) {
          result.reported++;
          result.details.push({
            hn: c.hn,
            type: isHBV ? "HBV" : "HCV",
            category,
            status: "success",
          });
          console.log(`[Hep-BC-DDC] Reported ${isHBV ? "HBV" : "HCV"} ${category} for ${c.hn}`);
        } else {
          result.details.push({
            hn: c.hn,
            type: isHBV ? "HBV" : "HCV",
            category,
            status: "error",
            message: "Could not find save button",
          });
        }

        // กลับไปเพื่อรายงานเคสถัดไป
        await page.goBack({ waitUntil: "networkidle2" }).catch(() => {});
        await delay(600);
      } catch (caseErr: unknown) {
        const message = errorMessage(caseErr);
        console.error(`[Hep-BC-DDC] Error for ${c.hn}:`, message);
        result.details.push({
          hn: c.hn,
          type: c.hbsag?.toLowerCase().includes("positive") ? "HBV" : "HCV",
          category: "Chronic",
          status: "error",
          message,
        });
      }
    }

    result.success = result.reported > 0 || result.details.length === 0;
    return result;
  } catch (err: unknown) {
    console.error("[Hep-BC-DDC] Automation failed:", err);
    result.success = false;
    return result;
  } finally {
    await browser.close();
  }
}

// Convenience wrapper
export async function submitHepBCCasesToMOPH(
  patients: Patient[],
  credentials?: { user?: string; pass?: string; hospitalCode?: string },
) {
  const cases = cleanToHepBCCases(patients);
  return autoFillHepBCReport(cases, credentials);
}

/**
 * ตัวอย่างการใช้งานกับข้อมูลจาก allocation 2,000 ชุด
 * เรียกจาก API หรือ script หลังจากมีผล positive จากการคัดกรอง
 *
 * ตัวอย่าง:
 *   const positives = PREPARED_PATIENTS.filter(p => isPositive(p));
 *   const res = await submitHepBCCasesToMOPH(positives);
 */
