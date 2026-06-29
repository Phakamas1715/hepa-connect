import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash, randomBytes } from "node:crypto";

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
  type: "create_invite" | "line_nudge" | "staff_escalation";
  status: "pending" | "agent_prepared" | "sent" | "verified" | "closed" | "blocked";
  persona?: string;
  message?: string;
  inviteId?: string;
  lineUserId?: string;
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
  audit: AuditEvent[];
};

const STORE_PATH = resolve(process.cwd(), "data", "hepa-agent-store.json");

function emptyStore(): AgentStore {
  return { invites: [], identities: [], tasks: [], audit: [] };
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
  if (!existsSync(STORE_PATH)) return emptyStore();
  return { ...emptyStore(), ...JSON.parse(readFileSync(STORE_PATH, "utf8")) };
}

export function writeAgentStore(store: AgentStore) {
  mkdirSync(dirname(STORE_PATH), { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
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
  role?: "patient" | "vhv" | "staff";
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
    role: input.role || "patient",
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

export function queueNudge(input: { hn: string; persona?: string; message?: string }) {
  const store = readAgentStore();
  const identity = store.identities.find((item) => item.hn === input.hn && item.status === "verified");
  const createdAt = nowIso();
  const task: AgentTask = {
    id: id("task"),
    hn: input.hn,
    type: "line_nudge",
    status: identity ? "pending" : "blocked",
    lineUserId: identity?.lineUserId,
    persona: input.persona,
    message: input.message || (identity ? "รอส่ง LINE nudge" : "ยังไม่มี LINE identity map สำหรับ HN นี้"),
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
