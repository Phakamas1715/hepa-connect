import { createFileRoute } from "@tanstack/react-router";
import { getIliDailySummary, yesterdayBangkok } from "@/lib/ili-report";

export const Route = createFileRoute("/api/ili-report")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const date = url.searchParams.get("date") || yesterdayBangkok();
        return Response.json(await getIliDailySummary(date));
      },
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as { date?: string; submit?: boolean };
        const summary = await getIliDailySummary(body.date || yesterdayBangkok());

        if (body.submit) {
          return Response.json(
            {
              ...summary,
              submitted: false,
              message:
                "เตรียมยอดแล้ว แต่ยังไม่ส่งเข้าเว็บ D506 เพราะหน้า ILI ต้อง login MOPH และยังไม่มี MOPH_REPORTER_ENDPOINT ที่ยืนยันรูปแบบส่งข้อมูล",
            },
            { status: 202 },
          );
        }

        return Response.json({
          ...summary,
          submitted: false,
          message: "เตรียมยอด ILI สำหรับกรอกอัตโนมัติแล้ว",
        });
      },
    },
  },
});
