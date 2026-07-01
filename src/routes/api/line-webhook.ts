import { createHmac, timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { audit, readAgentStore, writeAgentStore } from "@/lib/hepa-agent-store";
import { serverEnv } from "@/lib/server-env";

type LineWebhookEvent = {
  type: string;
  replyToken?: string;
  timestamp?: number;
  source?: {
    type?: string;
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  message?: {
    type?: string;
    text?: string;
  };
  follow?: {
    isUnblocked?: boolean;
  };
};

type LineReplyMessage = {
  type: "text";
  text: string;
};

function verifyLineSignature(body: string, signature: string | null) {
  const secret = serverEnv("LINE_CHANNEL_SECRET");
  if (!secret) return { ok: false, reason: "LINE_CHANNEL_SECRET is not configured" };
  if (!signature) return { ok: false, reason: "Missing x-line-signature" };

  const expected = createHmac("sha256", secret).update(body).digest("base64");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length)
    return { ok: false, reason: "Invalid signature" };
  return { ok: timingSafeEqual(expectedBuffer, actualBuffer), reason: "Invalid signature" };
}

function eventSummary(event: LineWebhookEvent) {
  const source =
    event.source?.userId || event.source?.groupId || event.source?.roomId || "unknown-source";
  const text = event.message?.text ? ` text="${event.message.text.slice(0, 80)}"` : "";
  return `${event.type} from ${source}${text}`;
}

function publicBaseUrl(request: Request) {
  const configured = serverEnv("PUBLIC_BASE_URL");
  if (configured) return configured.replace(/\/$/, "");

  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function liffUrl(liffId: string) {
  return `https://liff.line.me/${liffId}`;
}

function normalizedCommand(text?: string) {
  return (text || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function isDailyHepbcCommand(text?: string) {
  return ["report", "daily report", "hepbc", "รายงาน"].includes(normalizedCommand(text));
}

function triggerDailyHepbc(baseUrl: string) {
  fetch(`${baseUrl}/api/agent-orchestrator`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "run_daily_hepbc" }),
  }).catch((error) => {
    console.error("LINE daily Hep-BC trigger failed", error);
  });
}

function commandReply(text: string | undefined, baseUrl: string): LineReplyMessage[] {
  const command = normalizedCommand(text);
  const staffLiffId = serverEnv("VITE_STAFF_LIFF_ID");
  const patientLiffId = serverEnv("VITE_PATIENT_LIFF_ID") || serverEnv("VITE_LIFF_ID");
  const screeningLiffId = serverEnv("VITE_SCREENING_LIFF_ID");
  const staffLink = staffLiffId ? liffUrl(staffLiffId) : `${baseUrl}/line/staff`;
  const agentLink = `${baseUrl}/agent`;
  const patientLink = patientLiffId ? liffUrl(patientLiffId) : `${baseUrl}/line/link`;
  const screeningLink = screeningLiffId ? liffUrl(screeningLiffId) : `${baseUrl}/line/screening`;

  if (["report", "daily report", "hepbc", "รายงาน"].includes(command)) {
    return [
      {
        type: "text",
        text:
          `รับคำสั่งรายงาน Hep-B/C แล้ว ระบบกำลังดึงข้อมูล HOSxP และเตรียมรายงาน MOPH\n\n` +
          `สถานะใช้งาน:\n` +
          `• แดชบอร์ดติดตาม: ${agentLink}\n` +
          `• เจ้าหน้าที่: ${staffLink}\n\n` +
          `หมายเหตุ: การผูกผู้ป่วยต้องสร้าง QR เฉพาะรายจากหน้าติดตามหรือทะเบียนผู้ป่วยก่อน`,
      },
    ];
  }

  if (["staff", "เจ้าหน้าที่", "line staff"].includes(command)) {
    return [
      {
        type: "text",
        text:
          `ลิงก์ยืนยัน LINE เจ้าหน้าที่\n${staffLink}\n\n` +
          `บัญชีนี้จะถูกบันทึกเป็นเจ้าหน้าที่ และจะไม่ผูกกับ HN ผู้ป่วย`,
      },
    ];
  }

  if (["patient", "ผู้ป่วย", "link patient"].includes(command)) {
    return [
      {
        type: "text",
        text:
          `ลิงก์ยืนยัน LINE ผู้ป่วย: ${patientLink}\n\n` +
          `การผูกผู้ป่วยต้องใช้ QR เฉพาะรายจากหน้าติดตามหรือทะเบียนผู้ป่วย เพื่อป้องกันผูกผิด HN`,
      },
    ];
  }

  if (["screening", "คัดกรอง", "จอง", "จองคิว", "ตรวจฟรี", "ลงทะเบียน"].includes(command)) {
    return [
      {
        type: "text",
        text:
          `ลงทะเบียนจองสิทธิ์คัดกรองไวรัสตับอักเสบ B/C\n${screeningLink}\n\n` +
          `ประชาชนทำแบบประเมิน เลือกหน่วยบริการ และรับรหัสคัดกรอง/QR สำหรับแสดงที่ รพ.สต.`,
      },
    ];
  }

  if (["scan", "qr", "สแกน", "แสกน"].includes(command)) {
    return [
      {
        type: "text",
        text:
          `วิธีใช้งานสแกน QR\n\n` +
          `1) เจ้าหน้าที่เปิด ${staffLink} เพื่อยืนยันตัวตนเจ้าหน้าที่\n` +
          `2) ผู้ป่วยใช้ QR เฉพาะรายที่สร้างจาก ${agentLink}\n` +
          `3) ระบบส่ง LINE ติดตามเฉพาะบัญชีผู้ป่วยที่ยืนยันแล้วเท่านั้น`,
      },
    ];
  }

  if (["help", "เมนู", "ช่วยเหลือ", "เริ่มต้น"].includes(command)) {
    return [
      {
        type: "text",
        text:
          `เมนูน้ำพองรักตับ\n\n` +
          `พิมพ์:\n` +
          `• รายงาน หรือ hepbc = รันรายงานประจำวัน\n` +
          `• คัดกรอง หรือ จอง = ลงทะเบียนจองสิทธิ์ตรวจฟรี\n` +
          `• staff หรือ เจ้าหน้าที่ = ลิงก์ยืนยันเจ้าหน้าที่\n` +
          `• สแกน หรือ qr = วิธีสแกน/ผูก LINE\n\n` +
          `แดชบอร์ด: ${agentLink}`,
      },
    ];
  }

  return [];
}

async function replyLine(replyToken: string | undefined, messages: LineReplyMessage[]) {
  const token = serverEnv("LINE_CHANNEL_ACCESS_TOKEN");
  if (!replyToken || !token || !messages.length) return { skipped: true };

  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ replyToken, messages }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return { skipped: false, ok: false, status: response.status, detail: detail.slice(0, 200) };
  }

  return { skipped: false, ok: true, status: response.status };
}

