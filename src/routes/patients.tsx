import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  BookOpenCheck,
  CheckCircle2,
  Edit3,
  Files,
  Loader2,
  MapPin,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Send,
  Save,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getHbvHdvMonitoringStatus,
  HBV_HDV_MONITORING_INSIGHT,
} from "@/lib/hepa-clinical-evidence";
import { OfficialPageHeader } from "@/components/official-layout";
import { WorkflowSteps } from "@/components/workflow-steps";
import { hasCareGap, needsSofvelTreatment, type Patient } from "@/lib/hepa-data";
import { calculateHepaRaaia, type HepaRaaiaScore } from "@/lib/hepa-raaia";
import { HEPA_SERVICE_AREAS, resolveHepaServiceArea } from "@/lib/hepa-service-area";
import { fetchPatients } from "@/lib/supabase";

type PatientsSearch = {
  filter?: "hcv_sofvel" | "gap" | "high" | "need_qr" | "hbv_hdv";
};

type SheetUnitSummary = {
  code: string;
  sheetName: string;
  subdistrict?: string;
  count: number;
  status: "success" | "failed";
  error?: string;
};

export const Route = createFileRoute("/patients")({
  validateSearch: (search: Record<string, unknown>): PatientsSearch => ({
    filter:
      typeof search.filter === "string" ? (search.filter as PatientsSearch["filter"]) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "ทะเบียนผู้ป่วยค้างติดตาม — HEPA-GLUE Engine" },
      {
        name: "description",
        content: "ทะเบียนผู้ป่วยไวรัสตับอักเสบ B/C พร้อมคะแนนความเร่งด่วนและ QR ผูก LINE",
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
  send_line_nudge: "ส่งข้อความติดตามผ่าน LINE",
  staff_call: "โทรตามโดยเจ้าหน้าที่",
  vhv_followup: "ส่งต่อ อสม.",
  routine_followup: "ติดตามตามรอบ",
};

function personaLabel(value?: Patient["persona"]) {
  const labels: Record<string, string> = {
    "The Engaged": "ร่วมมือดี",
    "The Forgetful": "มักลืมนัด",
    "The Fearful": "กังวลต่อการรักษา",
    "The Denier": "ยังไม่ยอมรับผล",
    "The Striver": "มีข้อจำกัดในการเข้าถึง",
  };
  return labels[value || ""] || "ยังไม่ประเมิน";
}

function maskCid(value?: string) {
  if (!value) return "-";
  return value.length > 4 ? `*********${value.slice(-4)}` : value;
}

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
  if (!response.ok) throw new Error(data?.message || "ดำเนินการติดตามไม่สำเร็จ");
  return data;
}

async function fetchCareGapStatus() {
  const response = await fetch("/api/care-gap-queue");
  if (!response.ok) throw new Error("ตรวจสอบโมดูลไม่สำเร็จ");
  return response.json();
}

async function openHcvQueue() {
  const response = await fetch("/api/care-gap-queue", { method: "POST" });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || "เปิดคิวไม่สำเร็จ");
  return data;
}

type PatientForm = Pick<
  Patient,
  | "hn"
  | "name"
  | "cid"
  | "birth_date"
  | "testDate"
  | "subdistrict"
  | "village"
  | "serviceUnitCode"
  | "hbsag"
  | "hcvAb"
  | "hcvVL"
  | "persona"
  | "care_status"
>;

const emptyPatientForm: PatientForm = {
  hn: "",
  name: "",
  cid: "",
  birth_date: "",
  testDate: new Date().toISOString().slice(0, 10),
  subdistrict: "",
  village: "",
  serviceUnitCode: "",
  hbsag: "",
  hcvAb: "",
  hcvVL: "",
  persona: "The Engaged",
  care_status: "Pending",
};

function patientToForm(patient: Patient): PatientForm {
  return {
    hn: patient.hn,
    name: patient.name,
    cid: patient.cid,
    birth_date: patient.birth_date,
    testDate: patient.testDate,
    subdistrict: patient.subdistrict,
    village: patient.village,
    serviceUnitCode: patient.serviceUnitCode || "",
    hbsag: patient.hbsag || "",
    hcvAb: patient.hcvAb || "",
    hcvVL: patient.hcvVL || "",
    persona: patient.persona || "The Engaged",
    care_status: patient.care_status || "Pending",
  };
}

async function savePatient(form: PatientForm) {
  const response = await fetch("/api/patients", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || "บันทึกข้อมูลผู้ป่วยไม่สำเร็จ");
  return data;
}

async function deletePatientByHn(hn: string) {
  const response = await fetch(`/api/patients?hn=${encodeURIComponent(hn)}`, { method: "DELETE" });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || "ลบข้อมูลผู้ป่วยไม่สำเร็จ");
  return data;
}

