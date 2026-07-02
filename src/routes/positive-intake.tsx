import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  ClipboardList,
  Loader2,
  RefreshCcw,
  Search,
  ShieldCheck,
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

type PositiveIntakeStatus = "new" | "agent_queued" | "contacted" | "closed";

type PositiveRecord = {
  id: string;
  caseCode: string;
  fullName: string;
  testFacilityName: string;
  positiveResult: string;
  status: PositiveIntakeStatus;
  consentAcceptedAt: string;
  lineUserId?: string;
  lineDisplayName?: string;
  agentTaskId?: string;
  patientIdentityStatus?: "verified" | "blocked";
  patientIdentityReason?: string;
  createdAt: string;
};

type PositiveSummary = {
  checkedAt: string;
  total: number;
  active: number;
  newCount: number;
  agentQueued: number;
  contacted: number;
  closed: number;
  records: PositiveRecord[];
};

export const Route = createFileRoute("/positive-intake")({
  head: () => ({
    meta: [
      { title: "คิวผู้พบเชื้อจาก LINE — HEPA-GLUE Engine" },
      {
        name: "description",
        content: "รายการผู้พบเชื้อที่ยืนยันข้อมูลผ่าน LINE LIFF พร้อมความยินยอม PDPA",
      },
    ],
  }),
  component: PositiveIntakePage,
});

async function fetchPositiveIntake(): Promise<PositiveSummary> {
  const response = await fetch("/api/positive-intake");
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || "โหลดรายการผู้พบเชื้อไม่สำเร็จ");
  return data;
}

async function updateStatus(id: string, status: PositiveIntakeStatus) {
  const response = await fetch("/api/positive-intake", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, status }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || "อัปเดตสถานะไม่สำเร็จ");
  return data;
}

function statusClass(status: PositiveIntakeStatus) {
  if (status === "closed") return "border-slate-200 bg-slate-100 text-slate-700";
  if (status === "contacted") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "agent_queued") return "border-sky-200 bg-sky-50 text-sky-900";
  return "border-amber-200 bg-amber-50 text-amber-900";
}

function statusLabel(status: PositiveIntakeStatus) {
  if (status === "closed") return "ปิดงาน";
  if (status === "contacted") return "ติดต่อแล้ว";
  if (status === "agent_queued") return "เข้าคิวติดตามแล้ว";
  return "รายการใหม่";
}

