import { createFileRoute } from "@tanstack/react-router";
import { readAgentStore } from "@/lib/hepa-agent-store";
import { serverEnv } from "@/lib/server-env";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

function isLineRecipientId(value: string) {
  return /^(U|C|R)[0-9a-fA-F]{20,}$/.test(value);
}

function resolveLineRecipientId(recipientId: string) {
  if (isLineRecipientId(recipientId)) {
    return { id: recipientId, source: "direct_line_id" };
  }

  const store = readAgentStore();
  const identity = store.identities.find((item) => item.hn === recipientId && isLineRecipientId(item.lineUserId));
  if (identity) return { id: identity.lineUserId, source: "patient_identity" };

  const appointment = store.appointments.find(
    (item) => item.hn === recipientId && item.lineUserId && isLineRecipientId(item.lineUserId),
  );
  if (appointment?.lineUserId) return { id: appointment.lineUserId, source: "appointment_identity" };

  return { id: recipientId, source: "unresolved" };
}

function buildFlexMessage(persona: string, messageType: string) {
  return {
    type: "flex",
    altText: "น้ำพองรักตับ: แจ้งเตือนติดตามสุขภาพ",
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#087F73",
        paddingAll: "20px",
        contents: [
          {
            type: "text",
            text: "น้ำพองรักตับ",
            color: "#FFFFFF",
            weight: "bold",
            size: "xl",
          },
          {
            type: "text",
            text: "ดูแลตับให้แข็งแรง ไปด้วยกัน",
            color: "#CFF7F1",
            size: "sm",
            margin: "sm",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "20px",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            backgroundColor: "#E9F8F5",
            cornerRadius: "8px",
            paddingAll: "12px",
            contents: [
              {
                type: "text",
                text: "นัดติดตามสุขภาพ",
                color: "#08665E",
                weight: "bold",
                size: "sm",
                flex: 1,
              },
              {
                type: "text",
                text: "รอยืนยัน",
                color: "#D85C41",
                weight: "bold",
                size: "sm",
                align: "end",
              },
            ],
          },
          {
            type: "text",
            text: "มีรายการดูแลสุขภาพที่ควรติดตาม",
            color: "#172B2A",
            weight: "bold",
            size: "lg",
            margin: "xl",
            wrap: true,
          },
          {
            type: "text",
            text: "กรุณาติดต่อหน่วยบริการใกล้บ้านเพื่อยืนยันวันและเวลาที่สะดวก เจ้าหน้าที่พร้อมดูแลและให้คำแนะนำ",
            color: "#506765",
            size: "sm",
            margin: "md",
            wrap: true,
            lineSpacing: "4px",
          },
          {
            type: "separator",
            margin: "xl",
            color: "#DDE9E7",
          },
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            spacing: "sm",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "งานติดตาม", color: "#78908D", size: "xs", flex: 2 },
                  {
                    type: "text",
                    text: messageType,
                    color: "#26423F",
                    size: "xs",
                    align: "end",
                    flex: 3,
                  },
                ],
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "รูปแบบดูแล", color: "#78908D", size: "xs", flex: 2 },
                  {
                    type: "text",
                    text: persona,
                    color: "#26423F",
                    size: "xs",
                    align: "end",
                    flex: 3,
                  },
                ],
              },
            ],
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#087F73",
            height: "sm",
            action: {
              type: "message",
              label: "ยืนยันรับทราบ",
              text: "รับทราบการแจ้งเตือนแล้ว",
            },
          },
          {
            type: "button",
            style: "secondary",
            height: "sm",
            action: {
              type: "message",
              label: "ขอให้เจ้าหน้าที่ติดต่อกลับ",
              text: "ต้องการให้เจ้าหน้าที่ติดต่อกลับ",
            },
          },
          {
            type: "text",
            text: "ข้อความทดสอบจาก HEPA-GLUE · โรงพยาบาลน้ำพอง",
            color: "#8A9D9A",
            size: "xxs",
            align: "center",
            margin: "md",
            wrap: true,
          },
        ],
      },
    },
  };
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
          const resolved = resolveLineRecipientId(String(recipientId));
          const resolvedRecipientId = testRecipientId || resolved.id;
          const canPush = Boolean(token && pushEnabled && isLineRecipientId(resolvedRecipientId));

          if (!canPush) {
            return Response.json({
              status: "dry_run",
              message: token
                ? "LINE token พร้อมแล้ว แต่ยังไม่ส่งจริง เพราะยังไม่ได้เปิด LINE_PUSH_ENABLED=true หรือ recipientId ยังไม่ใช่ LINE user/group/room id"
                : "ยังไม่มี LINE_CHANNEL_ACCESS_TOKEN จึงจำลองการส่งข้อความ",
              recipientId,
              resolvedRecipientId: testRecipientId ? "LINE_TEST_RECIPIENT_ID" : resolved.id,
              persona,
              messageType,
              pushEnabled,
              tokenConfigured: Boolean(token),
              recipientSource: testRecipientId ? "test_recipient" : resolved.source,
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
              messages: [buildFlexMessage(persona, messageType)],
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
            resolvedRecipientId: testRecipientId ? "LINE_TEST_RECIPIENT_ID" : resolved.id,
            recipientSource: testRecipientId ? "test_recipient" : resolved.source,
            persona,
            messageType,
          });
        } catch (error) {
          console.error("Error sending LINE nudge:", error);
          return Response.json(
            { status: "error", message: "ส่ง LINE nudge ไม่สำเร็จ" },
            { status: 500 },
          );
        }
      },
    },
  },
});
