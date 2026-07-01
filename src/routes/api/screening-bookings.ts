import { createFileRoute } from "@tanstack/react-router";
import {
  createScreeningBooking,
  getScreeningSummary,
  updateScreeningBookingStatus,
  type ScreeningRiskFactors,
  type ScreeningBookingStatus,
} from "@/lib/screening-bookings";

const emptyRiskFactors: ScreeningRiskFactors = {
  bornBefore2535: false,
  familyHistory: false,
  bloodTransfusion: false,
  drugUse: false,
  uncleanTattoo: false,
  multiplePartners: false,
  chronicLiverDisease: false,
};

function bool(value: unknown) {
  return value === true || String(value).trim().toLowerCase() === "true" || String(value).trim() === "1";
}

export const Route = createFileRoute("/api/screening-bookings")({
  server: {
    handlers: {
      GET: async () => Response.json({ status: "success", ...getScreeningSummary() }),
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const booking = createScreeningBooking({
            fullName: String(body.fullName || ""),
            phone: String(body.phone || ""),
            birthYear: Number(body.birthYear),
            gender: body.gender ? String(body.gender) : "",
            idNumber: body.idNumber ? String(body.idNumber) : "",
            consentAccepted: bool(body.consentAccepted),
            riskFactors: { ...emptyRiskFactors, ...(body.riskFactors || {}) },
            selectedServiceUnitCode: String(body.selectedServiceUnitCode || ""),
            preferredDate: body.preferredDate ? String(body.preferredDate) : "",
            lineUserId: body.lineUserId ? String(body.lineUserId) : undefined,
            lineDisplayName: body.lineDisplayName ? String(body.lineDisplayName) : undefined,
          });
          return Response.json({ status: "success", booking, summary: getScreeningSummary() });
        } catch (error) {
          const message = error instanceof Error ? error.message : "บันทึกจองสิทธิ์ไม่สำเร็จ";
          return Response.json({ status: "error", message }, { status: 400 });
        }
      },
      PATCH: async ({ request }) => {
        try {
          const body = await request.json();
          const status = String(body.status || "") as ScreeningBookingStatus;
          if (!["reserved", "confirmed", "cancelled"].includes(status)) {
            return Response.json({ status: "error", message: "สถานะไม่ถูกต้อง" }, { status: 400 });
          }
          const booking = updateScreeningBookingStatus(String(body.id || body.bookingCode || ""), status);
          return Response.json({ status: "success", booking, summary: getScreeningSummary() });
        } catch (error) {
          const message = error instanceof Error ? error.message : "อัปเดตสถานะไม่สำเร็จ";
          return Response.json({ status: "error", message }, { status: 400 });
        }
      },
    },
  },
});
