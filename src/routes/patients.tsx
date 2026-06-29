import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  Loader2,
  MapPin,
  QrCode,
  Search,
  Send,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { hasCareGap, type Patient } from "@/lib/hepa-data";
import { calculateHepaRaaia, type HepaRaaiaScore } from "@/lib/hepa-raaia";
import { HEPA_SERVICE_AREAS, resolveHepaServiceArea } from "@/lib/hepa-service-area";
import { fetchPatients } from "@/lib/supabase";

export const Route = createFileRoute("/patients")({
  head: () => ({
    meta: [
      { title: "ทะเบียน Care Gap — HEPA-GLUE Engine" },
      {
        name: "description",
        content: "ทะเบียนผู้ป่วยไวรัสตับอักเสบ B/C พร้อม HEPA-RAAIA scoring และ QR ผูก LINE",
      },
    ],
  }),
  component: PatientsPage,
});

const bandColor: Record<HepaRaaiaScore["band"], string> = {
  critical: "border-destructive/40 bg-destructive/15 text-destructive",
  high: "border-warning/50 bg-warning/20 text-warning-foreground",
  watch: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  low: "border-success/30 bg-success/10 text-success",
};

const actionLabel: Record<HepaRaaiaScore["nextAction"], string> = {
  create_line_qr: "สร้าง QR ผูก LINE",
  send_line_nudge: "ส่ง LINE nudge",
  staff_call: "โทรตามโดยเจ้าหน้าที่",
  vhv_followup: "ส่งต่อ อสม.",
  routine_followup: "ติดตามตามรอบ",
};

function ResultBadge({ value }: { value?: string }) {
  if (value === "Positive" || value === "Detected")
    return <Badge variant="destructive">ผลบวก</Badge>;
  if (value === "Negative" || value === "Not Detected")
    return <Badge variant="outline">ผลลบ</Badge>;
  if (!value) return <span className="text-xs text-muted-foreground">-</span>;
  return (
    <Badge className="border-warning/50 bg-warning/20 text-warning-foreground" variant="outline">
      {value}
    </Badge>
  );
}

async function postAgent(action: string, payload: Record<string, unknown>) {
  const response = await fetch("/api/agent-orchestrator", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || "agent action failed");
  return data;
}

function PatientsPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "gap" | "high" | "need_qr">("all");
  const [latestLink, setLatestLink] = useState("");
  const {
    data: patients,
    isLoading,
    error,
    refetch,
  } = useQuery({ queryKey: ["patients"], queryFn: fetchPatients });

  const createInvite = useMutation({
    mutationFn: (patient: Patient) =>
      postAgent("create_invite", { hn: patient.hn, patientName: patient.name }),
    onSuccess: (result) => {
      setLatestLink(result.link);
      toast.success("สร้าง QR ผูก LINE แล้ว");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "สร้าง QR ไม่สำเร็จ"),
  });

  const queueNudge = useMutation({
    mutationFn: (patient: Patient) =>
      postAgent("queue_nudge", { hn: patient.hn, persona: patient.persona }),
    onSuccess: (result) =>
      toast.success(
        result.task?.status === "blocked"
          ? "ยังไม่มี LINE identity ให้สร้าง QR ก่อน"
          : "จัดคิว LINE แล้ว",
      ),
    onError: (err) => toast.error(err instanceof Error ? err.message : "จัดคิวไม่สำเร็จ"),
  });

  const scored = useMemo(() => {
    return (patients || []).map((patient) => ({ patient, raaia: calculateHepaRaaia(patient) }));
  }, [patients]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scored.filter(({ patient, raaia }) => {
      const serviceArea = resolveHepaServiceArea(patient);
      const matchesText =
        !q ||
        patient.hn.toLowerCase().includes(q) ||
        patient.name.toLowerCase().includes(q) ||
        patient.cid.toLowerCase().includes(q) ||
        patient.village.toLowerCase().includes(q) ||
        patient.subdistrict.toLowerCase().includes(q) ||
        (serviceArea?.code ?? "").toLowerCase().includes(q) ||
        (serviceArea?.unitName ?? "").toLowerCase().includes(q);
      const matchesFilter =
        filter === "all" ||
        (filter === "gap" && hasCareGap(patient)) ||
        (filter === "high" && (raaia.band === "critical" || raaia.band === "high")) ||
        (filter === "need_qr" && raaia.nextAction === "create_line_qr");
      return matchesText && matchesFilter;
    });
  }, [filter, query, scored]);

  const stats = useMemo(
    () => ({
      total: scored.length,
      gaps: scored.filter(({ patient }) => hasCareGap(patient)).length,
      high: scored.filter(({ raaia }) => raaia.band === "critical" || raaia.band === "high").length,
      needQr: scored.filter(({ raaia }) => raaia.nextAction === "create_line_qr").length,
      mapped: scored.filter(({ patient }) => resolveHepaServiceArea(patient)).length,
      areas: HEPA_SERVICE_AREAS.length,
    }),
    [scored],
  );

  if (isLoading)
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        กำลังโหลดทะเบียนผู้ป่วย...
      </div>
    );
  if (error)
    return (
      <div className="p-8 text-center text-sm text-destructive">
        โหลดทะเบียนไม่สำเร็จ: {error.message}
      </div>
    );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-3 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge variant="outline" className="w-fit border-teal/30 bg-teal/5 text-teal">
            HEPA-RAAIA
          </Badge>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            ทะเบียน Care Gap และลดการพิมพ์
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            ใช้สูตร RAAIA ที่แปลงเป็นงานไวรัสตับอักเสบ เพื่อจัดลำดับผู้ป่วย เลือก action ถัดไป
            และสร้าง QR ผูก LINE จากรายชื่อเดิมโดยไม่ต้องพิมพ์ HN ซ้ำ
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} className="w-fit gap-2">
          <CheckCircle2 className="h-4 w-4" />
          รีเฟรช
        </Button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {[
          { label: "รายชื่อทั้งหมด", value: stats.total },
          { label: "Care Gap", value: stats.gaps },
          { label: "เสี่ยงสูง", value: stats.high },
          { label: "ควรสร้าง QR", value: stats.needQr },
          { label: "Mapped Area", value: stats.mapped },
          { label: "เขตรับผิดชอบ", value: stats.areas },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{item.value}</div>
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                </div>
                {item.label === "Mapped Area" ? (
                  <MapPin className="h-5 w-5 text-teal" />
                ) : item.label === "เขตรับผิดชอบ" ? (
                  <Building2 className="h-5 w-5 text-teal" />
                ) : (
                  <Users className="h-5 w-5 text-teal" />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {latestLink && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="flex flex-col gap-3 p-4 text-emerald-900 sm:flex-row sm:items-center">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(latestLink)}`}
              alt="QR ผูก LINE"
              className="h-32 w-32 rounded-lg border bg-white p-2"
            />
            <div className="min-w-0">
              <div className="font-semibold">QR พร้อมให้ผู้ป่วยสแกน</div>
              <p className="mt-1 text-sm leading-6">
                ผู้ป่วยสแกนแล้วกดยืนยัน ระบบรู้ HN จาก token และดึง LINE userId ผ่าน LIFF
                เมื่อขึ้นใช้งานจริง
              </p>
              <div className="mt-2 break-all text-xs">{latestLink}</div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="text-base">รายชื่อผู้ป่วย</CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="ค้นหา HN / ชื่อ / CID"
                  className="pl-9 sm:w-64"
                />
              </div>
              <Select value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
                <SelectTrigger className="sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="gap">Care Gap</SelectItem>
                  <SelectItem value="high">เสี่ยงสูง</SelectItem>
                  <SelectItem value="need_qr">ควรสร้าง QR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[1340px] text-sm">
              <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">HN</th>
                  <th className="px-3 py-2">ผู้ป่วย</th>
                  <th className="px-3 py-2">พื้นที่</th>
                  <th className="px-3 py-2">หน่วยรับผิดชอบ</th>
                  <th className="px-3 py-2">HBsAg</th>
                  <th className="px-3 py-2">HCV Ab</th>
                  <th className="px-3 py-2">HCV RNA</th>
                  <th className="px-3 py-2">Persona</th>
                  <th className="px-3 py-2">HEPA-RAAIA</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2 text-right">ทำงาน</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ patient, raaia }) => {
                  const serviceArea = resolveHepaServiceArea(patient);
                  return (
                    <tr key={patient.hn} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                        {patient.hn}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-foreground">{patient.name}</div>
                        <div className="text-[10px] text-muted-foreground">CID {patient.cid}</div>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {patient.village} / {patient.subdistrict}
                      </td>
                      <td className="px-3 py-2">
                        {serviceArea ? (
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-1">
                              <Badge variant="outline" className="font-mono">
                                {serviceArea.code}
                              </Badge>
                              {serviceArea.unitType === "hospital" && (
                                <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">
                                  รพ.
                                </Badge>
                              )}
                            </div>
                            <div className="max-w-56 text-xs leading-5 text-muted-foreground">
                              {serviceArea.unitName}
                            </div>
                            {serviceArea.coverageNote && (
                              <div className="text-[10px] text-muted-foreground">
                                {serviceArea.coverageNote}
                              </div>
                            )}
                          </div>
                        ) : (
                          <Badge
                            className="border-warning/50 bg-warning/20 text-warning-foreground"
                            variant="outline"
                          >
                            ยังไม่พบ mapping
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <ResultBadge value={patient.hbsag} />
                      </td>
                      <td className="px-3 py-2">
                        <ResultBadge value={patient.hcvAb} />
                      </td>
                      <td className="px-3 py-2">
                        <ResultBadge value={patient.hcvVL} />
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline">{patient.persona}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={bandColor[raaia.band]}>
                          Score {raaia.score}
                        </Badge>
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          {raaia.explanation}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {actionLabel[raaia.nextAction]}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5"
                            onClick={() => createInvite.mutate(patient)}
                          >
                            {createInvite.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <QrCode className="h-3.5 w-3.5" />
                            )}
                            QR
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5"
                            onClick={() => queueNudge.mutate(patient)}
                          >
                            <Send className="h-3.5 w-3.5" />
                            LINE
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!filtered.length && (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-3 py-8 text-center text-sm text-muted-foreground"
                    >
                      ไม่พบผู้ป่วยตามตัวกรองนี้
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
