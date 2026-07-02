import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  Loader2,
  RefreshCcw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmAction } from "@/components/confirm-action";
import { WorkflowSteps } from "@/components/workflow-steps";
import { Input } from "@/components/ui/input";
import { OfficialPageHeader } from "@/components/official-layout";

type Booking = {
  id: string;
  bookingCode: string;
  fullName: string;
  phone: string;
  birthYear: number;
  gender?: string;
  cidLast4?: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  recommendation: string;
  selectedServiceUnitCode: string;
  selectedServiceUnit: { unitName: string; subdistrict: string };
  preferredDate?: string;
  status: "reserved" | "confirmed" | "cancelled";
  consentAccepted?: boolean;
  consentAcceptedAt?: string;
  consentNoticeVersion?: string;
  rosterVerified?: boolean;
  rosterSourceSheet?: string;
  rosterRowNumber?: number;
  rosterMatchedBy?: "cid" | "phone_name" | "name";
  createdAt: string;
  lineUserId?: string;
  lineDisplayName?: string;
};

type ScreeningSummary = {
  checkedAt: string;
  totalQuota: number;
  booked: number;
  remaining: number;
  percentage: number;
  bookings: Booking[];
  units: Array<{
    code: string;
    unitName: string;
    quota: number;
    booked: number;
    remaining: number;
  }>;
};

export const Route = createFileRoute("/screening-queue")({
  head: () => ({
    meta: [
      { title: "คิวจองคัดกรองประชาชน — HEPA-GLUE Engine" },
      {
        name: "description",
        content: "คิวประชาชนที่ลงทะเบียนคัดกรองไวรัสตับอักเสบผ่าน LINE",
      },
    ],
  }),
  component: ScreeningQueuePage,
});

async function fetchQueue(): Promise<ScreeningSummary> {
  const response = await fetch("/api/screening-bookings");
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || "โหลดคิวไม่สำเร็จ");
  return data;
}

async function updateStatus(id: string, status: Booking["status"]) {
  const response = await fetch("/api/screening-bookings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, status }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || "อัปเดตสถานะไม่สำเร็จ");
  return data;
}

function riskClass(level: Booking["riskLevel"]) {
  if (level === "HIGH") return "border-red-200 bg-red-50 text-red-900";
  if (level === "MEDIUM") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-emerald-200 bg-emerald-50 text-emerald-900";
}

function statusClass(status: Booking["status"]) {
  if (status === "confirmed") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "cancelled") return "border-slate-200 bg-slate-100 text-slate-700";
  return "border-sky-200 bg-sky-50 text-sky-900";
}

function statusLabel(status: Booking["status"]) {
  if (status === "confirmed") return "ยืนยันสิทธิ์แล้ว";
  if (status === "cancelled") return "ยกเลิกแล้ว";
  return "รอตรวจสอบ";
}

function riskLabel(level: Booking["riskLevel"]) {
  if (level === "HIGH") return "เร่งด่วน";
  if (level === "MEDIUM") return "ควรเข้ารับการตรวจ";
  return "ติดตามตามปกติ";
}

