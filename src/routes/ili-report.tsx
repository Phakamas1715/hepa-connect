import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Loader2,
  RefreshCcw,
  Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ILI_ICD10_CODES } from "@/lib/ili-constants";

export const Route = createFileRoute("/ili-report")({
  head: () => ({
    meta: [
      { title: "รายงาน ILI อัตโนมัติ - HEPA-GLUE Engine" },
      {
        name: "description",
        content: "เตรียมยอดผู้ป่วยกลุ่มอาการคล้ายไข้หวัดใหญ่ ILI สำหรับ D506 Syndromic",
      },
    ],
  }),
  component: IliReportPage,
});

type IliSummary = {
  ok: boolean;
  state: "ready" | "partial" | "blocked";
  reportDate: string;
  weekday: string;
  isScheduledDay: boolean;
  iliVisits: number;
  totalVisits: number;
  iliPercent: number;
  source: string;
  mode: "live_bridge" | "fallback";
  detail: string;
  codes: string[];
  checkedAt: string;
  portal: {
    name: string;
    url: string;
    loginRequired: boolean;
    autoSubmitReady: boolean;
  };
  schedule: {
    days: string[];
    pullDate: "yesterday";
    timezone: string;
  };
  message?: string;
  submitted?: boolean;
};

async function fetchIliSummary(): Promise<IliSummary> {
  const response = await fetch("/api/ili-report");
  if (!response.ok) throw new Error("ตรวจยอด ILI ไม่สำเร็จ");
  return response.json();
}

async function prepareIliReport(): Promise<IliSummary> {
  const response = await fetch("/api/ili-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ submit: true }),
  });
  const payload = await response.json();
  if (!response.ok && response.status !== 202) throw new Error(payload?.message || "เตรียมรายงาน ILI ไม่สำเร็จ");
  return payload;
}

function statusTone(state?: IliSummary["state"]) {
  if (state === "ready") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (state === "partial") return "border-sky-200 bg-sky-50 text-sky-900";
  return "border-amber-200 bg-amber-50 text-amber-900";
}

function IliReportPage() {
  const summary = useQuery({
    queryKey: ["ili-report"],
    queryFn: fetchIliSummary,
  });
  const prepare = useMutation({
    mutationFn: prepareIliReport,
    onSuccess: () => summary.refetch(),
  });

  const data = summary.data;
  const ready = data?.state === "ready";

  return (
    <div className="page-shell">
      <header className="page-header flex flex-col gap-3">
        <Badge variant="outline" className="page-eyebrow">
          D506 Syndromic ILI
        </Badge>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="page-title">รายงาน ILI อัตโนมัติ</h1>
            <p className="page-description">
              ดึงยอดผู้ป่วยกลุ่มอาการคล้ายไข้หวัดใหญ่จาก HOSxP ด้วยรหัส ICD-10 ที่กำหนด และเตรียมยอดของเมื่อวานสำหรับกรอก D506 Syndromic ทุกวันจันทร์และอังคาร
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => summary.refetch()} disabled={summary.isFetching} className="gap-2">
              {summary.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              ตรวจยอดใหม่
            </Button>
            <Button onClick={() => prepare.mutate()} disabled={prepare.isPending || !data} className="gap-2">
              {prepare.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              เตรียมกรอก D506
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <Card className="border-teal/20 bg-teal/5">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">วันที่รายงาน</div>
            <div className="mt-1 text-2xl font-bold">{data?.reportDate || "-"}</div>
            <div className="text-xs text-muted-foreground">วัน{data?.weekday || "-"}</div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="text-xs text-amber-800">จำนวน ILI</div>
            <div className="mt-1 text-3xl font-bold text-amber-950">{data?.iliVisits ?? 0}</div>
            <div className="text-xs text-amber-800">ครั้งบริการตาม ICD-10</div>
          </CardContent>
        </Card>
        <Card className="border-sky-200 bg-sky-50">
          <CardContent className="p-4">
            <div className="text-xs text-sky-800">ผู้รับบริการทั้งหมด</div>
            <div className="mt-1 text-3xl font-bold text-sky-950">{data?.totalVisits ?? 0}</div>
            <div className="text-xs text-sky-800">นับรายวัน ไม่ตัดซ้ำ</div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4">
            <div className="text-xs text-emerald-800">สัดส่วน ILI</div>
            <div className="mt-1 text-3xl font-bold text-emerald-950">{data?.iliPercent ?? 0}%</div>
            <div className="text-xs text-emerald-800">ILI / visits</div>
          </CardContent>
        </Card>
      </section>

      <Card className={`metric-card ${statusTone(data?.state)}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {ready ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            สถานะการดึงและกรอกอัตโนมัติ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_.9fr]">
            <div className="rounded-lg border bg-white/60 p-4">
              <div className="font-semibold">{ready ? "ดึงยอดจาก HOSxP bridge ได้แล้ว" : "ยังต้องตรวจ bridge / credential เพิ่ม"}</div>
              <p className="mt-2 text-sm leading-6 opacity-85">{data?.detail || "กำลังตรวจสถานะ"}</p>
              {prepare.data?.message && <p className="mt-2 text-sm leading-6 opacity-85">{prepare.data.message}</p>}
            </div>
            <div className="rounded-lg border bg-white/60 p-4">
              <div className="flex items-center gap-2 font-semibold">
                <CalendarClock className="h-4 w-4" />
                ตารางทำงาน
              </div>
              <p className="mt-2 text-sm leading-6 opacity-85">
                ระบบเตรียมดึงยอดของเมื่อวาน ทุกวันจันทร์และอังคาร ตามเวลา Asia/Bangkok
              </p>
              <div className="mt-3 text-xs opacity-75">
                วันนี้{data?.isScheduledDay ? "เป็น" : "ไม่ใช่"}วันในรอบกรอกอัตโนมัติ
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="gap-2 bg-white/70">
              <a href="https://ddsdoe.ddc.moph.go.th/syndromic/syndromicreport/ili" target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                เปิดเว็บ D506 ILI
              </a>
            </Button>
            <Badge variant="outline" className="bg-white/60">
              source: {data?.source || "-"}
            </Badge>
            <Badge variant="outline" className="bg-white/60">
              mode: {data?.mode || "-"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[1fr_.9fr]">
        <Card className="metric-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-5 w-5 text-teal" />
              ความหมายของตัวเลขที่จะกรอก
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <div className="rounded-lg border bg-muted/20 p-3">
              <span className="font-semibold text-foreground">จำนวน ILI</span> คือจำนวนครั้งของผู้ป่วยที่มี ICD-10 อยู่ในชุดรหัส ILI ของ D506 ในวันที่รายงาน
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <span className="font-semibold text-foreground">ผู้รับบริการทั้งหมด</span> คือจำนวนครั้งบริการตรวจรักษาในวันเดียวกัน โดยไม่นับส่วนแพทย์แผนไทยและรายการที่ไม่มีการตรวจรักษา
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              เว็บ D506 ILI ต้อง login MOPH ก่อน ระบบนี้จึงเตรียม payload และคิวกรอกอัตโนมัติไว้ก่อน เมื่อมี reporter endpoint หรือ session ที่ยืนยันแล้วจึงค่อยส่งจริง
            </div>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardHeader>
            <CardTitle className="text-base">ICD-10 ที่ใช้คัดกรอง</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {ILI_ICD10_CODES.map((code) => (
                <Badge key={code} variant="secondary" className="font-mono">
                  {code}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
