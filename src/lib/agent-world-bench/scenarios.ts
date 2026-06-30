import type { HepaBenchScenario } from "@/lib/agent-world-bench/types";

const SYSTEM_MCP =
  "คุณเป็นโมเดลจำลองสภาพแวดล้อม MCP/API ของ HEPA-Connect — ทำนายผลลัพธ์ JSON หลัง agent เรียก endpoint จริง";

const SYSTEM_WEB =
  "คุณเป็นโมเดลจำลองสภาพแวดล้อมเว็บของ HEPA-Connect — ทำนายสถานะ automation/UI state หลังผู้ใช้ตรวจสอบระบบ";

export const HEPA_AGENT_WORLD_SCENARIOS: HepaBenchScenario[] = [
  {
    task: "mcp",
    id: "health-ready",
    title: "ตรวจสุขภาพบริการ",
    instruction: "เรียก /health แล้วคาดหวังว่าบริการ hepa-connect ตอบ ok=true",
    systemStr: SYSTEM_MCP,
    action: { method: "GET", path: "/health", expectedStatus: 200 },
    assertions: [
      { path: "ok", equals: true },
      { path: "service", equals: "hepa-connect" },
      { path: "checkedAt", type: "string" },
    ],
  },
  {
    task: "mcp",
    id: "agent-store-shape",
    title: "โครงสร้างคลัง agent",
    instruction: "อ่าน /api/agent-orchestrator แล้วต้องมี invites, identities, tasks, audit",
    systemStr: SYSTEM_MCP,
    action: { method: "GET", path: "/api/agent-orchestrator", expectedStatus: 200 },
    assertions: [
      { path: "invites", type: "array" },
      { path: "identities", type: "array" },
      { path: "tasks", type: "array" },
      { path: "audit", type: "array" },
    ],
  },
  {
    task: "web",
    id: "production-automation",
    title: "สถานะ automation หลัก",
    instruction: "ตรวจ /api/production-automation แล้วต้องมี readiness และ gates",
    systemStr: SYSTEM_WEB,
    action: { method: "GET", path: "/api/production-automation", expectedStatus: 200 },
    assertions: [
      { path: "readiness", type: "number" },
      { path: "canRunProduction", type: "boolean" },
      { path: "gates", type: "array" },
      { path: "nextAction", type: "string" },
    ],
  },
  {
    task: "mcp",
    id: "connection-status",
    title: "สถานะการเชื่อมต่อ",
    instruction: "ตรวจ /api/connection-status แล้วต้องมี checks เป็นรายการ",
    systemStr: SYSTEM_MCP,
    action: { method: "GET", path: "/api/connection-status", expectedStatus: 200 },
    assertions: [
      { path: "checkedAt", type: "string" },
      { path: "checks", type: "array" },
    ],
  },
  {
    task: "mcp",
    id: "hosxp-sync-status",
    title: "แคช HOSxP sync",
    instruction: "ตรวจ /api/hosxp-sync แล้วต้องบอกสถานะแคช push จากโรงพยาบาล",
    systemStr: SYSTEM_MCP,
    action: { method: "GET", path: "/api/hosxp-sync", expectedStatus: 200 },
    assertions: [
      { path: "ok", equals: true },
      { path: "fresh", type: "boolean" },
      { path: "count", type: "number" },
    ],
  },
  {
    task: "mcp",
    id: "agent-unknown-action",
    title: "จัดการ action ที่ไม่รู้จัก",
    instruction: "ส่ง action ผิดไปที่ orchestrator แล้วต้องได้ข้อความภาษาไทย",
    systemStr: SYSTEM_MCP,
    action: {
      method: "POST",
      path: "/api/agent-orchestrator",
      body: { action: "__bench_unknown__" },
      expectedStatus: 400,
    },
    assertions: [
      { path: "status", equals: "error" },
      { path: "message", type: "string" },
    ],
  },
  {
    task: "web",
    id: "ops-monitoring",
    title: "หน้าต่าง ops monitoring",
    instruction: "ตรวจ /api/ops-monitoring แล้วต้องมี service และ timers",
    systemStr: SYSTEM_WEB,
    action: { method: "GET", path: "/api/ops-monitoring", expectedStatus: 200 },
    assertions: [
      { path: "ok", equals: true },
      { path: "service", equals: "hepa-connect-ops" },
      { path: "storeSummary", type: "object" },
      { path: "time", type: "string" },
    ],
  },
  {
    task: "terminal",
    id: "production-deep-probe",
    title: "probe ลึก automation",
    instruction: "เรียก production-automation?probe=deep แล้วต้องมี checkedAt",
    systemStr: SYSTEM_MCP,
    action: {
      method: "GET",
      path: "/api/production-automation?probe=deep",
      expectedStatus: 200,
    },
    assertions: [
      { path: "checkedAt", type: "string" },
      { path: "mode", oneOf: ["production", "production-no-it", "guarded"] },
    ],
  },
];