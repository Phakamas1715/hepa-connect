import { createFileRoute } from "@tanstack/react-router";
import {
  createAppointment,
  createInvite,
  getAppointment,
  inspectInvite,
  queueNudge,
  readAgentStore,
  reconcileAgentStoreWithSources,
  updateAppointmentNotification,
  updateAppointmentStatus,
  verifyInvite,
  verifyStaffIdentity,
  writeAgentStore,
  audit,
  type AgentAppointment,
  type AgentAppointmentStatus,
} from "@/lib/hepa-agent-store";
import { buildAppointmentFlexMessage } from "@/lib/appointment-card";
import { HEPA_SERVICE_AREAS } from "@/lib/hepa-service-area";
import { getScreenedPassedResults, type ScreenedTestResult } from "@/lib/kumhos-client";
import type { HepCaseInput } from "@/lib/moph-hepbc-reporter";
import { listPatients } from "@/lib/patient-registry";
import { getPositiveIntakeSummary } from "@/lib/positive-intake";
import { serverEnv } from "@/lib/server-env";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

function requestBaseUrl(request: Request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

async function pushDailyHepbcLineSummary(
  date: string,
  positives: number,
  reported: number,
  note: string,
) {
  const token = serverEnv("LINE_CHANNEL_ACCESS_TOKEN");
  const recipient = serverEnv("LINE_DAILY_RECIPIENT_ID") || serverEnv("LINE_TEST_RECIPIENT_ID");
  if (!token || serverEnv("LINE_PUSH_ENABLED") !== "true" || !recipient) return;

  try {
    await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: recipient,
        messages: [
          {
            type: "text",
            text: `Daily Hep-BC (auto)\nวันที่: ${date}\nพบ positive: ${positives} ราย\nรายงาน MOPH: ${reported} ราย\n${note}\n(น้ำพองรักตับ - HEPA-Connect)`,
          },
        ],
      }),
    });
  } catch (e) {
    console.error("Daily Hep-BC LINE push failed", e);
  }
}