async function syncGoogleSheetPatients() {
  const response = await fetch("/api/patients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "sync_google_sheet" }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || "อัปเดตข้อมูลจาก Google Sheet ไม่สำเร็จ");
  return data;
}

function PatientsPage() {
  const { filter: searchFilter } = Route.useSearch();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<
    "all" | "gap" | "high" | "need_qr" | "hbv_hdv" | "hcv_sofvel"
  >(searchFilter || "all");
  const [unitFilter, setUnitFilter] = useState("all");
  const [rosterSummaryOpen, setRosterSummaryOpen] = useState(false);
  const [latestLink, setLatestLink] = useState("");
  const [editing, setEditing] = useState<PatientForm | null>(null);
  const [deleteHn, setDeleteHn] = useState("");
  useEffect(() => {
    if (searchFilter) setFilter(searchFilter);
  }, [searchFilter]);

  const {
    data: patientResponse,
    isLoading,
    error,
    refetch,
  } = useQuery({ queryKey: ["patients"], queryFn: fetchPatients });

  const patients = useMemo(() => patientResponse?.patients || [], [patientResponse?.patients]);
  const patientMeta = patientResponse?.meta;
  const sheetUnits = useMemo(
    () =>
      Array.isArray(patientMeta?.googleSheetUnits)
        ? (patientMeta.googleSheetUnits as SheetUnitSummary[])
        : [],
    [patientMeta],
  );

  const createInvite = useMutation({
    mutationFn: (patient: Patient) =>
      postAgent("create_invite", { hn: patient.hn, patientName: patient.name }),
    onSuccess: (result) => {
      setLatestLink(result.link);
      toast.success("สร้าง QR ผูก LINE แล้ว");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "สร้าง QR ไม่สำเร็จ"),
  });

  const savePatientMutation = useMutation({
    mutationFn: savePatient,
    onSuccess: () => {
      setEditing(null);
      refetch();
      toast.success("บันทึกข้อมูลผู้ป่วยแล้ว");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "บันทึกข้อมูลผู้ป่วยไม่สำเร็จ"),
  });

  const deletePatientMutation = useMutation({
    mutationFn: deletePatientByHn,
    onSuccess: () => {
      setDeleteHn("");
      refetch();
      toast.success("ลบผู้ป่วยออกจากทะเบียนแล้ว");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "ลบข้อมูลผู้ป่วยไม่สำเร็จ"),
  });

  const syncGoogleMutation = useMutation({
    mutationFn: syncGoogleSheetPatients,
    onSuccess: (result) => {
      refetch();
      toast.success(`อัปเดตข้อมูลจาก Google Sheet แล้ว ${result.sync?.count ?? 0} ราย`);
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "อัปเดตข้อมูลจาก Google Sheet ไม่สำเร็จ"),
  });

  const moduleStatus = useQuery({
    queryKey: ["care-gap-modules"],
    queryFn: fetchCareGapStatus,
  });

  const openQueue = useMutation({
    mutationFn: openHcvQueue,
    onSuccess: (result) => {
      moduleStatus.refetch();
      toast.success(`จัดคิวแล้ว ${result.queued} ราย · รอผูก LINE ${result.blocked} ราย`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "เปิดคิวไม่สำเร็จ"),
  });

  const queueNudge = useMutation({
    mutationFn: (patient: Patient) =>
      postAgent("queue_nudge", { hn: patient.hn, persona: patient.persona }),
    onSuccess: (result) =>
      toast.success(
        result.task?.status === "blocked"
          ? "ยังไม่เชื่อมบัญชี LINE กรุณาสร้าง QR ให้ผู้ป่วยก่อน"
          : "จัดคิวข้อความ LINE แล้ว",
      ),
    onError: (err) => toast.error(err instanceof Error ? err.message : "จัดคิวไม่สำเร็จ"),
  });

  const scored = useMemo(() => {
    return (patients || []).map((patient) => ({
      patient,
      raaia: calculateHepaRaaia(patient),
      hbvHdv: getHbvHdvMonitoringStatus(patient),
    }));
  }, [patients]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scored.filter(({ patient, raaia, hbvHdv }) => {
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
        (filter === "hcv_sofvel" && needsSofvelTreatment(patient)) ||
        (filter === "high" && (raaia.band === "critical" || raaia.band === "high")) ||
        (filter === "need_qr" && raaia.nextAction === "create_line_qr") ||
        (filter === "hbv_hdv" && hbvHdv.flagged);
      const matchesUnit = unitFilter === "all" || patient.serviceUnitCode === unitFilter;
      return matchesText && matchesFilter && matchesUnit;
    });
  }, [filter, query, scored, unitFilter]);

  const stats = useMemo(
    () => ({
      total: scored.length,
      gaps: scored.filter(({ patient }) => hasCareGap(patient)).length,
      high: scored.filter(({ raaia }) => raaia.band === "critical" || raaia.band === "high").length,
      needQr: scored.filter(({ raaia }) => raaia.nextAction === "create_line_qr").length,
      hbvHdvReview: scored.filter(({ hbvHdv }) => hbvHdv.flagged).length,
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

  const sofvelGapCount = scored.filter(({ patient }) => needsSofvelTreatment(patient)).length;

  return (
    <div className="page-shell">
      <OfficialPageHeader
        eyebrow="ทะเบียนผู้ป่วยค้างติดตาม"
        title="จัดลำดับและติดตามการดูแลผู้ป่วย"
        description="ใช้รายชื่อกลางของระบบเพื่อจัดลำดับความเร่งด่วน เชื่อมบัญชี LINE และจัดคิวข้อความติดตามให้เจ้าหน้าที่ดำเนินงานต่อได้ทันที"
        badges={["ใช้รายชื่อกลาง", "ติดตามผ่าน LINE", "ตรวจสอบย้อนหลังได้"]}
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => refetch()} className="w-fit gap-2">
            <CheckCircle2 className="h-4 w-4" />
            รีเฟรช
          </Button>
          <Button
            variant="outline"
            onClick={() => syncGoogleMutation.mutate()}
            disabled={syncGoogleMutation.isPending}
            className="w-fit gap-2"
          >
            {syncGoogleMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            อัปเดตจาก Google Sheet
          </Button>
          <Button onClick={() => setEditing(emptyPatientForm)} className="w-fit gap-2">
            <Plus className="h-4 w-4" />
            เพิ่มผู้ป่วย
          </Button>
        </div>
      </OfficialPageHeader>

      <WorkflowSteps
        title="เส้นทางติดตามผู้ป่วย"
        steps={[
          { title: "ตรวจสอบรายชื่อกลาง", detail: "อัปเดตจากหน่วยบริการและ Google Sheet" },
          { title: "จัดลำดับความเร่งด่วน", detail: "พิจารณาผลตรวจและสถานะการดูแล" },
          { title: "เชื่อมบัญชี LINE", detail: "สร้าง QR สำหรับผู้ที่ยังไม่เชื่อมบัญชี" },
          { title: "ติดตามจนจบกระบวนการ", detail: "ส่งข้อความ นัดหมาย และบันทึกผล" },
        ]}
      />

      <Card>
        <CardContent className="flex flex-col gap-2 p-4 text-sm md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-medium">แหล่งข้อมูลทะเบียน</div>
            <div className="text-muted-foreground">
              {patientMeta?.source === "google-sheet"
                ? "Google Sheet"
                : "รายชื่อที่เตรียมไว้ในระบบ"}
              {patientMeta?.lastGoogleSyncAt
                ? ` · อัปเดตล่าสุด ${new Date(String(patientMeta.lastGoogleSyncAt)).toLocaleString("th-TH")}`
                : ""}
              {patientMeta?.lastGoogleSyncError
                ? ` · ล่าสุด: ${String(patientMeta.lastGoogleSyncError)}`
                : ""}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">Google {String(patientMeta?.googleSheetCount ?? 0)}</Badge>
            {sheetUnits.length > 0 && (
              <Badge variant="outline">
                อ่านได้ {sheetUnits.filter((item) => item.status === "success").length}/
                {sheetUnits.length} ชีต
              </Badge>
            )}
            <Badge variant="outline">แก้ไขในระบบ {String(patientMeta?.editedCount ?? 0)}</Badge>
            <Badge variant="outline">ลบ/ซ่อน {String(patientMeta?.deletedCount ?? 0)}</Badge>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5"
              onClick={() => setRosterSummaryOpen(true)}
              disabled={!sheetUnits.length}
            >
              <Files className="h-3.5 w-3.5" />
              แยกตาม รพ.สต.
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={rosterSummaryOpen} onOpenChange={setRosterSummaryOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>รายชื่อแยกตามชีตของแต่ละ รพ.สต.</DialogTitle>
            <DialogDescription>
              เลือกสถานบริการเพื่อกรองตารางรายชื่อ ระบบคงรหัสหน่วยบริการจากแท็บต้นทาง
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sheetUnits.map((unit) => (
              <button
                key={unit.code}
                type="button"
                disabled={unit.status === "failed"}
                onClick={() => {
                  setUnitFilter(unit.code);
                  setRosterSummaryOpen(false);
                  requestAnimationFrame(() =>
                    document
                      .getElementById("patient-roster-table")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                  );
                }}
                className={`rounded-xl border p-3 text-left transition ${
                  unit.status === "failed"
                    ? "cursor-not-allowed border-rose-200 bg-rose-50 text-rose-900"
                    : unit.count > 0
                      ? "border-primary/25 bg-primary/5 hover:border-primary/50"
                      : "bg-muted/15 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-semibold">{unit.sheetName}</div>
                  <Badge variant="outline" className="shrink-0">
                    {unit.status === "failed" ? "อ่านไม่ได้" : `${unit.count} ราย`}
                  </Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  รหัส {unit.code}
                  {unit.subdistrict ? ` · ต.${unit.subdistrict}` : ""}
                </div>
                {unit.error && <div className="mt-1 text-[10px]">{unit.error}</div>}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {editing && (
        <Card className="border-teal/30">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>{editing.hn ? `แก้ไขผู้ป่วย ${editing.hn}` : "เพิ่มผู้ป่วยใหม่"}</span>
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <Input
                value={editing.hn}
                onChange={(e) => setEditing({ ...editing, hn: e.target.value })}
                placeholder="HN *"
              />
              <Input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="ชื่อ-นามสกุล *"
              />
              <Input
                value={editing.cid}
                onChange={(e) => setEditing({ ...editing, cid: e.target.value })}
                placeholder="CID"
              />
              <Input
                value={editing.birth_date}
                onChange={(e) => setEditing({ ...editing, birth_date: e.target.value })}
                placeholder="วันเกิด YYYY-MM-DD"
              />
              <Input
                value={editing.testDate}
                onChange={(e) => setEditing({ ...editing, testDate: e.target.value })}
                placeholder="วันที่ตรวจ YYYY-MM-DD"
              />
              <Input
                value={editing.subdistrict}
                onChange={(e) => setEditing({ ...editing, subdistrict: e.target.value })}
                placeholder="ตำบล"
              />
              <Input
                value={editing.village}
                onChange={(e) => setEditing({ ...editing, village: e.target.value })}
                placeholder="หมู่บ้าน/หมู่ที่"
              />
              <Input
                value={editing.serviceUnitCode || ""}
                onChange={(e) => setEditing({ ...editing, serviceUnitCode: e.target.value })}
                placeholder="รหัสพื้นที่ เช่น KS"
              />
              <Input
                value={editing.hbsag}
                onChange={(e) => setEditing({ ...editing, hbsag: e.target.value })}
                placeholder="HBsAg"
              />
              <Input
                value={editing.hcvAb}
                onChange={(e) => setEditing({ ...editing, hcvAb: e.target.value })}
                placeholder="HCV Ab"
              />
              <Input
                value={editing.hcvVL}
                onChange={(e) => setEditing({ ...editing, hcvVL: e.target.value })}
                placeholder="HCV RNA"
              />
              <Input
                value={editing.care_status || ""}
                onChange={(e) => setEditing({ ...editing, care_status: e.target.value })}
                placeholder="สถานะดูแล"
              />
              <Select
                value={editing.persona}
                onValueChange={(value) =>
                  setEditing({ ...editing, persona: value as Patient["persona"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="The Engaged">ร่วมมือดี</SelectItem>
                  <SelectItem value="The Forgetful">มักลืมนัด</SelectItem>
                  <SelectItem value="The Fearful">กังวลต่อการรักษา</SelectItem>
                  <SelectItem value="The Denier">ยังไม่ยอมรับผล</SelectItem>
                  <SelectItem value="The Striver">มีข้อจำกัดในการเข้าถึง</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                onClick={() => savePatientMutation.mutate(editing)}
                disabled={savePatientMutation.isPending || !editing.hn || !editing.name}
                className="gap-2"
              >
                {savePatientMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                บันทึก
              </Button>
              <Button variant="outline" onClick={() => setEditing(null)}>
                ยกเลิก
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {filter === "hcv_sofvel" && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                <AlertTriangle className="h-4 w-4" />
                คิวเร่งด่วน: HCV รอ Sofvel {sofvelGapCount} ราย
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                กดจัดคิวทั้งหมดเพื่อสร้างงานติดตาม — รายที่ยังไม่ผูก LINE ต้องสร้าง QR ก่อนจึงส่งได้
              </p>
            </div>
            <Button
              disabled={openQueue.isPending || sofvelGapCount === 0}
              onClick={() => openQueue.mutate()}
              className="gap-2"
            >
              {openQueue.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              จัดคิวติดตามทั้งหมด
            </Button>
          </CardContent>
        </Card>
      )}

      {moduleStatus.data?.modules && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">สถานะโมดูลที่เกี่ยวข้อง</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {moduleStatus.data.modules.map(
              (module: { id: string; name: string; state: string; detail: string }) => (
                <div key={module.id} className="rounded-lg border p-3 text-sm">
                  <div className="font-medium">{module.name}</div>
                  <Badge variant="outline" className="mt-2">
                    {module.state === "ready"
                      ? "พร้อม"
                      : module.state === "partial"
                        ? "บางส่วน"
                        : "ติดเงื่อนไข"}
                  </Badge>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{module.detail}</p>
                </div>
              ),
            )}
          </CardContent>
        </Card>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {[
          { label: "รายชื่อทั้งหมด", value: stats.total },
          { label: "ค้างติดตาม", value: stats.gaps },
          { label: "เสี่ยงสูง", value: stats.high },
          { label: "ควรสร้าง QR", value: stats.needQr },
          { label: "ควรทบทวน HBV/HDV", value: stats.hbvHdvReview },
          { label: "ระบุพื้นที่แล้ว", value: stats.mapped },
          { label: "เขตรับผิดชอบ", value: stats.areas },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{item.value}</div>
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                </div>
                {item.label === "ระบุพื้นที่แล้ว" ? (
                  <MapPin className="h-5 w-5 text-teal" />
                ) : item.label === "ควรทบทวน HBV/HDV" ? (
                  <BookOpenCheck className="h-5 w-5 text-teal" />
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
              <div className="font-semibold">QR สำหรับให้ผู้ป่วยสแกน</div>
              <p className="mt-1 text-sm leading-6">
                ให้ผู้ป่วยเปิด QR ผ่าน LINE และกดยืนยัน ระบบจะเชื่อมบัญชีกับ HN
                โดยไม่ต้องให้เจ้าหน้าที่พิมพ์รหัสบัญชี LINE
              </p>
              <div className="mt-2 break-all text-xs">{latestLink}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {deleteHn && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold text-destructive">ยืนยันลบผู้ป่วย HN {deleteHn}</div>
              <p className="mt-1 text-sm text-muted-foreground">
                รายชื่อนี้จะถูกซ่อนออกจากทะเบียนและแดชบอร์ด แต่ยังสามารถเพิ่มกลับได้ด้วย HN เดิม
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteHn("")}
                disabled={deletePatientMutation.isPending}
              >
                ยกเลิก
              </Button>
              <Button
                variant="destructive"
                onClick={() => deletePatientMutation.mutate(deleteHn)}
                disabled={deletePatientMutation.isPending}
                className="gap-2"
              >
                {deletePatientMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                ลบ
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-sky-200 bg-sky-50/70">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base text-sky-950">
                <BookOpenCheck className="h-5 w-5 text-teal" />
                ใช้งาน HBV/HDV monitoring ในทะเบียน
              </CardTitle>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-sky-900/80">
                ระบบจะแสดงเครื่องหมายกำกับผู้ที่มีผล HBV เป็นบวก เพื่อให้เจ้าหน้าที่พิจารณา
                ตัวชี้วัดที่เกี่ยวข้องร่วมกัน ไม่ใช่การสั่งตรวจหรือรักษาอัตโนมัติ
              </p>
            </div>
            <Button
              variant="outline"
              className="w-fit gap-2 border-sky-200 bg-white/70 text-sky-900 hover:bg-white"
              onClick={() => setFilter("hbv_hdv")}
            >
              <BookOpenCheck className="h-4 w-4" />
              ดูรายการที่ควรทบทวน
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[.8fr_1.2fr]">
          <div className="rounded-lg border border-sky-200 bg-white/70 p-3 text-sm leading-6 text-sky-950">
            {HBV_HDV_MONITORING_INSIGHT.summary}
            <div className="mt-2 text-xs text-sky-900/70">
              ที่มา: {HBV_HDV_MONITORING_INSIGHT.evidenceDate}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {HBV_HDV_MONITORING_INSIGHT.markers.map((marker) => (
              <div
                key={marker}
                className="rounded-lg border border-sky-200 bg-white/70 p-3 text-xs"
              >
                <div className="font-semibold text-sky-950">{marker}</div>
                <div className="mt-1 leading-5 text-sky-900/70">
                  ดูร่วมกับ clinical context และแนวโน้มตามเวลา
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card id="patient-roster-table" className="scroll-mt-20">
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
              <Select value={unitFilter} onValueChange={setUnitFilter}>
                <SelectTrigger className="sm:w-52">
                  <SelectValue placeholder="ทุก รพ.สต." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุก รพ.สต.</SelectItem>
                  {sheetUnits.map((unit) => (
                    <SelectItem key={unit.code} value={unit.code}>
                      {unit.sheetName} ({unit.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
                <SelectTrigger className="sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="gap">ผู้ป่วยค้างติดตาม</SelectItem>
                  <SelectItem value="hcv_sofvel">HCV รอ Sofvel (เร่งด่วน)</SelectItem>
                  <SelectItem value="high">เสี่ยงสูง</SelectItem>
                  <SelectItem value="need_qr">ควรสร้าง QR</SelectItem>
                  <SelectItem value="hbv_hdv">HBV/HDV review</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[1480px] text-sm">
              <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">HN</th>
                  <th className="px-3 py-2">ผู้ป่วย</th>
                  <th className="px-3 py-2">พื้นที่</th>
                  <th className="px-3 py-2">หน่วยรับผิดชอบ</th>
                  <th className="px-3 py-2">HBsAg</th>
                  <th className="px-3 py-2">HCV Ab</th>
                  <th className="px-3 py-2">HCV RNA</th>
                  <th className="px-3 py-2">รูปแบบการติดตาม</th>
                  <th className="px-3 py-2">คะแนนเร่งด่วน</th>
                  <th className="px-3 py-2">HBV/HDV</th>
                  <th className="px-3 py-2">ขั้นตอนถัดไป</th>
                  <th className="px-3 py-2 text-right">ทำงาน</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ patient, raaia, hbvHdv }) => {
                  const serviceArea = resolveHepaServiceArea(patient);
                  return (
                    <tr key={patient.hn} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                        {patient.hn}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-foreground">{patient.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          เลขประชาชน {maskCid(patient.cid)}
                        </div>
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
                            ยังไม่ระบุหน่วยรับผิดชอบ
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
                        <Badge variant="outline">{personaLabel(patient.persona)}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={bandColor[raaia.band]}>
                          คะแนน {raaia.score}
                        </Badge>
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          {raaia.explanation}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {hbvHdv.flagged ? (
                          <div className="space-y-1">
                            <Badge
                              variant="outline"
                              className={
                                hbvHdv.priority === "high"
                                  ? "border-sky-300 bg-sky-50 text-sky-900"
                                  : "border-slate-200 bg-slate-50 text-slate-700"
                              }
                            >
                              {hbvHdv.label}
                            </Badge>
                            <div className="max-w-56 text-[10px] leading-4 text-muted-foreground">
                              {hbvHdv.detail}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">ติดตามตามปกติ</span>
                        )}
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
                            onClick={() => setEditing(patientToForm(patient))}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            แก้ไข
                          </Button>
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
                            สร้าง QR
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5"
                            onClick={() => queueNudge.mutate(patient)}
                          >
                            <Send className="h-3.5 w-3.5" />
                            จัดคิว LINE
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteHn(patient.hn)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            ลบ
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!filtered.length && (
                  <tr>
                    <td
                      colSpan={12}
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