function PositiveIntakePage() {
  const [query, setQuery] = useState("");
  const intake = useQuery({ queryKey: ["positive-intake"], queryFn: fetchPositiveIntake });
  const records = useMemo(() => intake.data?.records || [], [intake.data?.records]);
  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PositiveIntakeStatus }) =>
      updateStatus(id, status),
    onSuccess: () => {
      toast.success("อัปเดตสถานะแล้ว");
      intake.refetch();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "อัปเดตไม่สำเร็จ"),
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter(
      (record) =>
        !q ||
        record.caseCode.toLowerCase().includes(q) ||
        record.fullName.toLowerCase().includes(q) ||
        record.testFacilityName.toLowerCase().includes(q) ||
        record.positiveResult.toLowerCase().includes(q),
    );
  }, [query, records]);

  return (
    <div className="page-shell">
      <OfficialPageHeader
        eyebrow="คิวผู้พบเชื้อจาก LINE"
        title="รายการผู้แจ้งผลตรวจผ่าน LINE"
        description="ตรวจสอบข้อมูลผู้แจ้งผล สถานบริการที่ตรวจ ความยินยอม และสถานะการติดต่อ โดยระบบจะส่งรายการใหม่เข้าคิวติดตามให้อัตโนมัติ"
        badges={["ยืนยันบัญชี LINE", "บันทึกความยินยอม", "สร้างคิวติดตามอัตโนมัติ"]}
      >
        <Button
          variant="outline"
          onClick={() => intake.refetch()}
          disabled={intake.isFetching}
          className="gap-2"
        >
          {intake.isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="h-4 w-4" />
          )}
          รีเฟรช
        </Button>
      </OfficialPageHeader>

      <WorkflowSteps
        title="เส้นทางดูแลผู้แจ้งผลตรวจ"
        steps={[
          { title: "รับข้อมูลจาก LINE", detail: "ผู้รับบริการยืนยันตัวตนและความยินยอม" },
          { title: "ตรวจสอบข้อมูล", detail: "ตรวจชื่อ ผลตรวจ และสถานบริการ" },
          { title: "ติดต่อและนัดหมาย", detail: "ประสานการตรวจยืนยันหรือการรักษา" },
          { title: "บันทึกผลการติดตาม", detail: "อัปเดตสถานะและปิดงานเมื่อเสร็จสิ้น" },
        ]}
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "ทั้งหมด", value: intake.data?.total ?? 0, icon: ClipboardList },
          { label: "กำลังติดตาม", value: intake.data?.active ?? 0, icon: ShieldCheck },
          { label: "เข้าคิวติดตามแล้ว", value: intake.data?.agentQueued ?? 0, icon: CheckCircle2 },
          { label: "ติดต่อแล้ว", value: intake.data?.contacted ?? 0, icon: CheckCircle2 },
          { label: "ปิดงาน", value: intake.data?.closed ?? 0, icon: CheckCircle2 },
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
            <CardTitle className="text-base">รายการยืนยันผลบวก</CardTitle>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ค้นหาชื่อ/รหัส/สถานบริการ"
                className="pl-9 sm:w-72"
              />
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            อัปเดตล่าสุด{" "}
            {intake.data?.checkedAt ? new Date(intake.data.checkedAt).toLocaleString("th-TH") : "-"}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">รหัส</th>
                  <th className="px-3 py-2">ผู้พบเชื้อ</th>
                  <th className="px-3 py-2">สถานบริการที่ตรวจ</th>
                  <th className="px-3 py-2">ผลที่แจ้ง</th>
                  <th className="px-3 py-2">LINE</th>
                  <th className="px-3 py-2">ความยินยอม</th>
                  <th className="px-3 py-2">สถานะ</th>
                  <th className="px-3 py-2 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((record) => (
                  <tr key={record.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">{record.caseCode}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{record.fullName}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(record.createdAt).toLocaleString("th-TH")}
                      </div>
                    </td>
                    <td className="px-3 py-2">{record.testFacilityName}</td>
                    <td className="px-3 py-2">{record.positiveResult}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      <div>
                        {record.lineUserId
                          ? record.lineDisplayName || record.lineUserId.slice(0, 10)
                          : "ยังไม่ผูก"}
                      </div>
                      {record.patientIdentityStatus === "verified" && (
                        <Badge
                          variant="outline"
                          className="mt-1 border-emerald-200 bg-emerald-50 text-[10px] text-emerald-900"
                        >
                          พร้อมรับบัตรนัด
                        </Badge>
                      )}
                      {record.patientIdentityStatus === "blocked" && (
                        <div className="mt-1 max-w-48 text-[10px] leading-4 text-amber-700">
                          {record.patientIdentityReason || "ต้องตรวจสอบการเชื่อมบัญชี LINE"}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 text-emerald-900"
                      >
                        ยินยอมแล้ว
                      </Badge>
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {new Date(record.consentAcceptedAt).toLocaleString("th-TH")}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={statusClass(record.status)}>
                        {statusLabel(record.status)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={mutation.isPending || record.status === "contacted"}
                          onClick={() => mutation.mutate({ id: record.id, status: "contacted" })}
                        >
                          ติดต่อแล้ว
                        </Button>
                        <ConfirmAction
                          trigger="ปิดงาน"
                          title={`ยืนยันปิดรายการของ ${record.fullName}`}
                          description="รายการนี้จะออกจากคิวที่กำลังติดตาม แต่ข้อมูลและประวัติการดำเนินงานยังคงเก็บไว้เพื่อตรวจสอบย้อนหลัง"
                          confirmLabel="ยืนยันปิดงาน"
                          destructive
                          disabled={mutation.isPending || record.status === "closed"}
                          onConfirm={() => mutation.mutate({ id: record.id, status: "closed" })}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">
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
