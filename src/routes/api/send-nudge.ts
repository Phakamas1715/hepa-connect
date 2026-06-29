import { createFileRoute } from "@tanstack/react-router";
import { serverEnv } from "@/lib/server-env";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

function isLineRecipientId(value: string) {
  return /^(U|C|R)[0-9a-fA-F]{20,}$/.test(value);
}

function buildNudgeText(persona: string, messageType: string) {
  return [
    "HEPA-GLUE Engine",
    `ประเภทข้อความ: ${messageType}`,
    `Persona: ${persona}`,
    "กรุณาติดตาม care gap ตามแผนงานไวรัสตับอักเสบ B/C",
  ].join("\n");
}

export const Route = createFileRoute("/api/send-nudge")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { recipientId, persona, messageType } = body;

          if (!recipientId || !persona || !messageType) {
            return Response.json(
              {
                status: "error",
                message: "ต้องระบุ recipientId, persona และ messageType",
              },
              { status: 400 },
            );
          }

          const token = serverEnv("LINE_CHANNEL_ACCESS_TOKEN");
          const pushEnabled = serverEnv("LINE_PUSH_ENABLED") === "true";
          const testRecipientId = serverEnv("LINE_TEST_RECIPIENT_ID");
          const resolvedRecipientId = testRecipientId || recipientId;
          const canPush = Boolean(token && pushEnabled && isLineRecipientId(resolvedRecipientId));

          if (!canPush) {
            return Response.json({
              status: "dry_run",
              message: token
                ? "LINE token พร้อมแล้ว แต่ยังไม่ส่งจริง เพราะยังไม่ได้เปิด LINE_PUSH_ENABLED=true หรือ recipientId ยังไม่ใช่ LINE user/group/room id"
                : "ยังไม่มี LINE_CHANNEL_ACCESS_TOKEN จึงจำลองการส่งข้อความ",
              recipientId,
              resolvedRecipientId: testRecipientId ? "LINE_TEST_RECIPIENT_ID" : recipientId,
              persona,
              messageType,
              pushEnabled,
              tokenConfigured: Boolean(token),
            });
          }

          const lineResponse = await fetch(LINE_PUSH_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: resolvedRecipientId,
              messages: [
                {
                  type: "text",
                  text: buildNudgeText(persona, messageType),
                },
              ],
            }),
          });

          const linePayload = await lineResponse.text();
          if (!lineResponse.ok) {
            return Response.json(
              {
                status: "error",
                message: "LINE Messaging API ส่งไม่สำเร็จ",
                lineStatus: lineResponse.status,
                lineResponse: linePayload,
              },
              { status: 502 },
            );
          }

          return Response.json({
            status: "sent",
            message: "ส่ง LINE nudge สำเร็จ",
            recipientId,
            resolvedRecipientId: testRecipientId ? "LINE_TEST_RECIPIENT_ID" : recipientId,
            persona,
            messageType,
          });
        } catch (error) {
          console.error("Error sending LINE nudge:", error);
          return Response.json({ status: "error", message: "ส่ง LINE nudge ไม่สำเร็จ" }, { status: 500 });
        }
      },
    },
  },
});
