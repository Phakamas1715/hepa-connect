import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Database,
  Link2,
  Loader2,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  Users,
} from "lucide-react";
import { InnovationShowcase, OfficialPageHeader } from "@/components/official-layout";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  KPI,
  HBV_CUP_SUMMARY,
  HBV_HDC_PERFORMANCE,
  TARGET_REGISTRY_SOURCE,
  buildKpiFromPatients,
  buildSubdistrictDashboard,
  allocateKits,
  getHcvTreatmentGapPatients,
  type Patient,
} from "@/lib/hepa-data";
import { HEPA_PRIMARY_CARE_UNITS } from "@/lib/hepa-service-area";
import { fetchPatients } from "@/lib/supabase";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "แดชบอร์ดผู้บริหาร — HEPA-GLUE Engine" },
      {
        name: "description",
        content:
          "KPI ปีงบ 2569, HCV care cascade และการจัดสรรชุดตรวจด้วย AI ตาม mapping รพ.สต. อำเภอน้ำพอง",
      },
    ],
  }),
  component: Dashboard,
});

function ScoreDots({ score }: { score: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`h-1.5 w-3 rounded-full ${i <= score ? "bg-destructive" : "bg-muted"}`}
        />
      ))}
    </div>
  );
}

function KpiCard({
  title,
  value,
  sub,
  pct,
  score,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: string;
  sub: string;
  pct?: number;
  score?: number;
  icon: React.ElementType;
  tone?: "default" | "warning" | "critical";
}) {
  const ring =
    tone === "critical"
      ? "ring-2 ring-destructive/40 bg-destructive/5"
      : tone === "warning"
        ? "ring-2 ring-warning/40 bg-warning/5"
        : "ring-1 ring-border";

  return (
    <Card className={`relative overflow-hidden ${ring}`}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {title}
        </CardTitle>
        <div
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
            tone === "critical"
              ? "bg-destructive/15 text-destructive"
              : tone === "warning"
                ? "bg-warning/20 text-warning-foreground"
                : "bg-teal/15 text-teal"
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <div className="text-3xl font-bold tracking-tight text-foreground">{value}</div>
          {pct !== undefined && (
            <div className="text-sm font-semibold text-muted-foreground">{pct}%</div>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
        {pct !== undefined && <Progress value={pct} className="mt-3 h-1.5" />}
        {score !== undefined && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              คะแนน
            </span>
            <ScoreDots score={score} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CascadeStage({
  label,
  value,
  total,
  tone,
  highlight,
}: {
  label: string;
  value: number | string;
  total: number;
  tone: string;
  highlight?: boolean;
}) {
  const pct = typeof value === "number" ? (value / total) * 100 : 0;
  return (
    <div
      className={`flex-1 rounded-xl border p-3 ${highlight ? "border-destructive/50 bg-destructive/5" : "border-border bg-card"}`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-foreground">{value}</div>
      <div
        className={`mt-2 h-1.5 rounded-full ${tone}`}
        style={{ width: `${Math.max(8, pct)}%` }}
      />
    </div>
  );
}

function percentForDisplay(value: number, total: number) {
  return total > 0 ? Number(((value / total) * 100).toFixed(2)) : 0;
}

type PatientRegistryPayload = {
  patients: Patient[];
  meta?: {
    source?: string;
    preparedCount?: number;
    googleSheetCount?: number;
    editedCount?: number;
    deletedCount?: number;
    lastGoogleSyncAt?: string;
    lastGoogleSyncError?: string;
  };
};

type ScreeningSummary = {
  checkedAt: string;
  totalQuota: number;
  initialBooked?: number;
  liveBookings?: number;
  booked: number;
  remaining: number;
  percentage: number;
  units: Array<{
    code: string;
    unitName: string;
    quota: number;
    booked: number;
    remaining: number;
    percentage?: number;
  }>;
  bookings: Array<{
    id: string;
    status: "reserved" | "confirmed" | "cancelled";
    rosterVerified?: boolean;
    consentAccepted?: boolean;
  }>;
};

async function fetchScreeningSummary(): Promise<ScreeningSummary> {
  const response = await fetch("/api/screening-bookings");
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || "โหลดคิวคัดกรองไม่สำเร็จ");
  return data;
}

async function openHcvTreatmentQueue() {
  const response = await fetch("/api/care-gap-queue", { method: "POST" });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || "เปิดคิวติดตามไม่สำเร็จ");
  return data;
}

function patientSourceLabel(meta?: PatientRegistryPayload["meta"]) {
  if (!meta?.source) return TARGET_REGISTRY_SOURCE.label;
  if (meta.source === "google-sheet") return "Google Sheet ทะเบียนผู้ป่วย";
  if (meta.source === "prepared-list") return "รายชื่อกลางในระบบ";
  if (meta.source === "supabase") return "Supabase";
  return meta.source;
}

function formatCheckedAt(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("th-TH", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function Dashboard() {
  const navigate = useNavigate();
  const [kitPool, setKitPool] = useState(2000);
  const [allocated, setAllocated] = useState<ReturnType<typeof allocateKits> | null>(null);
  const patientsQuery = useQuery<PatientRegistryPayload>({
    queryKey: ["dashboard-patients"],
    queryFn: fetchPatients,
  });
  const screeningQuery = useQuery({
    queryKey: ["dashboard-screening-summary"],
    queryFn: fetchScreeningSummary,
  });

  const patientRows = patientsQuery.data?.patients?.length
    ? patientsQuery.data.patients
    : undefined;
  const liveKpi = useMemo(
    () => (patientRows ? buildKpiFromPatients(patientRows) : KPI),
    [patientRows],
  );
  const c = liveKpi.hcvCascade;
  const hbv = HBV_CUP_SUMMARY;
  const primaryCareUnitCount = HEPA_PRIMARY_CARE_UNITS.length;
  const subdistricts = useMemo(() => buildSubdistrictDashboard(patientRows), [patientRows]);
  const totalRisk = useMemo(
    () => subdistricts.reduce((sum, item) => sum + item.riskDensity, 0),
    [subdistricts],
  );
  const totalTarget = useMemo(
    () => subdistricts.reduce((sum, item) => sum + item.target, 0),
    [subdistricts],
  );
  const treatmentGap = Math.max(0, c.positive - c.onTreatment);
  const treatmentGapPct = c.positive > 0 ? Math.round((treatmentGap / c.positive) * 100) : 0;
  const gapPatients = useMemo(() => getHcvTreatmentGapPatients(patientRows), [patientRows]);
  const sourceLabel = patientSourceLabel(patientsQuery.data?.meta);
  const screening = screeningQuery.data;
  const rosterVerifiedCount =
    screening?.bookings.filter((booking) => booking.rosterVerified).length || 0;
  const pdpaAcceptedCount =
    screening?.bookings.filter((booking) => booking.consentAccepted).length || 0;
  const confirmedScreeningCount =
    screening?.bookings.filter((booking) => booking.status === "confirmed").length || 0;
  const dashboardIsLive = Boolean(patientsQuery.data);

  const openQueue = useMutation({
    mutationFn: openHcvTreatmentQueue,
    onSuccess: (result) => {
      toast.success(
        `เปิดคิวติดตามแล้ว ${result.total} ราย · จัดคิวส่งได้ ${result.queued} · รอผูก LINE ${result.blocked}`,
      );
      navigate({ to: "/patients", search: { filter: "hcv_sofvel" } });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "เปิดคิวติดตามไม่สำเร็จ"),
  });

  const handleAllocate = () => {
    const result = allocateKits(kitPool, subdistricts);
    setAllocated(result);
    toast.success(
      `คำนวณจัดสรรชุดตรวจ ${kitPool.toLocaleString()} ชุดให้ ${subdistricts.length} รพ.สต. แล้ว`,
      {
        description: "คำนวณจากกลุ่มเป้าหมาย 60% และดัชนีความเสี่ยง 40%",
      },
    );
  };

  return (
    <div className="page-shell">
      <OfficialPageHeader
        eyebrow="ศูนย์บัญชาการงานไวรัสตับอักเสบ อำเภอน้ำพอง"
        title="แดชบอร์ดผู้บริหารและติดตามผลงาน"
        description={`สรุปตัวชี้วัดการคัดกรอง การรักษา และการจัดสรรทรัพยากรจาก ${sourceLabel} พร้อมสถานะคิวคัดกรอง LINE เพื่อให้ทุกโมดูลอ้างอิงข้อมูลชุดเดียวกัน`}
        badges={[
          dashboardIsLive ? "ข้อมูลปัจจุบันจากระบบ" : "กำลังใช้ข้อมูลสำรอง",
          "ติดตามผ่าน LINE",
          "มีประวัติตรวจสอบย้อนหลัง",
        ]}
      />

      <Card className="border-teal/20 bg-teal/5">
        <CardContent className="grid gap-4 p-4 lg:grid-cols-[1.05fr_.95fr]">
          <div className="flex gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal/15 text-teal">
              {patientsQuery.isFetching ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Database className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">สถานะความสอดคล้องข้อมูล</h2>
                <Badge
                  variant="outline"
                  className={
                    dashboardIsLive
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-amber-200 bg-amber-50 text-amber-900"
                  }
                >
                  {dashboardIsLive ? "ทุกหน้าจอใช้ข้อมูลชุดเดียวกัน" : "ใช้ข้อมูลสำรอง"}
                </Badge>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                หน้าแรก ทะเบียนผู้ป่วย และคิวติดตามคำนวณจากรายชื่อกลางชุดเดียวกัน
                {patientsQuery.data?.meta?.lastGoogleSyncAt
                  ? ` · อัปเดตจาก Google Sheet ล่าสุด ${formatCheckedAt(patientsQuery.data.meta.lastGoogleSyncAt)}`
                  : ""}
              </p>
              {patientsQuery.data?.meta?.lastGoogleSyncError && (
                <p className="mt-1 text-xs text-destructive">
                  อัปเดตข้อมูลจาก Google Sheet ไม่สำเร็จ:{" "}
                  {patientsQuery.data.meta.lastGoogleSyncError}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border bg-background/70 p-3">
              <div className="text-xl font-bold">
                {(patientsQuery.data?.patients.length || 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-muted-foreground">ทะเบียนผู้ป่วยปัจจุบัน</div>
              <div className="mt-1 text-[10px] text-muted-foreground">{sourceLabel}</div>
            </div>
            <div className="rounded-xl border bg-background/70 p-3">
              <div className="text-xl font-bold">
                {(screening?.totalQuota || 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-muted-foreground">โควตาคัดกรอง LINE</div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                จองแล้ว {(screening?.booked || 0).toLocaleString()} · คงเหลือ{" "}
                {(screening?.remaining || 0).toLocaleString()}
              </div>
            </div>
            <div className="rounded-xl border bg-background/70 p-3">
              <div className="text-xl font-bold">
                {(screening?.units.length || 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-muted-foreground">หน่วยบริการในระบบ</div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                ไม่รวมยอด รพ.น้ำพองโดยตรง
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <InnovationShowcase
        items={[
          {
            title: "รายชื่อเป้าหมายเชิงรุก",
            detail:
              "ใช้ทะเบียนกลางที่จัดทำเองเป็นแหล่งข้อมูลหลัก ลดความคลาดเคลื่อนจากการดึงข้อมูลหลายระบบ",
          },
          {
            title: "ติดตามผู้ป่วยผ่าน LINE",
            detail: "ผูกบัญชี LINE กับ HN และจัดคิวข้อความติดตามสำหรับผู้ป่วยที่ยังติดตามไม่ครบ",
          },
          {
            title: "รายงานและเชื่อมโยงข้อมูล",
            detail:
              "เชื่อม HOSxP, นัดหมาย และรายงานกระทรวงสาธารณสุขในขั้นตอนเดียว พร้อมตรวจสอบความพร้อม",
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="เป้าหมาย CUP HBV (HDC)"
          value={hbv.targetTotal.toLocaleString()}
          sub="ข้อมูลอ้างอิง HDC ภายนอก ไม่ใช่ยอดทะเบียนผู้ป่วย live"
          icon={Users}
        />
        <KpiCard
          title="Dashboard สปสช."
          value={hbv.dashboardNhsoScreened.toLocaleString()}
          sub={`ผลงานเทียบเป้าหมาย ${hbv.dashboardPct}%`}
          pct={hbv.dashboardPct}
          icon={Target}
          tone="warning"
        />
        <KpiCard
          title="HDC รวม HBV"
          value={hbv.hdcReportedTotal.toLocaleString()}
          sub={`HDC รายงานรวม · ${hbv.hdcReportedPct}% ของเป้าหมาย`}
          icon={Activity}
          tone="warning"
        />
        <KpiCard
          title="รพ.สต. บันทึก HDC"
          value={hbv.primaryCareHdc.toLocaleString()}
          sub={`${hbv.primaryCareWithHdc} รพ.สต. มีผลงานจาก HDC · ต้องตรวจการส่งข้อมูล`}
          icon={ShieldAlert}
          tone="critical"
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Link2 className="h-5 w-5 text-teal" />
                ภาพรวมความสัมพันธ์ของโมดูล
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                แสดงให้เห็นว่าแต่ละส่วนใช้ข้อมูลชุดใด และแยกรายชื่อผู้ป่วยออกจากผู้จองคัดกรอง
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => Promise.all([patientsQuery.refetch(), screeningQuery.refetch()])}
            >
              รีเฟรชข้อมูล
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border bg-card p-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Database className="h-4 w-4 text-teal" />
              ทะเบียนผู้ป่วย
            </div>
            <div className="mt-2 text-2xl font-bold">
              {liveKpi.targetPopulation.toLocaleString()}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              ใช้คำนวณตัวชี้วัด ลำดับการดูแล ตารางหน่วยบริการ และคิวติดตาม
            </p>
          </div>
          <div className="rounded-xl border bg-card p-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ClipboardList className="h-4 w-4 text-teal" />
              คิวจองคัดกรอง
            </div>
            <div className="mt-2 text-2xl font-bold">
              {(screening?.booked || 0).toLocaleString()}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              จองจาก LINE แล้ว {screening?.liveBookings || 0} ราย · ยืนยันหน้างาน{" "}
              {confirmedScreeningCount} ราย
            </p>
          </div>
          <div className="rounded-xl border bg-card p-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="h-4 w-4 text-teal" />
              รายชื่อและความยินยอม
            </div>
            <div className="mt-2 text-2xl font-bold">{rosterVerifiedCount.toLocaleString()}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              ตรงกับรายชื่อกลาง · บันทึกความยินยอมครบ {pdpaAcceptedCount.toLocaleString()} ราย
            </p>
          </div>
          <div className="rounded-xl border bg-card p-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Activity className="h-4 w-4 text-teal" />
              การติดตามและรายงาน
            </div>
            <div className="mt-2 text-2xl font-bold">{treatmentGap.toLocaleString()}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              รายการค้างติดตามจากทะเบียนปัจจุบัน พร้อมเปิดคิวข้อความ LINE จากข้อมูลชุดเดียวกัน
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-300 bg-amber-50/80">
        <CardHeader>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base text-amber-950">
                <AlertTriangle className="h-5 w-5 text-amber-700" />
                ตรวจสอบความสอดคล้องของข้อมูล HBV และ HDC
              </CardTitle>
              <p className="mt-1 text-xs leading-5 text-amber-900/80">
                ผลงาน HDC กระจุกอยู่ที่โรงพยาบาลน้ำพอง ขณะที่ รพ.สต. ส่วนใหญ่ยังเป็น 0 จึงควรตรวจ
                mapping หน่วยบริการและการส่งข้อมูลก่อนสรุปรายงานระดับอำเภอ
              </p>
            </div>
            <Badge variant="outline" className="w-fit bg-white/70 text-amber-900">
              ผลรวมแถว HDC {hbv.hdcRowTotal.toLocaleString()} · ต่างจากสรุป {hbv.hdcTotalVariance}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-amber-200 bg-white/70 p-3">
              <div className="text-2xl font-bold text-amber-950">
                {hbv.hospitalHdc.toLocaleString()}
              </div>
              <div className="text-xs text-amber-900/75">ผลงาน HDC ที่โรงพยาบาลน้ำพอง</div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-white/70 p-3">
              <div className="text-2xl font-bold text-amber-950">
                {hbv.primaryCareHdc.toLocaleString()}
              </div>
              <div className="text-xs text-amber-900/75">ผลงาน HDC รวม รพ.สต.</div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-white/70 p-3">
              <div className="text-2xl font-bold text-amber-950">{hbv.primaryCareWithHdc}</div>
              <div className="text-xs text-amber-900/75">รพ.สต. ที่มีผลงานมากกว่า 0</div>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-amber-200 bg-white">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-amber-100/70 text-left text-[11px] uppercase tracking-wider text-amber-950/70">
                <tr>
                  <th className="px-3 py-2">หน่วยบริการ</th>
                  <th className="px-3 py-2 text-right">เป้าหมาย</th>
                  <th className="px-3 py-2 text-right">ผลงาน HDC</th>
                  <th className="px-3 py-2">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {HBV_HDC_PERFORMANCE.map((unit) => {
                  const pct = percentForDisplay(unit.hdcScreened, unit.target);
                  const status =
                    unit.unitType === "hospital"
                      ? "รวมที่โรงพยาบาล"
                      : unit.hdcScreened > 0
                        ? "มีข้อมูลเข้า HDC"
                        : "ยังเป็น 0";
                  return (
                    <tr key={unit.id} className="border-t hover:bg-amber-50/50">
                      <td className="px-3 py-2 font-medium text-foreground">{unit.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {unit.target.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">
                        {unit.hdcScreened.toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Progress value={Math.min(100, pct)} className="h-1.5 flex-1" />
                          <Badge
                            variant="outline"
                            className={
                              unit.hdcScreened === 0
                                ? "border-slate-200 bg-slate-50 text-slate-700"
                                : unit.unitType === "hospital"
                                  ? "border-amber-300 bg-amber-50 text-amber-900"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
                            }
                          >
                            {status}
                          </Badge>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/40 bg-gradient-to-r from-destructive/10 to-warning/10">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-destructive text-destructive-foreground shadow-lg">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold uppercase tracking-wider text-destructive">
                ประเด็นเร่งด่วน
              </span>
              <Badge variant="destructive" className="text-[10px]">
                สัญญาณเหลือง/แดง
              </Badge>
            </div>
            <h3 className="mt-1 text-base font-bold text-foreground sm:text-lg">
              ผู้ป่วย HCV ผลบวก {treatmentGap.toLocaleString()} รายยังไม่เข้าสู่การรักษาด้วย Sofvel
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              การปิดช่องว่างนี้เป็นงานที่มีผลสูงสุดต่อเป้าหมายปีงบ 2569 ให้ใช้คิวติดตาม
              จากทะเบียนผู้ป่วยค้างติดตาม ซึ่งอ่านจากรายชื่อกลางเดียวกับแดชบอร์ด
            </p>
          </div>
          <Button
            size="lg"
            disabled={treatmentGap === 0 || openQueue.isPending}
            onClick={() => openQueue.mutate()}
            className="shrink-0 bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {openQueue.isPending ? "กำลังเปิดคิว..." : "เปิดคิวติดตาม"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          {gapPatients.length > 0 && (
            <p className="w-full text-xs text-muted-foreground sm:w-auto">
              รายการ: {gapPatients.map((patient) => patient.hn).join(", ")}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">HCV Care Cascade</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                ลำดับการดูแลตั้งแต่คัดกรองจนถึงหายขาดทางไวรัส (SVR12)
              </p>
            </div>
            <Badge variant="outline" className="border-teal text-teal">
              ปีงบ 2569
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <CascadeStage
              label="คัดกรองแล้ว"
              value={c.screened}
              total={c.screened}
              tone="bg-teal"
            />
            <CascadeStage
              label="HCV Ab บวก"
              value={c.positive}
              total={c.screened}
              tone="bg-primary"
            />
            <CascadeStage
              label="ยืนยัน Viral Load"
              value={c.confirmed}
              total={c.screened}
              tone="bg-accent"
            />
            <CascadeStage
              label="รับยา Sofvel"
              value={c.onTreatment}
              total={c.screened}
              tone="bg-warning"
              highlight
            />
            <CascadeStage
              label="หายขาด (SVR12)"
              value={c.cured}
              total={c.screened}
              tone="bg-success"
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <TrendingDown className="h-4 w-4 text-destructive" />
            <span>
              <strong className="text-destructive">หลุดจากระบบ {treatmentGapPct}%</strong>{" "}
              ระหว่างผลบวก ({c.positive}) กับเริ่มรักษา ({c.onTreatment}) · เป็นจุดรั่วหลักของระบบ
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-base">
                {primaryCareUnitCount} หน่วยบริการปฐมภูมิ/เขตรับผิดชอบ
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {TARGET_REGISTRY_SOURCE.description}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-0">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  จำนวนชุดตรวจ
                </label>
                <Input
                  type="number"
                  value={kitPool}
                  onChange={(event) => setKitPool(Number(event.target.value) || 0)}
                  className="h-9 w-32"
                />
              </div>
              <Button onClick={handleAllocate} className="gap-2 gradient-medical text-white">
                <Sparkles className="h-4 w-4" /> คำนวณการจัดสรร
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2">รพ.สต.</th>
                  <th className="px-3 py-2 text-right">เป้าหมาย</th>
                  <th className="px-3 py-2 text-right">ดัชนีเสี่ยง</th>
                  <th className="px-3 py-2">ความคืบหน้าคัดกรอง</th>
                  <th className="px-3 py-2 text-right">ชุดตรวจที่จัดสรร</th>
                </tr>
              </thead>
              <tbody>
                {subdistricts.map((subdistrict, index) => {
                  const allocation = allocated?.[index];
                  const screenedPct =
                    subdistrict.target > 0
                      ? Math.round((subdistrict.screened / subdistrict.target) * 100)
                      : 0;
                  return (
                    <tr key={subdistrict.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium text-foreground">{subdistrict.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {subdistrict.target}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {subdistrict.riskDensity.toFixed(2)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Progress value={screenedPct} className="h-1.5 flex-1" />
                          <span className="w-8 text-right text-[10px] text-muted-foreground">
                            {screenedPct}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {allocation ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-teal/15 px-2 py-0.5 font-bold tabular-nums text-teal">
                            <CheckCircle2 className="h-3 w-3" />
                            {allocation.allocation}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {allocated && (
                <tfoot>
                  <tr className="border-t bg-muted/30 text-xs font-semibold">
                    <td className="px-3 py-2">รวม {subdistricts.length} หน่วยในตารางจัดสรร</td>
                    <td className="px-3 py-2 text-right tabular-nums">{totalTarget}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{totalRisk.toFixed(2)}</td>
                    <td />
                    <td className="px-3 py-2 text-right tabular-nums text-teal">
                      {allocated.reduce((sum, item) => sum + item.allocation, 0).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            สูตร:{" "}
            <code className="rounded bg-muted px-1 py-0.5">
              จัดสรร = ชุดตรวจทั้งหมด × (0.6 × เป้าหมาย/ผลรวมเป้าหมาย + 0.4 ×
              ความเสี่ยง/ผลรวมความเสี่ยง)
            </code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