async function sendAppointmentLine(appointment: AgentAppointment) {
  const store = readAgentStore();
  const identity = store.identities.find(
    (item) => item.hn === appointment.hn && item.role === "patient" && item.status === "verified",
  );
  if (!identity) {
    updateAppointmentNotification(appointment.id, {
      status: "not_linked",
      detail: "ยังไม่มี patient identity",
    });
    return {
      status: "not_linked",
      message: "บันทึกนัดแล้ว แต่ยังส่ง LINE ไม่ได้ เนื่องจากผู้รับบริการยังไม่ผูก LINE",
    };
  }

  const token = serverEnv("LINE_CHANNEL_ACCESS_TOKEN");
  const pushEnabled = serverEnv("LINE_PUSH_ENABLED") === "true";
  if (!token || !pushEnabled) {
    return {
      status: "dry_run",
      message: "บันทึกนัดแล้ว แต่ระบบยังไม่เปิดส่ง LINE จริง",
    };
  }

  const response = await fetch(LINE_PUSH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: identity.lineUserId,
      messages: [buildAppointmentFlexMessage({ ...appointment, lineUserId: identity.lineUserId })],
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    updateAppointmentNotification(appointment.id, {
      status: "failed",
      lineUserId: identity.lineUserId,
      detail: `LINE HTTP ${response.status}`,
    });
    return {
      status: "error",
      message: "LINE ส่งบัตรนัดไม่สำเร็จ",
      lineStatus: response.status,
      detail: detail.slice(0, 160),
    };
  }

  const updated = updateAppointmentNotification(appointment.id, {
    status: "sent",
    lineUserId: identity.lineUserId,
  });
  return {
    status: "sent",
    message: "ส่ง LINE Flex บัตรนัดแล้ว",
    appointment: updated.appointment,
  };
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
              return Response.json(
                { status: "error", message: "ต้องระบุ LINE userId" },
                { status: 400 },
              );
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

          if (action === "create_appointment") {
            const registry = listPatients();
            const positiveSummary = getPositiveIntakeSummary();
            const hn = String(body.hn || "").trim();
            const patient =
              registry.patients.find((item) => item.hn === hn) ||
              positiveSummary.records.find((item) => item.caseCode === hn);
            if (!patient) {
              return Response.json(
                {
                  status: "error",
                  message: "ไม่พบ HN/รหัสเคสในทะเบียน live หรือคิวผู้พบเชื้อ",
                },
                { status: 400 },
              );
            }

            const facilityCode = String(body.facilityCode || "");
            const facility = HEPA_SERVICE_AREAS.find((item) => item.code === facilityCode);
            if (!facility) {
              return Response.json(
                { status: "error", message: "ไม่พบสถานที่นัด" },
                { status: 400 },
              );
            }
            const result = createAppointment({
              hn,
              patientName: String(
                body.patientName || ("name" in patient ? patient.name : patient.fullName) || "",
              ),
              facilityCode: facility.code,
              facilityName: facility.unitName,
              appointmentDate: String(body.appointmentDate || ""),
              appointmentTime: body.appointmentTime ? String(body.appointmentTime) : undefined,
              note: body.note ? String(body.note) : undefined,
            });
            const notification =
              body.sendLine === true
                ? await sendAppointmentLine(result.appointment)
                : {
                    status: result.identity ? "pending" : "not_linked",
                    message: result.identity
                      ? "บันทึกนัดแล้ว พร้อมส่ง LINE"
                      : "บันทึกนัดแล้ว รอผู้รับบริการผูก LINE",
                  };
            return Response.json({
              status: "success",
              ...result,
              notification,
            });
          }

          if (action === "send_appointment") {
            const appointment = getAppointment(String(body.id || body.appointmentCode || ""));
            if (appointment.status === "cancelled" || appointment.status === "completed") {
              return Response.json(
                { status: "error", message: "นัดนี้ปิดงานแล้ว ไม่สามารถส่งซ้ำได้" },
                { status: 409 },
              );
            }
            const notification = await sendAppointmentLine(appointment);
            return Response.json(
              {
                status: notification.status === "error" ? "error" : "success",
                notification,
              },
              { status: notification.status === "error" ? 502 : 200 },
            );
          }

          if (action === "update_appointment") {
            const status = String(body.status || "") as AgentAppointmentStatus;
            if (!["scheduled", "confirmed", "completed", "cancelled"].includes(status)) {
              return Response.json(
                { status: "error", message: "สถานะนัดหมายไม่ถูกต้อง" },
                { status: 400 },
              );
            }
            const result = updateAppointmentStatus(
              String(body.id || body.appointmentCode || ""),
              status,
            );
            return Response.json({ status: "success", ...result });
          }

          if (action === "preview_appointment_flex") {
            const appointment = getAppointment(String(body.id || body.appointmentCode || ""));
            return Response.json({
              status: "success",
              appointment,
              flex: buildAppointmentFlexMessage(appointment),
            });
          }

          if (action === "reconcile_data") {
            const registry = listPatients();
            const positiveSummary = getPositiveIntakeSummary();
            const reconciliation = reconcileAgentStoreWithSources({
              livePatientHns: registry.patients.map((item) => item.hn),
              positiveRecords: positiveSummary.records.map((item) => ({
                caseCode: item.caseCode,
                agentTaskId: item.agentTaskId,
                status: item.status,
              })),
            });
            return Response.json({
              status: "success",
              registry: {
                source: registry.meta.source,
                count: registry.patients.length,
              },
              reconciliation,
              store: readAgentStore(),
            });
          }

          if (action === "send_nudge") {
            if (!body.hn) {
              return Response.json({ status: "error", message: "ต้องระบุ HN" }, { status: 400 });
            }
            const store = readAgentStore();
            const identity = store.identities.find(
              (item) =>
                item.hn === String(body.hn) &&
                item.role === "patient" &&
                item.status === "verified",
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
            return Response.json(
              { status: linePayload.status, task, line: linePayload },
              { status: lineResponse.ok ? 200 : 502 },
            );
          }

          if (action === "run_daily_hepbc" || action === "daily_hepbc_report") {
            const store = readAgentStore();
            const date = body.date || new Date(Date.now() - 86400000).toISOString().split("T")[0];
            audit(store, {
              actor: "system",
              action: "run_daily_hepbc",
              detail: `Daily Hep-BC for ${date}`,
            });

            let screened: ScreenedTestResult[] = [];
            try {
              screened = await getScreenedPassedResults(date);
            } catch (e) {
              console.error("HOSxP pull failed", e);
              screened = [];
            }

            const positives = screened.filter(
              (r) =>
                r.hbsag === "Positive" ||
                r.rapid_hbv_result === "Positive" ||
                r.hcvAb === "Positive" ||
                r.hcvVL === "Detected" ||
                r.rapid_hcv_result === "Positive",
            );

            const cases: HepCaseInput[] = positives.map((r) => ({
              hn: String(r.hn || r.patient_hn || `HOSxP-${r.id || Date.now()}`),
              testDate: r.date || date,
              hbsag: r.hbsag || r.rapid_hbv_result,
              hcvAb: r.hcvAb || r.rapid_hcv_result,
              hcvVL: r.hcvVL,
            }));

            let reportResult = null;
            if (cases.length > 0) {
              try {
                const { autoFillHepBCReport } = await import("@/lib/moph-hepbc-reporter");
                reportResult = await autoFillHepBCReport(cases);
              } catch (e: unknown) {
                console.error("Daily Hep-BC report failed", e);
                reportResult = {
                  success: false,
                  error: e instanceof Error ? e.message : String(e),
                };
              }
            }

            const reported = reportResult?.reported || 0;
            const mophNote =
              reportResult && "error" in reportResult && reportResult.error
                ? `MOPH: รอ puppeteer/โรงพยาบาล (${String(reportResult.error).slice(0, 80)})`
                : "MOPH: ส่งแล้ว";
            await pushDailyHepbcLineSummary(date, positives.length, reported, mophNote);

            audit(store, {
              actor: "system",
              action: "daily_hepbc_run",
              detail: `date=${date} positives=${positives.length} reported=${reported}`,
            });
            writeAgentStore(store);
            return Response.json({
              status: "success",
              date,
              pulled: screened.length,
              positives: positives.length,
              reported,
              result: reportResult,
            });
          }

          if (action === "close_task") {
            const store = readAgentStore();
            const task = store.tasks.find((item) => item.id === body.taskId);
            if (!task)
              return Response.json({ status: "error", message: "ไม่พบ task" }, { status: 404 });
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
