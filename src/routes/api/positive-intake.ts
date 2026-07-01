import { createFileRoute } from "@tanstack/react-router";
import {
  createPositiveIntake,
  getPositiveIntakeSummary,
  updatePositiveIntakeStatus,
  type PositiveIntakeStatus,
} from "@/lib/positive-intake";

function bool(value: unknown) {
  return (
    value === true || String(value).trim().toLowerCase() === "true" || String(value).trim() === "1"
  );
}

export const Route = createFileRoute("/api/positive-intake")({
  server: {
    handlers: {
      GET: async () => Response.json({ status: "success", ...getPositiveIntakeSummary() }),
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const result = createPositiveIntake({
            fullName: String(body.fullName || ""),
            testFacilityCode: String(body.testFacilityCode || ""),
            testFacilityName: body.testFacilityName ? String(body.testFacilityName) : undefined,
            positiveResult: body.positiveResult ? String(body.positiveResult) : undefined,
            consentAccepted: bool(body.consentAccepted),
            lineUserId: body.lineUserId ? String(body.lineUserId) : undefined,
            lineDisplayName: body.lineDisplayName ? String(body.lineDisplayName) : undefined,
          });
          return Response.json({
            status: "success",
            ...result,
            summary: getPositiveIntakeSummary(),
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "บันทึกข้อมูลผู้พบเชื้อไม่สำเร็จ";
          return Response.json({ status: "error", message }, { status: 400 });
        }
      },
      PATCH: async ({ request }) => {
        try {
          const body = await request.json();
          const status = String(body.status || "") as PositiveIntakeStatus;
          if (!["new", "agent_queued", "contacted", "closed"].includes(status)) {
            return Response.json({ status: "error", message: "สถานะไม่ถูกต้อง" }, { status: 400 });
          }
          const record = updatePositiveIntakeStatus(String(body.id || body.caseCode || ""), status);
          return Response.json({ status: "success", record, summary: getPositiveIntakeSummary() });
        } catch (error) {
          const message = error instanceof Error ? error.message : "อัปเดตสถานะไม่สำเร็จ";
          return Response.json({ status: "error", message }, { status: 400 });
        }
      },
    },
  },
});