function ScreeningQueuePage() {
  const [query, setQuery] = useState("");
  const [unit, setUnit] = useState("all");
  const queue = useQuery({ queryKey: ["screening-bookings"], queryFn: fetchQueue });
  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Booking["status"] }) =>
      updateStatus(id, status),
    onSuccess: () => {
      toast.success("อัปเดตสถานะแล้ว");
      queue.refetch();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "อัปเดตไม่สำเร็จ"),
  });

  const bookings = useMemo(() => queue.data?.bookings || [], [queue.data?.bookings]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bookings.filter((booking) => {
      const matchesText =
        !q ||
        booking.fullName.toLowerCase().includes(q) ||
        booking.phone.includes(q) ||
        booking.bookingCode.toLowerCase().includes(q) ||
        booking.selectedServiceUnit.unitName.toLowerCase().includes(q);
      const matchesUnit = unit === "all" || booking.selectedServiceUnitCode === unit;
      return matchesText && matchesUnit;
    });
  }, [bookings, query, unit]);

  const highRisk = bookings.filter((item) => item.riskLevel === "HIGH").length;
  const reserved = bookings.filter((item) => item.status === "reserved").length;
  const confirmed = bookings.filter((item) => item.status === "confirmed").length;

  return (
    <div className="page-shell">
      <OfficialPageHeader
        eyebrow="คิวคัดกรองจาก LINE"
        title="คิวจองสิทธิ์คัดกรองจาก LINE"
        description="รายการประชาชนที่ประเมินความเสี่ยงและจองสิทธิ์คัดกรองไวรัสตับอักเสบ B/C ผ่าน LINE พร้อมตรวจรายชื่อหน่วยบริการและบันทึกความยินยอมก่อนเข้าคิว"
        badges={["ตรวจสอบกับรายชื่อกลาง", "บันทึกความยินยอม", "พร้อมให้บริการหน้างาน"]}
      >
        <Button
          variant="outline"
          onClick={() => queue.refetch()}
          disabled={queue.isFetching}
          className="gap-2"
        >
          {queue.isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="h-4 w-4" />
          )}
          รีเฟรช
        </Button>
      </OfficialPageHeader>

      <WorkflowSteps
        title="เส้นทางรับบริการคัดกรอง"
        steps={[
          { title: "รับการจองผ่าน LINE", detail: "บันทึกข้อมูลและความยินยอม" },
          { title: "ตรวจสอบรายชื่อ", detail: "เทียบกับรายชื่อกลางของหน่วยบริการ" },
          { title: "ยืนยันสิทธิ์", detail: "เจ้าหน้าที่ตรวจวันและสถานที่รับบริการ" },
          { title: "เข้ารับการคัดกรอง", detail: "บันทึกผลและส่งต่อเมื่อพบความเสี่ยง" },
        ]}
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "โควตาทั้งหมด", value: queue.data?.totalQuota ?? 0, icon: Users },
          { label: "จองแล้ว", value: queue.data?.booked ?? 0, icon: ClipboardList },
          { label: "คงเหลือ", value: queue.data?.remaining ?? 0, icon: Calendar },
          { label: "รอยืนยัน", value: reserved, icon: ShieldCheck },
          { label: "ยืนยันแล้ว", value: confirmed, icon: CheckCircle2 },
        ].map((item) => (
          <Card key={item.label} className="metric-card">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="text-2xl font-bold">{item.value.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">{item.label}</div>
              </div>
              <item.icon className="h-5 w-5 text-teal" />
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="metric-card">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="text-base">รายการจองคัดกรอง</CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="ค้นหาชื่อ/เบอร์/รหัส"
                  className="pl-9 sm:w-64"
                />
              </div>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
              >
                <option value="all">ทุกหน่วยบริการ</option>
                {queue.data?.units.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.unitName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            เสี่ยงสูง {highRisk} ราย · อัปเดตล่าสุด{" "}
            {queue.data?.checkedAt ? new Date(queue.data.checkedAt).toLocaleString("th-TH") : "-"}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[1120px] text-sm">
              <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">รหัส</th>
                  <th className="px-3 py-2">ผู้ลงทะเบียน</th>
                  <th className="px-3 py-2">หน่วยบริการ</th>
                  <th className="px-3 py-2">วันที่ต้องการ</th>
                  <th className="px-3 py-2">ความเสี่ยง</th>
                  <th className="px-3 py-2">LINE</th>
                  <th className="px-3 py-2">รายชื่อ</th>
                  <th className="px-3 py-2">ความยินยอม</th>
                  <th className="px-3 py-2">สถานะ</th>
                  <th className="px-3 py-2 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((booking) => (
                  <tr key={booking.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">{booking.bookingCode}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{booking.fullName}</div>
                      <div className="text-xs text-muted-foreground">
                        {booking.phone} · เกิด {booking.birthYear}
                        {booking.cidLast4 ? ` · CID ****${booking.cidLast4}` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div>{booking.selectedServiceUnit.unitName}</div>
                      <div className="text-xs text-muted-foreground">
                        {booking.selectedServiceUnit.subdistrict}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {booking.preferredDate
                        ? new Date(booking.preferredDate).toLocaleDateString("th-TH")
                        : "ไม่ระบุ"}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={riskClass(booking.riskLevel)}>
                        {riskLabel(booking.riskLevel)}
                      </Badge>
                      <div className="mt-1 max-w-64 text-[10px] leading-4 text-muted-foreground">
                        {booking.recommendation}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {booking.lineUserId
                        ? booking.lineDisplayName || booking.lineUserId.slice(0, 10)
                        : "ยังไม่ผูก"}
                    </td>
                    <td className="px-3 py-2">
                      {booking.rosterVerified ? (
                        <>
                          <Badge
                            variant="outline"
                            className="border-sky-200 bg-sky-50 text-sky-900"
                          >
                            ตรงรายชื่อ
                          </Badge>
                          <div className="mt-1 text-[10px] text-muted-foreground">
                            {booking.rosterSourceSheet}
                            {booking.rosterRowNumber ? ` · แถว ${booking.rosterRowNumber}` : ""}
                          </div>
                        </>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-amber-200 bg-amber-50 text-amber-900"
                        >
                          ไม่พบหลักฐาน
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {booking.consentAccepted ? (
                        <>
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 text-emerald-900"
                          >
                            ยินยอมแล้ว
                          </Badge>
                          <div className="mt-1 text-[10px] text-muted-foreground">
                            {booking.consentAcceptedAt
                              ? new Date(booking.consentAcceptedAt).toLocaleString("th-TH")
                              : ""}
                          </div>
                        </>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-amber-200 bg-amber-50 text-amber-900"
                        >
                          ยังไม่มีบันทึก
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={statusClass(booking.status)}>
                        {statusLabel(booking.status)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={mutation.isPending || booking.status === "confirmed"}
                          onClick={() => mutation.mutate({ id: booking.id, status: "confirmed" })}
                        >
                          ยืนยัน
                        </Button>
                        <ConfirmAction
                          trigger="ยกเลิก"
                          title={`ยืนยันยกเลิกสิทธิ์ของ ${booking.fullName}`}
                          description={`สิทธิ์หมายเลข ${booking.bookingCode} จะถูกยกเลิกและไม่อยู่ในคิวรอรับบริการ`}
                          confirmLabel="ยืนยันยกเลิกสิทธิ์"
                          destructive
                          disabled={mutation.isPending || booking.status === "cancelled"}
                          onConfirm={() => mutation.mutate({ id: booking.id, status: "cancelled" })}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-3 py-8 text-center text-sm text-muted-foreground"
                    >
                      ยังไม่มีรายการตามเงื่อนไขนี้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
