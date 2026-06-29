import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { KPI, SUBDISTRICTS, allocateKits } from "@/lib/hepa-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "แดชบอร์ดผู้บริหาร — HEPA-GLUE Engine" },
      {
        name: "description",
        content: "KPI ปีงบ 2569, HCV care cascade และการจัดสรรชุดตรวจด้วย AI สำหรับ 18 รพ.สต. อำเภอน้ำพอง",
      },
    ],
  }),
  component: Dashboard,
});

function ScoreDots({ score }: { score: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`h-1.5 w-3 rounded-full ${i <= score ? "bg-destructive" : "bg-muted"}`} />
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
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</CardTitle>
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
          {pct !== undefined && <div className="text-sm font-semibold text-muted-foreground">{pct}%</div>}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
        {pct !== undefined && <Progress value={pct} className="mt-3 h-1.5" />}
        {score !== undefined && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">คะแนน</span>
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
    <div className={`flex-1 rounded-xl border p-3 ${highlight ? "border-destructive/50 bg-destructive/5" : "border-border bg-card"}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold text-foreground">{value}</div>
      <div className={`mt-2 h-1.5 rounded-full ${tone}`} style={{ width: `${Math.max(8, pct)}%` }} />
    </div>
  );
}

function Dashboard() {
  const [kitPool, setKitPool] = useState(2000);
  const [allocated, setAllocated] = useState<ReturnType<typeof allocateKits> | null>(null);

  const c = KPI.hcvCascade;
  const totalRisk = useMemo(() => SUBDISTRICTS.reduce((sum, item) => sum + item.riskDensity, 0), []);
  const totalTarget = useMemo(() => SUBDISTRICTS.reduce((sum, item) => sum + item.target, 0), []);

  const handleAllocate = () => {
    const result = allocateKits(kitPool, SUBDISTRICTS);
    setAllocated(result);
    toast.success(`AI จัดสรรชุดตรวจ ${kitPool.toLocaleString()} ชุดให้ 18 รพ.สต. แล้ว`, {
      description: "คำนวณจากกลุ่มเป้าหมาย 60% และดัชนีความเสี่ยง 40%",
    });
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">แดชบอร์ดผู้บริหาร</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ผลการดำเนินงานกำจัดไวรัสตับอักเสบ B/C อำเภอน้ำพอง ปีงบประมาณ 2569 · กลุ่มเป้าหมายเกิดก่อนปี 2535
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="ประชากรเป้าหมาย" value="6,556" sub="เกิดก่อนปี 2535 ครอบคลุมทั้งอำเภอ" icon={Users} />
        <KpiCard
          title="คัดกรอง HBV"
          value={KPI.hbv.screened.toLocaleString()}
          sub={`ผลงานเทียบเป้าหมาย (${KPI.targetPopulation.toLocaleString()})`}
          pct={KPI.hbv.pct}
          score={KPI.hbv.score}
          icon={Target}
          tone="warning"
        />
        <KpiCard
          title="คัดกรอง HCV"
          value={KPI.hcv.screened.toLocaleString()}
          sub="ผลงานเทียบเป้าหมาย · จำกัดด้วยจำนวนชุดตรวจ"
          pct={KPI.hcv.pct}
          score={KPI.hcv.score}
          icon={Activity}
          tone="warning"
        />
        <KpiCard
          title="HCV เข้าสู่การรักษา"
          value="46.53%"
          sub="รักษาแล้ว 47 จากผลบวก 101 ราย · เร่งด่วน"
          icon={ShieldAlert}
          tone="critical"
        />
      </div>

      <Card className="border-destructive/40 bg-gradient-to-r from-destructive/10 to-warning/10">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-destructive text-destructive-foreground shadow-lg">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold uppercase tracking-wider text-destructive">ประเด็นเร่งด่วน</span>
              <Badge variant="destructive" className="text-[10px]">สัญญาณเหลือง/แดง</Badge>
            </div>
            <h3 className="mt-1 text-base font-bold text-foreground sm:text-lg">
              ผู้ป่วย HCV ผลบวก 54 รายยังไม่เข้าสู่การรักษาด้วย Sofvel
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              การปิดช่องว่างนี้เป็นงานที่มีผลสูงสุดต่อเป้าหมายปีงบ 2569 ให้ใช้ AI nudge จากโมดูลทะเบียน Care Gap เพื่อติดตามผู้ป่วย
            </p>
          </div>
          <Button size="lg" className="shrink-0 bg-destructive text-destructive-foreground hover:bg-destructive/90">
            เปิดคิวติดตาม <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">HCV Care Cascade</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">ลำดับการดูแลตั้งแต่คัดกรองจนถึงหายขาดทางไวรัส (SVR12)</p>
            </div>
            <Badge variant="outline" className="border-teal text-teal">ปีงบ 2569</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <CascadeStage label="คัดกรองแล้ว" value={c.screened} total={c.screened} tone="bg-teal" />
            <CascadeStage label="HCV Ab บวก" value={c.positive} total={c.screened} tone="bg-primary" />
            <CascadeStage label="ยืนยัน Viral Load" value={c.confirmed} total={c.screened} tone="bg-accent" />
            <CascadeStage label="รับยา Sofvel" value={c.onTreatment} total={c.screened} tone="bg-warning" highlight />
            <CascadeStage label="หายขาด (SVR12)" value={c.cured} total={c.screened} tone="bg-success" />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <TrendingDown className="h-4 w-4 text-destructive" />
            <span>
              <strong className="text-destructive">หลุดจากระบบ 53%</strong> ระหว่างผลบวก (101) กับเริ่มรักษา (47) · เป็นจุดรั่วหลักของระบบ
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-base">18 หน่วยบริการปฐมภูมิ (รพ.สต.)</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">ทุกหน่วยยังอยู่ที่ 0% screening · รอจัดสรรชุดตรวจ rapid test</p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-0">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">จำนวนชุดตรวจ</label>
                <Input type="number" value={kitPool} onChange={(event) => setKitPool(Number(event.target.value) || 0)} className="h-9 w-32" />
              </div>
              <Button onClick={handleAllocate} className="gap-2 gradient-medical text-white">
                <Sparkles className="h-4 w-4" /> ให้ AI แนะนำการจัดสรร
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
                {SUBDISTRICTS.map((subdistrict, index) => {
                  const allocation = allocated?.[index];
                  return (
                    <tr key={subdistrict.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium text-foreground">{subdistrict.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{subdistrict.target}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{subdistrict.riskDensity.toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Progress value={0} className="h-1.5 flex-1" />
                          <span className="w-8 text-right text-[10px] text-muted-foreground">0%</span>
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
                    <td className="px-3 py-2">รวม 18 หน่วย</td>
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
            สูตร: <code className="rounded bg-muted px-1 py-0.5">จัดสรร = ชุดตรวจทั้งหมด × (0.6 × เป้าหมาย/ผลรวมเป้าหมาย + 0.4 × ความเสี่ยง/ผลรวมความเสี่ยง)</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
