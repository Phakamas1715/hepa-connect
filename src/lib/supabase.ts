import { createClient } from '@supabase/supabase-js';
import type { Patient } from '@/lib/hepa-data';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

const hasSupabaseConfig = /^https?:\/\//.test(supabaseUrl) && !supabaseAnonKey.includes('YOUR_');

export const supabase = hasSupabaseConfig ? createClient(supabaseUrl, supabaseAnonKey) : null;

const fallbackPatients: Patient[] = [
  {
    hn: 'HN-0001',
    name: 'สมชาย ทดสอบ',
    cid: '3400000000001',
    birth_date: '1974-02-12',
    testDate: '2026-06-01',
    subdistrict: 'น้ำพอง',
    village: 'หมู่ 1',
    rapid_hbv_result: 'Positive',
    rapid_hcv_result: 'Negative',
    hbsag: 'Positive',
    hcvAb: 'Negative',
    hcvVL: 'Not Detected',
    persona: 'The Fearful',
    care_status: 'Pending',
    reported: false,
  },
  {
    hn: 'HN-0002',
    name: 'มาลี ตัวอย่าง',
    cid: '3400000000002',
    birth_date: '1968-08-20',
    testDate: '2026-05-24',
    subdistrict: 'สะอาด',
    village: 'หมู่ 4',
    rapid_hbv_result: 'Negative',
    rapid_hcv_result: 'Positive',
    hbsag: 'Negative',
    hcvAb: 'Positive',
    hcvVL: 'Pending',
    persona: 'The Forgetful',
    nudge_count: 1,
    care_status: 'Pending',
    reported: false,
  },
  {
    hn: 'HN-0003',
    name: 'ประเสริฐ จำลอง',
    cid: '3400000000003',
    birth_date: '1980-01-05',
    testDate: '2026-06-10',
    subdistrict: 'บัวใหญ่',
    village: 'หมู่ 7',
    rapid_hbv_result: 'Negative',
    rapid_hcv_result: 'Positive',
    hbsag: 'Negative',
    hcvAb: 'Positive',
    hcvVL: 'Detected',
    persona: 'The Denier',
    care_status: 'Pending',
    reported: false,
  },
];

export async function fetchPatients() {
  if (!supabase) return fallbackPatients;

  const { data, error } = await supabase
    .from('patients_care_gap')
    .select('*');

  if (error) {
    console.error('Error fetching patients:', error);
    return fallbackPatients;
  }
  return (data?.length ? data : fallbackPatients) as Patient[];
}

export async function sendNudge(recipientId: string, persona: string, messageType: string) {
  const response = await fetch('/api/send-nudge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipientId, persona, messageType }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message ?? 'ส่ง LINE nudge ไม่สำเร็จ');
  }
  return payload;
}

export async function submitMOPHReport(patientData: any, portalType: string) {
  const response = await fetch('/api/submit-moph-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patientData, portalType }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message ?? 'ส่งรายงาน MOPH ไม่สำเร็จ');
  }
  return payload;
}
