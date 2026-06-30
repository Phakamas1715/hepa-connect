import puppeteer from 'puppeteer';
import { serverEnv } from './server-env';

export interface ScreenedTestResult {
  hn?: string;
  date?: string;
  age?: number;
  sex?: 'M' | 'F' | string;
  symptom?: string;
  icd10?: string;
  lab_result?: string;
  passed_screening?: boolean;
  // add more from HOSxP
}

export interface CleanedSyndromicRecord {
  hospital_code: string;
  report_date: string;
  age_group: string;
  sex: string;
  diagnosis_code?: string;
  lab_result?: string;
  symptom_code?: string;
  // add fields matching the syndromic form
}

export function cleanHospitalTestResults(raw: ScreenedTestResult[]): CleanedSyndromicRecord[] {
  return raw
    .filter(r => r.passed_screening !== false) // only those that passed hospital screening
    .map(r => {
      const reportDate = r.date ? new Date(r.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      const ageGroup = r.age != null 
        ? (r.age < 5 ? '0-4' : r.age < 15 ? '5-14' : r.age < 65 ? '15-64' : '65+')
        : 'unknown';
      const sex = (r.sex || '').toUpperCase().startsWith('M') ? 'ชาย' : 'หญิง';

      return {
        hospital_code: '11000',
        report_date: reportDate,
        age_group: ageGroup,
        sex,
        diagnosis_code: r.icd10 || '',
        lab_result: r.lab_result || '',
        symptom_code: r.symptom || r.icd10 || '',
      };
    });
}

export async function autoFillSyndromicReport(records: CleanedSyndromicRecord[], credentials?: {user: string; pass: string}) {
  const user = credentials?.user || serverEnv('MOPH_USERNAME') || 'Jane';
  const pass = credentials?.pass || serverEnv('MOPH_PASSWORD') || 'Nph133';
  const hospitalCode = serverEnv('MOPH_HOSPITAL_CODE') || '11000';

  if (!user || !pass) {
    throw new Error('Missing MOPH credentials (Jane / Nph133)');
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  try {
    // 1. Login
    await page.goto('https://ddsdoe.ddc.moph.go.th/syndromic/login', { waitUntil: 'networkidle2' });
    await page.type('input[name="username"], input[name="user"], input[type="text"]', user, { delay: 50 });
    await page.type('input[name="password"], input[name="pass"], input[type="password"]', pass, { delay: 50 });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.click('button[type="submit"], input[type="submit"], button:has-text("เข้าสู่ระบบ"), button:has-text("Login")'),
    ]);

    // 2. Navigate to syndromic report (adjust selector/path as needed)
    // Common for ILI/syndromic: /syndromic/syndromicreport/ili or daily entry
    await page.goto('https://ddsdoe.ddc.moph.go.th/syndromic/syndromicreport/ili', { waitUntil: 'networkidle2' });

    // 3. Auto fill for hospital 11000 and the cleaned records (aggregate or per case)
    // Example: fill daily aggregate or loop for each record
    // Adjust selectors based on actual form (inspect once logged in)
    const grouped = records.reduce((acc, r) => {
      const key = r.report_date;
      if (!acc[key]) acc[key] = { total: 0, byAge: {} as any };
      acc[key].total++;
      acc[key].byAge[r.age_group] = (acc[key].byAge[r.age_group] || 0) + 1;
      return acc;
    }, {} as any);

    for (const [date, data] of Object.entries(grouped)) {
      // Example fills - UPDATE THESE SELECTORS AFTER INSPECTING THE FORM
      try {
        await page.waitForSelector('input[name*="date"], input[type="date"]', { timeout: 5000 });
        await page.type('input[name*="date"], input[type="date"]', date);
        await page.type('input[name*="hospital"], select[name*="hospital"]', hospitalCode);

        // Fill counts (example for ILI)
        const totalInput = await page.$('input[name*="ili_total"], input[name*="total"]');
        if (totalInput) await totalInput.type(String((data as any).total));

        // Age group fields - map as needed
        // e.g. await page.type('input[name="age_0_4"]', String((data as any).byAge['0-4'] || 0));

        // Submit the form
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2' }),
          page.click('button[type="submit"], input[type="submit"]'),
        ]);

        console.log(`Submitted syndromic report for ${date} hospital ${hospitalCode}`);
      } catch (e) {
        console.error('Form fill error for date', date, e);
      }
    }

    return { success: true, submitted: Object.keys(grouped).length, records: records.length };
  } finally {
    await browser.close();
  }
}

export async function submitCleanedToMOPH(
  rawResults: ScreenedTestResult[],
  portalType = 'ddsdoe'
) {
  const cleaned = cleanHospitalTestResults(rawResults);
  if (portalType === 'ddsdoe') {
    return autoFillSyndromicReport(cleaned);
  }
  // add other portals
  return { success: false, message: 'unsupported portal' };
}
