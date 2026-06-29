import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Cable,
  CheckCircle2,
  Database,
  FileCheck2,
  Loader2,
  MessageCircle,
  PlayCircle,
  RefreshCcw,
  Server,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/integration")({
  head: () => ({
    meta: [
      { title: "การเชื่อมต่ออัตโนมัติ — HEPA-GLUE Engine" },
      {
        name: "description",
        content: "สถานะการเชื่อมต่อ HEPA-GLUE กับ HOSxP, Smart Query, LINE และ MOPH",
      },
    ],
  }),
  component: IntegrationPage,
});

type CheckState = "ready" | "partial" | "blocked" | "not_configured";
type ConnectionCheck = {
  id: string;
  name: string;
  state: CheckState;
  detail: string;
};

type StatusResponse = {
  checkedAt: string;
  checks: ConnectionCheck[];
};

type ProductionGate = {
  id: string;
  name: string;
  state: "ready" | "partial" | "blocked";
  detail: string;
  required: boolean;
};

type ProductionResponse = {
  checkedAt: string;
  readiness: number;
  canRunProduction: boolean;
  mode: "production" | "production-no-it" | "guarded";
  gates: ProductionGate[];
  nextAction: string;
  status?: string;
  message?: string;
};

const stateMap: Record<CheckState, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  ready: {
    label: "พร้อมใช้",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: CheckCircle2,
  },
  partial: {
    label: "เชื่อมได้บางส่วน",
    className: "border-sky-200 bg-sky-50 text-sky-800",
    icon: Cable,
  },
  blocked: {
    label: "ติดสิทธิ์/เครือข่าย",
    className: "border-amber-200 bg-amber-50 text-amber-900",
    icon: AlertTriangle,
  },
  not_configured: {
    label: "ยังไม่ได้ตั้งค่า",
    className: "border-slate-200 bg-slate-50 text-slate-700",
    icon: AlertTriangle,
  },
};

const targetFlow = [
  { title: "1. รับข้อมูลคัดกรอง", detail: "JHCIS / LINE quick action ส่ง rapid result เข้า HEPA-GLUE", icon: MessageCircle },
  { title: "2. รับผลยืนยัน", detail: "HOSxP หรือ lab API ส่ง HBsAg, Anti-HCV, HCV RNA", icon: Database },
  { title: "3. วิเคราะห์ care gap", detail: "AI ตรวจเคสผลบวก ค้างนัด และเลือก persona", icon: PlayCircle },
  { title: "4. ติดตามอัตโนมัติ", detail: "LINE Bot แจ้ง อสม. และผู้ป่วยตามสถานะจริง", icon: MessageCircle },
  { title: "5. รายงาน MOPH", detail: "ส่งข้อมูลเข้า Hep-BC-DDC, D506 และ DOE เมื่อ credential พร้อม", icon: FileCheck2 },
];

const nextSteps = [
  "เปิด endpoint หรือ dataset สำหรับ lab_order ที่มี HBsAg / Anti-HCV / HCV RNA บน server 172.16.213.55",
  "วาง HEPA-GLUE Agent บน server ฝั่งเดียวกับ MariaDB หรือ whitelist host เครื่องนี้ใน MariaDB",
  "ตั้งค่า LINE channel token และ MOPH credential แบบ production ใน env ของ server",
  "เปลี่ยนปุ่ม Sync จาก simulation เป็น POST ไปยัง agent/reporter จริงหลัง credential พร้อม",
];

async function fetchConnectionStatus(): Promise<StatusResponse> {
  const response = await fetch("/api/connection-status");
  if (!response.ok) throw new Error("ตรวจสอบสถานะไม่สำเร็จ");
  return response.json();
}

async function fetchProductionStatus(): Promise<ProductionResponse> {
  const response = await fetch("/api/production-automation");
  if (!response.ok) throw new Error("ตรวจ production automation ไม่สำเร็จ");
  return response.json();
}

