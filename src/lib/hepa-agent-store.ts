import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { serverEnv } from "@/lib/server-env";

export type AgentInvite = {
  id: string;
  tokenHash: string;
  hn: string;
  purpose: "hepatitis_followup";
  patientName?: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
  status: "active" | "used" | "expired";
};

export type LineIdentity = {
  lineUserId: string;
  role: "patient" | "vhv" | "staff";
  hn?: string;
  displayName?: string;
  verifiedAt: string;
  consentAt: string;
  status: "verified" | "revoked";
};

export type AgentTask = {
  id: string;
  hn: string;
  type: "create_invite" | "line_nudge" | "staff_escalation" | "appointment";
  status:
    | "pending"
    | "agent_prepared"
    | "scheduled"
    | "sent"
    | "verified"
    | "contacted"
    | "confirmed"
    | "completed"
    | "cancelled"
    | "closed"
    | "blocked";
  persona?: string;
  message?: string;
  inviteId?: string;
  appointmentId?: string;
  lineUserId?: string;
  createdAt: string;
  updatedAt: string;
};

export type AgentAppointmentStatus = "scheduled" | "confirmed" | "completed" | "cancelled";

export type AppointmentNotificationStatus = "pending" | "not_linked" | "sent" | "failed";

export type AgentAppointment = {
  id: string;
  appointmentCode: string;
  hn: string;
  patientName: string;
  facilityCode: string;
  facilityName: string;
  appointmentDate: string;
  appointmentTime?: string;
  note?: string;
  status: AgentAppointmentStatus;
  notificationStatus: AppointmentNotificationStatus;
  notificationSentAt?: string;
  lineUserId?: string;
  taskId: string;
  createdAt: string;
  updatedAt: string;
};

export type AuditEvent = {
  id: string;
  at: string;
  actor: "agent" | "staff" | "system";
  action: string;
  hn?: string;
  detail: string;
};

export type AgentStore = {
  invites: AgentInvite[];
  identities: LineIdentity[];
  tasks: AgentTask[];
  appointments: AgentAppointment[];
  audit: AuditEvent[];
};

function storePath() {
  return (
    serverEnv("HEPA_AGENT_STORE_PATH") || resolve(process.cwd(), "data", "hepa-agent-store.json")
  );
}

function emptyStore(): AgentStore {
  return { invites: [], identities: [], tasks: [], appointments: [], audit: [] };
}

function nowIso() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function readAgentStore(): AgentStore {
  const STORE_PATH = storePath();
  if (!existsSync(STORE_PATH)) return emptyStore();
  return { ...emptyStore(), ...JSON.parse(readFileSync(STORE_PATH, "utf8")) };
}

