import { createFileRoute } from "@tanstack/react-router";
import {
  createInvite,
  inspectInvite,
  queueNudge,
  readAgentStore,
  verifyInvite,
  verifyStaffIdentity,
  writeAgentStore,
  audit,
} from "@/lib/hepa-agent-store";

function requestBaseUrl(request: Request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export const Route = createFileRoute("/api/agent-orchestrator")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json(readAgentStore());
      },
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const action = String(body.action || "");

          if (action === "create_invite") {
            if (!body.hn) {
              return Response.json({ status: "error", message: "ต้องระบุ HN" }, { status: 400 });
            }
            const result = createInvite({
              hn: String(body.hn),
              patientName: body.patientName ? String(body.patientName) : undefined,
              baseUrl: requestBaseUrl(request),
            });
            return Response.json({ status: "success", ...result });
          }

          if (action === "inspect_invite") {
            if (!body.token) {
              return Response.json({ status: "error", message: "ต้องระบุ token" }, { status: 400 });
            }
            const invite = inspectInvite(String(body.token));
            return Response.json({ status: "success", invite });
          }

          if (action === "verify_invite") {
            const { token, hn, lineUserId, displayName, role } = body;
            if (role === "staff") {
              return Response.json(
                { status: "error", message: "staff ต้องยืนยันผ่าน /line/staff เท่านั้น" },
                { status: 400 },
              );
            }
            if (!token || !hn || !lineUserId) {
              return Response.json(
                { status: "error", message: "ต้องระบุ token, HN และ LINE userId" },
                { status: 400 },
              );
            }
            const result = verifyInvite({
              token: String(token),
              hn: String(hn),
              lineUserId: String(lineUserId),
              displayName: displayName ? String(displayName) : undefined,
            });
            return Response.json({ status: "success", ...result });
          }

          if (action === "verify_staff") {
            const { lineUserId, displayName } = body;
            if (!lineUserId) {
              return Response.json({ status: "error", message: "ต้องระบุ LINE userId" }, { status: 400 });
            }
            const result = verifyStaffIdentity({
              lineUserId: String(lineUserId),
              displayName: displayName ? String(displayName) : undefined,
            });
            return Response.json({ status: "success", ...result });
          }

          if (action === "queue_nudge") {
            if (!body.hn) {
              return Response.json({ status: "error", message: "ต้องระบุ HN" }, { status: 400 });
            }
            const result = queueNudge({
              hn: String(body.hn),
              persona: body.persona ? String(body.persona) : undefined,
              message: body.message ? String(body.message) : undefined,
            });
            return Response.json({ status: "success", ...result });
          }

          if (action === "send_nudge") {
            if (!body.hn) {
              return Response.json({ status: "error", message: "ต้องระบุ HN" }, { status: 400 });
            }
            const store = readAgentStore();
            const identity = store.identities.find(
              (item) => item.hn === String(body.hn) && item.role === "patient" && item.status === "verified",
            );
            if (!identity) {
              return Response.json(
                { status: "error", message: "ยังไม่มี LINE identity สำหรับ HN นี้" },
                { status: 409 },
              );
            }

            const lineResponse = await fetch(`${requestBaseUrl(request)}/api/send-nudge`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                recipientId: identity.lineUserId,
                persona: body.persona || "The Engaged",
                messageType: body.messageType || "LINE_NUDGE",
              }),
            });
            const linePayload = await lineResponse.json();
            const createdAt = new Date().toISOString();
            const task = {
              id: `task_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`,
              hn: String(body.hn),
              type: "line_nudge" as const,
              status: linePayload.status === "sent" ? ("sent" as const) : ("blocked" as const),
              lineUserId: identity.lineUserId,
              persona: String(body.persona || "The Engaged"),
              message:
                linePayload.status === "sent"
                  ? "ส่ง LINE nudge สำเร็จ"
                  : linePayload.message || "LINE nudge ยังไม่ถูกส่ง",
              createdAt,
              updatedAt: createdAt,
            };
            store.tasks.unshift(task);
            audit(store, {
              actor: "agent",
              action: "send_line_nudge",
              hn: String(body.hn),
              detail: task.message,
            });
            writeAgentStore(store);
            return Response.json({ status: linePayload.status, task, line: linePayload }, { status: lineResponse.ok ? 200 : 502 });
          }

          if (action === "close_task") {
            const store = readAgentStore();
            const task = store.tasks.find((item) => item.id === body.taskId);
            if (!task) return Response.json({ status: "error", message: "ไม่พบ task" }, { status: 404 });
            task.status = "closed";
            task.updatedAt = new Date().toISOString();
            audit(store, {
              actor: "staff",
              action: "close_task",
              hn: task.hn,
              detail: `ปิด task ${task.id}`,
            });
            writeAgentStore(store);
            return Response.json({ status: "success", task });
          }

          return Response.json({ status: "error", message: "ไม่รู้จัก action" }, { status: 400 });
        } catch (error) {
          const message = error instanceof Error ? error.message : "agent orchestrator error";
          return Response.json({ status: "error", message }, { status: 500 });
        }
      },
    },
  },
});
