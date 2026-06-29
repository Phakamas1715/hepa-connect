import type { Patient, Persona } from "@/lib/hepa-data";
import { hasCareGap, isPositive } from "@/lib/hepa-data";

type ScoreBand = "low" | "watch" | "high" | "critical";

export type HepaRaaiaScore = {
  score: number;
  band: ScoreBand;
  personaMultiplier: number;
  penalty: number;
  components: {
    clinicalRisk: number;
    adherenceRisk: number;
    accessFriction: number;
    identityReadiness: number;
  };
  nextAction: "create_line_qr" | "send_line_nudge" | "staff_call" | "vhv_followup" | "routine_followup";
  explanation: string;
};

const personaMultiplier: Record<Persona, number> = {
  "The Denier": 1.25,
  "The Fearful": 1.15,
  "The Forgetful": 1.1,
  "The Striver": 0.95,
  "The Engaged": 0.85,
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function daysSince(date?: string) {
  if (!date) return 999;
  const time = new Date(date).getTime();
  if (Number.isNaN(time)) return 999;
  return Math.max(0, Math.round((Date.now() - time) / 86_400_000));
}

function clinicalRisk(patient: Patient) {
  let risk = 0.1;
  if (patient.hbsag === "Positive") risk += 0.35;
  if (patient.hcvAb === "Positive") risk += 0.3;
  if (patient.hcvVL === "Detected") risk += 0.35;
  if (patient.hcvVL === "Pending" || patient.hcvVL === "Awaiting Result") risk += 0.18;
  if (patient.hcvVL.includes("รอ") || patient.hcvVL.includes("เจาะใหม่")) risk += 0.22;
  if (patient.care_status === "Pending" || hasCareGap(patient)) risk += 0.15;
  return clamp01(risk);
}

function adherenceRisk(patient: Patient) {
  const personaBase: Record<Persona, number> = {
    "The Denier": 0.85,
    "The Fearful": 0.7,
    "The Forgetful": 0.75,
    "The Striver": 0.35,
    "The Engaged": 0.2,
  };
  const staleNudge = daysSince(patient.last_nudge_date) > 14 ? 0.15 : 0;
  const repeatedNudge = Math.min((patient.nudge_count || 0) * 0.08, 0.2);
  return clamp01(personaBase[patient.persona] + staleNudge + repeatedNudge);
}

function accessFriction(patient: Patient) {
  const ruralSignal = patient.village || patient.subdistrict ? 0.25 : 0.45;
  const noRecentUpdate = daysSince(patient.updated_at || patient.created_at || patient.testDate) > 60 ? 0.2 : 0;
  return clamp01(ruralSignal + noRecentUpdate);
}

function identityReadiness(patient: Patient) {
  if (patient.status === "line_verified") return 1;
  if (patient.last_nudge_date || patient.nudge_count) return 0.65;
  if (patient.hn && patient.cid) return 0.35;
  return 0.1;
}

function compliancePenalty(patient: Patient) {
  let penalty = 0;
  if (!patient.hn) penalty += 0.12;
  if (!patient.cid) penalty += 0.1;
  if (!patient.testDate) penalty += 0.08;
  return penalty;
}

function bandFor(score: number): ScoreBand {
  if (score >= 80) return "critical";
  if (score >= 62) return "high";
  if (score >= 40) return "watch";
  return "low";
}

export function calculateHepaRaaia(patient: Patient): HepaRaaiaScore {
  const components = {
    clinicalRisk: clinicalRisk(patient),
    adherenceRisk: adherenceRisk(patient),
    accessFriction: accessFriction(patient),
    identityReadiness: identityReadiness(patient),
  };
  const multiplier = personaMultiplier[patient.persona] || 1;
  const penalty = compliancePenalty(patient);

  const raw =
    (0.4 * components.clinicalRisk +
      0.25 * components.adherenceRisk +
      0.2 * components.accessFriction +
      0.15 * (1 - components.identityReadiness)) *
      multiplier -
    penalty;
  const score = Math.round(clamp01(raw) * 100);
  const band = bandFor(score);

  let nextAction: HepaRaaiaScore["nextAction"] = "routine_followup";
  if (components.identityReadiness < 0.5) nextAction = "create_line_qr";
  else if (band === "critical") nextAction = "staff_call";
  else if (band === "high" && patient.persona === "The Forgetful") nextAction = "send_line_nudge";
  else if (band === "high") nextAction = "vhv_followup";
  else if (isPositive(patient) || hasCareGap(patient)) nextAction = "send_line_nudge";

  const explanation =
    nextAction === "create_line_qr"
      ? "ยังไม่มี LINE identity ที่มั่นใจพอ ให้สร้าง QR ผูก LINE ก่อน"
      : nextAction === "staff_call"
        ? "ความเสี่ยงสูง ควรให้เจ้าหน้าที่โทรหรือประสานทันที"
        : nextAction === "vhv_followup"
          ? "ควรส่งงานให้ อสม. ช่วยติดตามในพื้นที่"
          : nextAction === "send_line_nudge"
            ? "ส่ง LINE nudge ตาม persona ได้เลย"
            : "ติดตามตามรอบปกติ";

  return { score, band, personaMultiplier: multiplier, penalty, components, nextAction, explanation };
}
