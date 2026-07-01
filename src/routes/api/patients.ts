import { createFileRoute } from "@tanstack/react-router";
import {
  deletePatient,
  listPatients,
  syncPatientsFromGoogleSheet,
  upsertPatient,
} from "@/lib/patient-registry";

export const Route = createFileRoute("/api/patients")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json({ status: "success", ...listPatients() });
      },
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          if (body.action === "sync_google_sheet") {
            const sync = await syncPatientsFromGoogleSheet();
            return Response.json({ status: "success", sync, ...listPatients() });
          }
          const patient = upsertPatient(body);
          return Response.json({ status: "success", patient, ...listPatients() });
        } catch (error) {
          const message = error instanceof Error ? error.message : "บันทึกข้อมูลผู้ป่วยไม่สำเร็จ";
          return Response.json({ status: "error", message }, { status: 400 });
        }
      },
      PATCH: async ({ request }) => {
        try {
          const body = await request.json();
          const patient = upsertPatient(body);
          return Response.json({ status: "success", patient, ...listPatients() });
        } catch (error) {
          const message = error instanceof Error ? error.message : "แก้ไขข้อมูลผู้ป่วยไม่สำเร็จ";
          return Response.json({ status: "error", message }, { status: 400 });
        }
      },
      DELETE: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const hn = url.searchParams.get("hn") || "";
          const deleted = deletePatient(hn);
          return Response.json({ status: "success", deleted, ...listPatients() });
        } catch (error) {
          const message = error instanceof Error ? error.message : "ลบข้อมูลผู้ป่วยไม่สำเร็จ";
          return Response.json({ status: "error", message }, { status: 400 });
        }
      },
    },
  },
});
