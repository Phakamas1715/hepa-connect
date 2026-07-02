import { queueNudge, readAgentStore } from "@/lib/hepa-agent-store";
import {
  PERSONA_NUDGES,
  getHcvTreatmentGapPatients,
  type Patient,
  type Persona,
} from "@/lib/hepa-data";
import { listPatients } from "@/lib/patient-registry";
import { serverEnv } from "@/lib/server-env";

export { getHcvTreatmentGapPatients, isHcvPositive, needsSofvelTreatment } from "@/lib/hepa-data";

function sofvelNudgeMessage(patient: Patient) {
  const persona = (patient.persona || "The Engaged") as Persona;
  const template =
    PERSONA_NUDGES[persona]?.sms ||
    "เรียนคุณ {name} ผลคัดกรอง HCV ของท่านควรเข้าสู่การรักษาด้วย Sofvel กรุณาติดต่อโรงพยาบาลน้ำพอง";
  const date = new Date(Date.now() + 7 * 86400000).toLocaleDateString("th-TH");
  return template.replace("{name}", patient.name).replace("{date}", date);
}

export function openHcvTreatmentGapQueue() {
  const registry = listPatients();
  const patients = getHcvTreatmentGapPatients(registry.patients);
  const results: Array<{
    hn: string;
    name: string;
    status: "queued" | "blocked";
    message: string;
    taskId: string;
  }> = [];

  for (const patient of patients) {
    const { task } = queueNudge({
      hn: patient.hn,
      persona: patient.persona,
      message: sofvelNudgeMessage(patient),
    });
    results.push({
      hn: patient.hn,
      name: patient.name,
      status: task.status === "blocked" ? "blocked" : "queued",
      message: task.message || "",
      taskId: task.id,
    });
  }

  const queued = results.filter((item) => item.status === "queued").length;
  const blocked = results.filter((item) => item.status === "blocked").length;

  return {
    total: patients.length,
    queued,
    blocked,
    source: registry.meta.source,
    patients: results,
    openedAt: new Date().toISOString(),
  };
}

export function getCareGapModuleStatus() {
  const store = readAgentStore();
  const registry = listPatients();
  const gapPatients = getHcvTreatmentGapPatients(registry.patients);
  const lineToken = !!serverEnv("LINE_CHANNEL_ACCESS_TOKEN");
  const linePush = serverEnv("LINE_PUSH_ENABLED") === "true";

  const modules = [
    {
      id: "registry",
      name: "ทะเบียนรายชื่อกลาง",
      state: gapPatients.length > 0 ? ("partial" as const) : ("ready" as const),
      detail: `พบผู้ป่วย HCV รอ Sofvel ${gapPatients.length} ราย`,
    },
    {
      id: "agent_queue",
      name: "คิว Agent / LINE",
      state: lineToken
        ? linePush
          ? ("ready" as const)
          : ("partial" as const)
        : ("blocked" as const),
      detail: lineToken
        ? linePush
          ? "LINE token พร้อมและเปิดส่งแล้ว"
          : "มี token แต่ยังไม่เปิด LINE_PUSH_ENABLED"
        : "ยังไม่มี LINE_CHANNEL_ACCESS_TOKEN",
    },
    {
      id: "line_identity",
      name: "การผูกบัญชี LINE",
      state:
        store.identities.filter((item) => item.role === "patient" && item.status === "verified")
          .length > 0
          ? ("partial" as const)
          : ("blocked" as const),
      detail: `ผูก LINE แล้ว ${store.identities.filter((item) => item.role === "patient").length} บัญชี`,
    },
    {
      id: "pending_tasks",
      name: "งานคิวติดตาม",
      state:
        store.tasks.filter((item) => item.status === "pending").length > 0
          ? ("ready" as const)
          : ("partial" as const),
      detail: `ค้างส่ง ${store.tasks.filter((item) => item.status === "pending").length} · ติดเงื่อนไข ${store.tasks.filter((item) => item.status === "blocked").length}`,
    },
  ];

  return {
    checkedAt: new Date().toISOString(),
    registrySource: registry.meta.source,
    registryCount: registry.patients.length,
    hcvTreatmentGap: gapPatients.length,
    patients: gapPatients.map((patient) => ({
      hn: patient.hn,
      name: patient.name,
      persona: patient.persona,
      care_status: patient.care_status,
    })),
    modules,
  };
}