export const Route = createFileRoute("/api/line-webhook")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({
          ok: true,
          endpoint: "/api/line-webhook",
          mode: "LINE Messaging API webhook",
          checkedAt: new Date().toISOString(),
        }),
      POST: async ({ request }) => {
        const body = await request.text();
        const verification = verifyLineSignature(body, request.headers.get("x-line-signature"));
        if (!verification.ok) {
          return Response.json({ ok: false, error: verification.reason }, { status: 401 });
        }

        const payload = JSON.parse(body || "{}") as {
          events?: LineWebhookEvent[];
          destination?: string;
        };
        const events = Array.isArray(payload.events) ? payload.events : [];
        const store = readAgentStore();
        const baseUrl = publicBaseUrl(request);
        let replies = 0;

        for (const event of events) {
          audit(store, {
            actor: "system",
            action: "line_webhook_received",
            detail: eventSummary(event),
          });

          if (event.type === "message" && event.message?.type === "text") {
            const messages = commandReply(event.message.text, baseUrl);
            if (isDailyHepbcCommand(event.message.text)) {
              triggerDailyHepbc(baseUrl);
              audit(store, {
                actor: "system",
                action: "line_daily_hepbc_triggered",
                detail: eventSummary(event),
              });
            }
            const reply = await replyLine(event.replyToken, messages);
            if (!reply.skipped) {
              replies += 1;
              audit(store, {
                actor: "system",
                action: reply.ok ? "line_command_replied" : "line_command_reply_failed",
                detail: `${eventSummary(event)} replyStatus=${reply.status || "skipped"}`,
              });
            }
          }
        }

        writeAgentStore(store);
        return Response.json({
          ok: true,
          received: events.length,
          replies,
          checkedAt: new Date().toISOString(),
        });
      },
    },
  },
});
