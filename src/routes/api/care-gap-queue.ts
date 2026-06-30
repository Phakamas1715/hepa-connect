import { createFileRoute } from "@tanstack/react-router";
import {
  getCareGapModuleStatus,
  openHcvTreatmentGapQueue,
} from "@/lib/care-gap-queue";

export const Route = createFileRoute("/api/care-gap-queue")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json({ status: "success", ...getCareGapModuleStatus() });
      },
      POST: async () => {
        try {
          const summary = openHcvTreatmentGapQueue();
          return Response.json({ status: "success", ...summary });
        } catch (error) {
          const message = error instanceof Error ? error.message : "เปิดคิวติดตามไม่สำเร็จ";
          return Response.json({ status: "error", message }, { status: 500 });
        }
      },
    },
  },
});