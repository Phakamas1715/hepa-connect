import { createClient } from "@supabase/supabase-js";
import { PREPARED_PATIENTS } from "@/lib/hepa-data";
import type { Patient } from "@/lib/hepa-data";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "YOUR_SUPABASE_URL";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY";
const patientSource = import.meta.env.VITE_PATIENT_SOURCE || "prepared-list";

const hasSupabaseConfig = /^https?:\/\//.test(supabaseUrl) && !supabaseAnonKey.includes("YOUR_");

export const supabase = hasSupabaseConfig ? createClient(supabaseUrl, supabaseAnonKey) : null;

export async function fetchPatients() {
  if (patientSource !== "supabase") return PREPARED_PATIENTS;
  if (!supabase) return PREPARED_PATIENTS;

  const { data, error } = await supabase.from("patients_care_gap").select("*");

  if (error) {
    console.error("Error fetching patients:", error);
    return PREPARED_PATIENTS;
  }
  return (data?.length ? data : PREPARED_PATIENTS) as Patient[];
}

export async function sendNudge(recipientId: string, persona: string, messageType: string) {
  const response = await fetch("/api/send-nudge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipientId, persona, messageType }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message ?? "ส่ง LINE nudge ไม่สำเร็จ");
  }
  return payload;
}

export async function submitMOPHReport(patientData: unknown, portalType: string) {
  const response = await fetch("/api/submit-moph-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patientData, portalType }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message ?? "ส่งรายงาน MOPH ไม่สำเร็จ");
  }
  return payload;
}