export function writeAgentStore(store: AgentStore) {
  const STORE_PATH = storePath();
  mkdirSync(dirname(STORE_PATH), { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export function getAgentStorePath() {
  return storePath();
}

export function audit(store: AgentStore, event: Omit<AuditEvent, "id" | "at">) {
  store.audit.unshift({ id: id("audit"), at: nowIso(), ...event });
  store.audit = store.audit.slice(0, 200);
}

export function createInvite(input: { hn: string; patientName?: string; baseUrl: string }) {
  const store = readAgentStore();
  const token = randomBytes(24).toString("base64url");
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const invite: AgentInvite = {
    id: id("inv"),
    tokenHash: hashToken(token),
    hn: input.hn,
    patientName: input.patientName,
    purpose: "hepatitis_followup",
    createdAt,
    expiresAt,
    status: "active",
  };
  const task: AgentTask = {
    id: id("task"),
    hn: input.hn,
    type: "create_invite",
    status: "agent_prepared",
    inviteId: invite.id,
    message: "สร้างลิงก์ผูก LINE สำหรับติดตาม care gap",
    createdAt,
    updatedAt: createdAt,
  };

  store.invites.unshift(invite);
  store.tasks.unshift(task);
  audit(store, {
    actor: "agent",
    action: "create_line_invite",
    hn: input.hn,
    detail: `สร้าง invite ${invite.id} หมดอายุ ${expiresAt}`,
  });
  writeAgentStore(store);

  return {
    invite,
    task,
    token,
    link: `${input.baseUrl.replace(/\/$/, "")}/line/link?token=${encodeURIComponent(token)}`,
  };
}

export function inspectInvite(token: string) {
  const store = readAgentStore();
  const tokenHash = hashToken(token);
  const invite = store.invites.find((item) => item.tokenHash === tokenHash);
  if (!invite) throw new Error("ไม่พบ invite token");
  if (new Date(invite.expiresAt).getTime() < Date.now()) {
    invite.status = "expired";
    writeAgentStore(store);
    throw new Error("invite หมดอายุแล้ว");
  }
  return {
    id: invite.id,
    hn: invite.hn,
    patientName: invite.patientName,
    status: invite.status,
    expiresAt: invite.expiresAt,
    usedAt: invite.usedAt,
  };
}

export function verifyInvite(input: {
  token: string;
  hn: string;
  lineUserId: string;
  displayName?: string;
}) {
  const store = readAgentStore();
  const tokenHash = hashToken(input.token);
  const invite = store.invites.find((item) => item.tokenHash === tokenHash);
  if (!invite) throw new Error("ไม่พบ invite token");
  if (invite.hn !== input.hn) throw new Error("HN ไม่ตรงกับ invite");
  if (new Date(invite.expiresAt).getTime() < Date.now()) {
    invite.status = "expired";
    throw new Error("invite หมดอายุแล้ว");
  }

  const verifiedAt = nowIso();
  invite.status = "used";
  invite.usedAt = verifiedAt;

  store.identities = store.identities.filter(
    (item) => item.lineUserId !== input.lineUserId && item.hn !== input.hn,
  );
  store.identities.unshift({
    lineUserId: input.lineUserId,
    hn: input.hn,
    role: "patient",
    displayName: input.displayName,
    verifiedAt,
    consentAt: verifiedAt,
    status: "verified",
  });

  store.tasks.unshift({
    id: id("task"),
    hn: input.hn,
    type: "line_nudge",
    status: "verified",
    inviteId: invite.id,
    lineUserId: input.lineUserId,
    message: "ผูก LINE userId กับ HN สำเร็จ พร้อมส่งข้อความติดตาม",
    createdAt: verifiedAt,
    updatedAt: verifiedAt,
  });
  audit(store, {
    actor: "system",
    action: "verify_line_identity",
    hn: input.hn,
    detail: `ผูก LINE ${input.lineUserId.slice(0, 8)}... กับ HN สำเร็จ`,
  });
  writeAgentStore(store);
  return { invite, identity: store.identities[0] };
}

export function verifyStaffIdentity(input: { lineUserId: string; displayName?: string }) {
  const store = readAgentStore();
  const verifiedAt = nowIso();

  store.identities = store.identities.filter((item) => item.lineUserId !== input.lineUserId);
  store.identities.unshift({
    lineUserId: input.lineUserId,
    role: "staff",
    displayName: input.displayName,
    verifiedAt,
    consentAt: verifiedAt,
    status: "verified",
  });

  audit(store, {
    actor: "system",
    action: "verify_staff_identity",
    detail: `ผูก LINE เจ้าหน้าที่ ${input.lineUserId.slice(0, 8)}... สำเร็จ`,
  });
  writeAgentStore(store);
  return { identity: store.identities[0] };
}

export function verifyPositivePatientIdentity(input: {
  lineUserId: string;
  caseCode: string;
  displayName?: string;
  consentAt: string;
}) {
  const store = readAgentStore();
  const lineUserId = input.lineUserId.trim();
  const caseCode = input.caseCode.trim();
  if (!lineUserId || !caseCode) {
    throw new Error("ต้องระบุ LINE userId และรหัสเคส");
  }
  if (!/^U[0-9a-fA-F]{20,}$/.test(lineUserId)) {
    throw new Error("LINE userId ไม่ถูกต้อง");
  }

  const existingByLine = store.identities.find((item) => item.lineUserId === lineUserId);
  if (existingByLine && existingByLine.role !== "patient") {
    audit(store, {
      actor: "system",
      action: "positive_patient_identity_blocked",
      hn: caseCode,
      detail: `ไม่เปลี่ยน identity role=${existingByLine.role} เป็น patient`,
    });
    writeAgentStore(store);
    return {
      status: "blocked" as const,
      reason: `บัญชี LINE นี้เป็น ${existingByLine.role} จึงไม่สามารถใช้เป็นผู้ป่วย`,
      identity: existingByLine,
      appointmentsLinked: 0,
    };
  }

  if (existingByLine?.role === "patient" && existingByLine.hn && existingByLine.hn !== caseCode) {
    audit(store, {
      actor: "system",
      action: "positive_patient_identity_blocked",
      hn: caseCode,
      detail: `LINE patient ถูกผูกกับ ${existingByLine.hn} แล้ว`,
    });
    writeAgentStore(store);
    return {
      status: "blocked" as const,
      reason: "บัญชี LINE ผู้ป่วยนี้ถูกผูกกับเคสอื่นแล้ว กรุณาให้เจ้าหน้าที่ตรวจสอบ",
      identity: existingByLine,
      appointmentsLinked: 0,
    };
  }

  const verifiedAt = nowIso();
  const existingByCase = store.identities.find(
    (item) => item.hn === caseCode && item.role === "patient",
  );
  if (existingByCase && existingByCase.lineUserId !== lineUserId) {
    existingByCase.status = "revoked";
  }

  const identity: LineIdentity =
    existingByLine?.role === "patient"
      ? existingByLine
      : {
          lineUserId,
          role: "patient",
          hn: caseCode,
          displayName: input.displayName,
          verifiedAt,
          consentAt: input.consentAt,
          status: "verified",
        };
  identity.hn = caseCode;
  identity.displayName = input.displayName || identity.displayName;
  identity.verifiedAt = verifiedAt;
  identity.consentAt = input.consentAt;
  identity.status = "verified";

  store.identities = [
    identity,
    ...store.identities.filter((item) => item.lineUserId !== lineUserId),
  ];

  let appointmentsLinked = 0;
  for (const appointment of store.appointments) {
    if (
      appointment.hn === caseCode &&
      appointment.status !== "completed" &&
      appointment.status !== "cancelled"
    ) {
      appointment.lineUserId = lineUserId;
      if (appointment.notificationStatus === "not_linked") {
        appointment.notificationStatus = "pending";
      }
      appointment.updatedAt = verifiedAt;
      const task = store.tasks.find((item) => item.id === appointment.taskId);
      if (task) {
        task.lineUserId = lineUserId;
        task.updatedAt = verifiedAt;
      }
      appointmentsLinked += 1;
    }
  }

  for (const task of store.tasks) {
    if (task.hn === caseCode && task.type === "staff_escalation") {
      task.lineUserId = lineUserId;
      task.updatedAt = verifiedAt;
    }
  }

  audit(store, {
    actor: "system",
    action: "positive_patient_identity_verified",
    hn: caseCode,
    detail: `สร้าง patient identity จาก Positive LIFF · appointments=${appointmentsLinked}`,
  });
  writeAgentStore(store);
  return {
    status: "verified" as const,
    identity,
    appointmentsLinked,
  };
}

export function queueNudge(input: { hn: string; persona?: string; message?: string }) {
  const store = readAgentStore();
  const identity = store.identities.find(
    (item) => item.hn === input.hn && item.role === "patient" && item.status === "verified",
  );
  const createdAt = nowIso();
  const task: AgentTask = {
    id: id("task"),
    hn: input.hn,
    type: "line_nudge",
    status: identity ? "pending" : "blocked",
    lineUserId: identity?.lineUserId,
    persona: input.persona,
    message:
      input.message || (identity ? "รอส่ง LINE nudge" : "ยังไม่มี LINE identity map สำหรับ HN นี้"),
    createdAt,
    updatedAt: createdAt,
  };
  store.tasks.unshift(task);
  audit(store, {
    actor: "agent",
    action: "queue_line_nudge",
    hn: input.hn,
    detail: task.message || "queue nudge",
  });
  writeAgentStore(store);
  return { task, identity };
}

function appointmentCode() {
  return `APT-NP-${Math.floor(100000 + Math.random() * 900000)}`;
}

function cleanText(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function assertAppointmentDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T00:00:00`).getTime())) {
    throw new Error("กรุณาระบุวันนัดให้ถูกต้อง");
  }
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  if (value < today) throw new Error("วันนัดต้องเป็นวันนี้หรือวันถัดไป");
}

export function createAppointment(input: {
  hn: string;
  patientName: string;
  facilityCode: string;
  facilityName: string;
  appointmentDate: string;
  appointmentTime?: string;
  note?: string;
}) {
  const store = readAgentStore();
  const hn = cleanText(input.hn);
  const patientName = cleanText(input.patientName);
  const facilityCode = cleanText(input.facilityCode);
  const facilityName = cleanText(input.facilityName);
  const appointmentDate = cleanText(input.appointmentDate);
  const appointmentTime = cleanText(input.appointmentTime);
  const note = cleanText(input.note);

  if (!hn) throw new Error("กรุณาระบุ HN หรือรหัสเคส");
  if (!patientName) throw new Error("กรุณาระบุชื่อผู้รับบริการ");
  if (!facilityCode || !facilityName) throw new Error("กรุณาเลือกสถานที่นัด");
  assertAppointmentDate(appointmentDate);
  if (appointmentTime && !/^\d{2}:\d{2}$/.test(appointmentTime)) {
    throw new Error("กรุณาระบุเวลานัดให้ถูกต้อง");
  }

  const duplicate = store.appointments.find(
    (item) =>
      item.hn === hn &&
      item.appointmentDate === appointmentDate &&
      item.facilityCode === facilityCode &&
      item.status !== "cancelled",
  );
  if (duplicate) throw new Error(`มีนัดรายการนี้แล้ว (${duplicate.appointmentCode})`);

  const createdAt = nowIso();
  const identity = store.identities.find(
    (item) => item.hn === hn && item.role === "patient" && item.status === "verified",
  );
  const appointmentId = id("apt");
  const task: AgentTask = {
    id: id("task"),
    hn,
    type: "appointment",
    status: "scheduled",
    appointmentId,
    lineUserId: identity?.lineUserId,
    message: `นัด ${appointmentDate}${appointmentTime ? ` ${appointmentTime} น.` : ""} ที่ ${facilityName}`,
    createdAt,
    updatedAt: createdAt,
  };
  const appointment: AgentAppointment = {
    id: appointmentId,
    appointmentCode: appointmentCode(),
    hn,
    patientName,
    facilityCode,
    facilityName,
    appointmentDate,
    appointmentTime: appointmentTime || undefined,
    note: note || undefined,
    status: "scheduled",
    notificationStatus: identity ? "pending" : "not_linked",
    lineUserId: identity?.lineUserId,
    taskId: task.id,
    createdAt,
    updatedAt: createdAt,
  };

  store.appointments.unshift(appointment);
  store.tasks.unshift(task);
  audit(store, {
    actor: "staff",
    action: "appointment_created",
    hn,
    detail: `${appointment.appointmentCode} · ${task.message}`,
  });
  writeAgentStore(store);
  return { appointment, task, identity };
}

export function updateAppointmentStatus(idOrCode: string, status: AgentAppointmentStatus) {
  const store = readAgentStore();
  const appointment = store.appointments.find(
    (item) => item.id === idOrCode || item.appointmentCode === idOrCode,
  );
  if (!appointment) throw new Error("ไม่พบนัดหมาย");

  appointment.status = status;
  appointment.updatedAt = nowIso();
  const task = store.tasks.find((item) => item.id === appointment.taskId);
  if (task) {
    task.status =
      status === "completed" ? "completed" : status === "cancelled" ? "cancelled" : status;
    task.updatedAt = appointment.updatedAt;
  }
  audit(store, {
    actor: "staff",
    action: "appointment_status_updated",
    hn: appointment.hn,
    detail: `${appointment.appointmentCode} · ${status}`,
  });
  writeAgentStore(store);
  return { appointment, task };
}

export function updateAppointmentNotification(
  idOrCode: string,
  input: {
    status: AppointmentNotificationStatus;
    lineUserId?: string;
    detail?: string;
  },
) {
  const store = readAgentStore();
  const appointment = store.appointments.find(
    (item) => item.id === idOrCode || item.appointmentCode === idOrCode,
  );
  if (!appointment) throw new Error("ไม่พบนัดหมาย");

  appointment.notificationStatus = input.status;
  appointment.lineUserId = input.lineUserId || appointment.lineUserId;
  appointment.notificationSentAt =
    input.status === "sent" ? nowIso() : appointment.notificationSentAt;
  appointment.updatedAt = nowIso();
  const task = store.tasks.find((item) => item.id === appointment.taskId);
  if (task) {
    task.status =
      input.status === "sent" ? "sent" : input.status === "failed" ? "blocked" : task.status;
    task.lineUserId = appointment.lineUserId;
    task.updatedAt = appointment.updatedAt;
  }
  audit(store, {
    actor: "agent",
    action: "appointment_notification_updated",
    hn: appointment.hn,
    detail: `${appointment.appointmentCode} · ${input.status}${input.detail ? ` · ${input.detail}` : ""}`,
  });
  writeAgentStore(store);
  return { appointment, task };
}

export function getAppointment(idOrCode: string) {
  const store = readAgentStore();
  const appointment = store.appointments.find(
    (item) => item.id === idOrCode || item.appointmentCode === idOrCode,
  );
  if (!appointment) throw new Error("ไม่พบนัดหมาย");
  return appointment;
}

export function respondToAppointmentFromLine(input: {
  appointmentCode: string;
  lineUserId: string;
  response: "confirm" | "reschedule";
}) {
  const store = readAgentStore();
  const appointment = store.appointments.find(
    (item) => item.appointmentCode === input.appointmentCode,
  );
  if (!appointment) throw new Error("ไม่พบนัดหมาย");
  if (!appointment.lineUserId || appointment.lineUserId !== input.lineUserId) {
    throw new Error("บัญชี LINE ไม่ตรงกับผู้รับนัด");
  }

  appointment.status = input.response === "confirm" ? "confirmed" : "scheduled";
  appointment.updatedAt = nowIso();
  const task = store.tasks.find((item) => item.id === appointment.taskId);
  if (task) {
    task.status = input.response === "confirm" ? "confirmed" : "contacted";
    task.message =
      input.response === "confirm"
        ? `ผู้รับบริการยืนยันนัด ${appointment.appointmentCode}`
        : `ผู้รับบริการขอเลื่อนนัด ${appointment.appointmentCode}`;
    task.updatedAt = appointment.updatedAt;
  }
  audit(store, {
    actor: "system",
    action:
      input.response === "confirm"
        ? "appointment_confirmed_by_patient"
        : "appointment_reschedule_requested",
    hn: appointment.hn,
    detail: appointment.appointmentCode,
  });
  writeAgentStore(store);
  return { appointment, task };
}

export function reconcileAgentStoreWithSources(input: {
  livePatientHns: string[];
  positiveRecords: Array<{
    caseCode: string;
    agentTaskId?: string;
    status: "new" | "agent_queued" | "contacted" | "closed";
  }>;
}) {
  const store = readAgentStore();
  const liveHns = new Set(input.livePatientHns);
  const positiveCodes = new Set(input.positiveRecords.map((item) => item.caseCode));
  const positiveByTask = new Map(
    input.positiveRecords
      .filter((item) => item.agentTaskId)
      .map((item) => [item.agentTaskId as string, item]),
  );
  let positiveTasksUpdated = 0;
  let orphanTasksClosed = 0;
  let invitesExpired = 0;
  let identitiesRevoked = 0;

  for (const task of store.tasks) {
    const positive = positiveByTask.get(task.id);
    if (positive) {
      const nextStatus =
        positive.status === "closed"
          ? "closed"
          : positive.status === "contacted"
            ? "contacted"
            : "pending";
      if (task.status !== nextStatus) {
        task.status = nextStatus;
        task.updatedAt = nowIso();
        positiveTasksUpdated += 1;
      }
      continue;
    }

    const patientTask = task.type === "line_nudge" || task.type === "create_invite";
    const activeTask = !["closed", "cancelled", "completed"].includes(task.status);
    if (patientTask && activeTask && !liveHns.has(task.hn) && !positiveCodes.has(task.hn)) {
      task.status = "closed";
      task.updatedAt = nowIso();
      task.message = `${task.message || "งานเดิม"} · ปิดโดยการตรวจทะเบียน: ไม่พบในทะเบียน live`;
      orphanTasksClosed += 1;
    }
  }

  for (const invite of store.invites) {
    if (invite.status === "active" && !liveHns.has(invite.hn) && !positiveCodes.has(invite.hn)) {
      invite.status = "expired";
      invitesExpired += 1;
    }
  }

  for (const identity of store.identities) {
    if (
      identity.role === "patient" &&
      identity.status === "verified" &&
      identity.hn &&
      !liveHns.has(identity.hn) &&
      !positiveCodes.has(identity.hn)
    ) {
      identity.status = "revoked";
      identitiesRevoked += 1;
    }
  }

  const changed = positiveTasksUpdated + orphanTasksClosed + invitesExpired + identitiesRevoked > 0;
  if (changed) {
    audit(store, {
      actor: "system",
      action: "agent_store_reconciled",
      detail:
        `positiveTasks=${positiveTasksUpdated} orphanTasks=${orphanTasksClosed} ` +
        `invites=${invitesExpired} identities=${identitiesRevoked}`,
    });
    writeAgentStore(store);
  }

  return {
    changed,
    positiveTasksUpdated,
    orphanTasksClosed,
    invitesExpired,
    identitiesRevoked,
  };
}