async function armProductionAutomation(): Promise<ProductionResponse> {
  const response = await fetch("/api/production-automation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.message || "ยังเปิด production automation ไม่ได้");
  return payload;
}

function IntegrationPage() {
  const { data, isFetching, refetch, error } = useQuery({
    queryKey: ["connection-status"],
    queryFn: fetchConnectionStatus,
  });
  const production = useQuery({
    queryKey: ["production-automation"],
    queryFn: fetchProductionStatus,
  });
  const armProduction = useMutation({
    mutationFn: armProductionAutomation,
    onSuccess: () => production.refetch(),
  });

  const checks = data?.checks || [];
  const readyCount = checks.filter((item) => item.state === "ready").length;
  const partialCount = checks.filter((item) => item.state === "partial").length;
  const blockedCount = checks.filter((item) => item.state === "blocked" || item.state === "not_configured").length;
  const canRunFullyAutomatic = blockedCount === 0;
  const productionReady = production.data?.canRunProduction === true;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 border-b pb-5">
        <Badge variant="outline" className="w-fit border-teal/30 bg-teal/5 text-teal">
          Automatic Integration Control
        </Badge>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              การเชื่อมต่อระบบอัตโนมัติ
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              หน้านี้แสดงสถานะจริงของการเชื่อม HEPA-GLUE กับ server โรงพยาบาล, HOSxP, LINE และ MOPH
              เพื่อแยกให้ชัดว่าอะไรทำงานแล้ว และอะไรยังต้องตั้งค่าเพิ่มก่อนใช้งาน production
            </p>
          </div>
          <Button onClick={() => refetch()} disabled={isFetching} className="w-fit gap-2">
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            ตรวจสอบอีกครั้ง
          </Button>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-emerald-800">{readyCount}</div>
            <div className="text-xs text-emerald-700">พร้อมใช้</div>
          </CardContent>
        </Card>
        <Card className="border-sky-200 bg-sky-50">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-sky-800">{partialCount}</div>
            <div className="text-xs text-sky-700">เชื่อมได้บางส่วน</div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-amber-900">{blockedCount}</div>
            <div className="text-xs text-amber-800">ยังต้องแก้ก่อนอัตโนมัติเต็มระบบ</div>
          </CardContent>
        </Card>
        <Card className={productionReady || canRunFullyAutomatic ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}>
          <CardContent className="p-4">
            <div className="text-sm font-bold text-foreground">
              {productionReady ? "Production no-IT Ready" : canRunFullyAutomatic ? "Automatic Ready" : "ยังไม่พร้อม 100%"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {data?.checkedAt ? new Date(data.checkedAt).toLocaleString("th-TH") : "รอตรวจสอบ"}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className={production.data?.canRunProduction ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PlayCircle className="h-5 w-5 text-teal" />
            Production Automation Gate
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-3xl font-bold text-foreground">{production.data?.readiness ?? 0}%</div>
              <div className="text-sm text-muted-foreground">
                {production.data?.canRunProduction ? "พร้อมเปิด production automation" : production.data?.nextAction || "กำลังตรวจ gate"}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => production.refetch()} disabled={production.isFetching} className="gap-2 bg-white/70">
                {production.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                ตรวจ gate
              </Button>
              <Button onClick={() => armProduction.mutate()} disabled={armProduction.isPending || !production.data?.canRunProduction} className="gap-2">
                {armProduction.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                เปิด production
              </Button>
            </div>
          </div>
          {armProduction.error && (
            <div className="rounded-lg border border-amber-300 bg-white/70 p-3 text-sm text-amber-900">
              {armProduction.error instanceof Error ? armProduction.error.message : "ยังเปิด production automation ไม่ได้"}
            </div>
          )}
          <div className="grid gap-2 md:grid-cols-2">
            {(production.data?.gates || []).map((gate) => {
              const state = gate.state === "ready" ? stateMap.ready : gate.state === "partial" ? stateMap.partial : stateMap.blocked;
              const Icon = state.icon;
              return (
                <div key={gate.id} className={`rounded-lg border p-3 ${state.className}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 gap-2">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <div className="font-semibold">{gate.name}</div>
                        <div className="mt-1 text-xs leading-5 opacity-80">{gate.detail}</div>
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0 bg-white/60">
                      {gate.required ? "required" : "audit"}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="h-5 w-5 text-teal" />
              สถานะการเชื่อมต่อจริง
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                ตรวจสอบสถานะไม่สำเร็จ กรุณาลองใหม่
              </div>
            )}
            {checks.map((item) => {
              const state = stateMap[item.state];
              const Icon = state.icon;
              return (
                <div key={item.id} className={`rounded-lg border p-3 ${state.className}`}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-2">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-semibold">{item.name}</div>
                        <p className="mt-1 text-xs leading-5 opacity-80">{item.detail}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="w-fit shrink-0 bg-white/60">
                      {state.label}
                    </Badge>
                  </div>
                </div>
              );
            })}
            {!checks.length && !error && (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                กำลังตรวจสอบการเชื่อมต่อ
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-teal" />
              คำตอบสั้น ๆ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {productionReady ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                <div className="font-semibold">ตอนนี้เปิด production แบบไม่ง้อ IT ได้แล้ว</div>
                <p className="mt-2 text-sm leading-6">
                  ระบบใช้ KUMHOS เป็น proxy ฝั่ง server เพื่อดึง HOSxP แบบ HN/date pull, ส่ง LINE closed loop ได้จริง และเก็บ audit log ทุกครั้ง ส่วน MOPH เป็นรายงานเสริมที่ยังตรวจสอบก่อนส่งภายหลังได้
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
                <div className="font-semibold">ตอนนี้ยังอัตโนมัติครบลูปไม่ได้</div>
                <p className="mt-2 text-sm leading-6">
                  ระบบ local และ Smart Query ต่อได้แล้วบางส่วน แต่ยังมี gate สำคัญที่ต้องแก้ก่อนส่งรายงานจริงแบบอัตโนมัติ
                </p>
              </div>
            )}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              <div className="font-semibold">แนวทางให้ใช้งานจริง</div>
              <p className="mt-2 text-sm leading-6">
                วาง Agent บน server 172.16.213.55 หรือเพิ่ม API lab hepatitis บน server นั้น แล้วให้ HEPA-Connect
                เรียกผ่าน HTTPS แทนการต่อ MariaDB ตรงจากเครื่องนี้
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PlayCircle className="h-5 w-5 text-teal" />
            เป้าหมาย workflow อัตโนมัติเมื่อเชื่อมครบ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 lg:grid-cols-5">
            {targetFlow.map((step, index) => (
              <div key={step.title} className="rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <step.icon className="h-5 w-5 text-teal" />
                  {index < targetFlow.length - 1 && <ArrowRight className="hidden h-4 w-4 text-muted-foreground lg:block" />}
                </div>
                <div className="mt-3 text-sm font-semibold text-foreground">{step.title}</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.detail}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">งานที่ต้องทำเพื่อเปิด production automation</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2">
          {nextSteps.map((step) => (
            <div key={step} className="flex items-start gap-2 rounded-lg border bg-muted/20 p-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
              <span>{step}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
