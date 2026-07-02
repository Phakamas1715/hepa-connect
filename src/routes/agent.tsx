import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Activity,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  Info,
  Link2,
  Loader2,
  MapPin,
  PlayCircle,
  QrCode,
  RefreshCcw,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmAction } from "@/components/confirm-action";
import { WorkflowSteps } from "@/components/workflow-steps";
import { Input } from "@/components/ui/input";
import { OfficialPageHeader } from "@/components/official-layout";
import { HBV_HDV_MONITORING_INSIGHT } from "@/lib/hepa-clinical-evidence";
import { HEPA_SERVICE_AREAS } from "@/lib/hepa-service-area";

export const Route = createFileRoute("/agent")({
  head: () => ({
    meta: [
      { title: "นัดหมายและติดตามผู้ป่วย — HEPA-GLUE Engine" },
      {
        name: "description",
        content: "สร้าง QR ผูก LINE จัดคิวติดตามผู้ป่วย และบันทึกการทำงานย้อนหลัง",
      },
    ],
  }),
  component: AgentPage,
});

type Store = {
  invites: Array<{
    id: string;
    hn: string;
    patientName?: string;
    status: string;
    expiresAt: string;
    usedAt?: string;
  }>;
  identities: Array<{
    lineUserId: string;
    hn?: string;
    role: string;
    displayName?: string;
    verifiedAt: string;
    status: string;
  }>;
  tasks: Array<{
    id: string;
    hn: string;
    type: string;
    status: string;
    message?: string;
    lineUserId?: string;
    createdAt: string;
  }>;
  appointments: Array<{
    id: string;
    appointmentCode: string;
    hn: string;
    patientName: string;
    facilityCode: string;
    facilityName: string;
    appointmentDate: string;
    appointmentTime?: string;
    note?: string;
    status: "scheduled" | "confirmed" | "completed" | "cancelled";
    notificationStatus: "pending" | "not_linked" | "sent" | "failed";
    notificationSentAt?: string;
    createdAt: string;
  }>;
  audit: Array<{
    id: string;
    at: string;
    actor: string;
    action: string;
    hn?: string;
    detail: string;
  }>;
};

type CarePersonOption = {
  id: string;
  name: string;
  source: "registry" | "positive-intake";
};

async function fetchStore(): Promise<Store> {
  const response = await fetch("/api/agent-orchestrator");
  if (!response.ok) throw new Error("โหลดสถานะ agent ไม่สำเร็จ");
  return response.json();
}

async function fetchCarePeople(): Promise<CarePersonOption[]> {
  const [patientsResponse, positiveResponse] = await Promise.all([
    fetch("/api/patients"),
    fetch("/api/positive-intake"),
  ]);
  if (!patientsResponse.ok || !positiveResponse.ok) {
    throw new Error("โหลดรายชื่อสำหรับนัดหมายไม่สำเร็จ");
  }
  const patients = await patientsResponse.json();
  const positive = await positiveResponse.json();
  return [
    ...(patients.patients || []).map((item: { hn: string; name: string }) => ({
      id: item.hn,
      name: item.name,
      source: "registry" as const,
    })),
    ...(positive.records || [])
      .filter((item: { status: string }) => item.status !== "closed")
      .map((item: { caseCode: string; fullName: string }) => ({
        id: item.caseCode,
        name: item.fullName,
        source: "positive-intake" as const,
      })),
  ];
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

function appointmentStatusLabel(status: Store["appointments"][number]["status"]) {
  if (status === "confirmed") return "ยืนยันนัดแล้ว";
  if (status === "completed") return "มาตามนัดแล้ว";
  if (status === "cancelled") return "ยกเลิก";
  return "รอยืนยัน";
}

function notificationStatusLabel(status: Store["appointments"][number]["notificationStatus"]) {
  if (status === "sent") return "ส่งบัตรนัดแล้ว";
  if (status === "failed") return "ส่งไม่สำเร็จ";
  if (status === "not_linked") return "รอผูก LINE ผู้ป่วย";
  return "พร้อมส่ง";
}

function inviteStatusLabel(status: string) {
  if (status === "used") return "ใช้แล้ว";
  if (status === "expired") return "หมดอายุ";
  if (status === "revoked") return "ยกเลิกแล้ว";
  return "รอผู้ป่วยยืนยัน";
}

function identityRoleLabel(role: string) {
  return role === "patient" ? "ผู้ป่วย" : role === "staff" ? "เจ้าหน้าที่" : role;
}

function taskStatusLabel(status: string) {
  if (status === "pending") return "รอดำเนินการ";
  if (status === "blocked") return "ต้องแก้ไข";
  if (status === "contacted") return "ติดต่อแล้ว";
  if (status === "sent") return "ส่งแล้ว";
  if (status === "closed") return "ปิดงาน";
  return status;
}

function maskLineUserId(value: string) {
  if (value.length < 10) return value;
  return `${value.slice(0, 5)}••••${value.slice(-4)}`;
}

function auditActionLabel(action: string) {
  const labels: Record<string, string> = {
    create_invite: "สร้างลิงก์ยืนยัน LINE",
    create_line_invite: "สร้างลิงก์ยืนยัน LINE",
    verify_invite: "ผู้ป่วยยืนยันบัญชี LINE",
    verify_line_identity: "ผู้ป่วยยืนยันบัญชี LINE",
    verify_staff: "เจ้าหน้าที่ยืนยันบัญชี LINE",
    queue_line_nudge: "จัดคิวข้อความติดตาม",
    send_line_nudge: "ส่งข้อความติดตาม",
    create_appointment: "สร้างนัดหมาย",
    appointment_notification_sent: "ส่งบัตรนัด",
    appointment_status_updated: "อัปเดตสถานะนัด",
    positive_intake_created: "รับข้อมูลผู้แจ้งผลตรวจ",
    positive_intake_status_updated: "อัปเดตสถานะผู้แจ้งผล",
    positive_patient_identity_verified: "เชื่อมบัญชีผู้ป่วยสำเร็จ",
  };
  return labels[action] || "บันทึกการทำงานของระบบ";
}

function AgentPage() {
  const [hn, setHn] = useState("");
  const [patientName, setPatientName] = useState("");
  const [latestLink, setLatestLink] = useState("");
  const [appointmentForm, setAppointmentForm] = useState({
    hn: "",
    patientName: "",
    facilityCode: "NPH",
    appointmentDate: "",
    appointmentTime: "09:00",
    note: "นัดตรวจผลซ้ำเพื่อยืนยันผล กรุณานำบัตรนัดมายื่นที่จุดลงทะเบียน",
  });
  const { data, refetch, isFetching } = useQuery({
    queryKey: ["agent-store"],
    queryFn: fetchStore,
  });
  const carePeople = useQuery({
    queryKey: ["agent-care-people"],
    queryFn: fetchCarePeople,
  });

  const createInvite = useMutation({
    mutationFn: (person?: { hn: string; patientName: string }) =>
      postAgent("create_invite", {
        hn: person?.hn || hn,
        patientName: person?.patientName || patientName,
      }),
    onSuccess: (result) => {
      setLatestLink(result.link);
      toast.success("สร้างลิงก์ผูก LINE แล้ว");
      refetch();
      requestAnimationFrame(() =>
        document.getElementById("line-link-workflow")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      );
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "สร้างลิงก์ไม่สำเร็จ"),
  });

  const queueNudge = useMutation({
    mutationFn: () => postAgent("queue_nudge", { hn, persona: "engaged" }),
    onSuccess: (result) => {
      toast.success(
        result.task?.status === "blocked"
          ? "สร้างงานแล้ว แต่ยังไม่มีบัญชี LINE ที่ผูกกับ HN นี้"
          : "จัดคิวส่ง LINE แล้ว",
      );
      refetch();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "จัดคิวไม่สำเร็จ"),
  });

  const sendNudge = useMutation({
    mutationFn: () =>
      postAgent("send_nudge", { hn, persona: "engaged", messageType: "LINE_NUDGE" }),
    onSuccess: (result) => {
      toast.success(
        result.status === "sent"
          ? "ส่งข้อความ LINE แล้ว"
          : result.line?.message || "ยังไม่ได้ส่งข้อความ LINE",
      );
      refetch();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "ส่ง LINE ไม่สำเร็จ"),
  });

  const createAppointmentMutation = useMutation({
    mutationFn: (sendLine: boolean) =>
      postAgent("create_appointment", {
        ...appointmentForm,
        sendLine,
      }),
    onSuccess: (result) => {
      toast.success(result.notification?.message || "บันทึกนัดหมายแล้ว");
      setAppointmentForm((current) => ({
        ...current,
        hn: "",
        patientName: "",
        appointmentDate: "",
        note: "นัดตรวจผลซ้ำเพื่อยืนยันผล กรุณานำบัตรนัดมายื่นที่จุดลงทะเบียน",
      }));
      refetch();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "บันทึกนัดหมายไม่สำเร็จ"),
  });

  const appointmentAction = useMutation({
    mutationFn: ({
      action,
      id,
      status,
    }: {
      action: "send_appointment" | "update_appointment";
      id: string;
      status?: string;
    }) => postAgent(action, { id, status }),
    onSuccess: (result) => {
      toast.success(result.notification?.message || "อัปเดตนัดหมายแล้ว");
      refetch();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "อัปเดตนัดหมายไม่สำเร็จ"),
  });

  const reconcile = useMutation({
    mutationFn: () => postAgent("reconcile_data", {}),
    onSuccess: (result) => {
      const summary = result.reconciliation;
      toast.success(
        `ตรวจข้อมูลแล้ว: อัปเดตคิวผู้พบเชื้อ ${summary.positiveTasksUpdated} ราย · ปิดรายการเดิม ${summary.orphanTasksClosed} ราย`,
      );
      refetch();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "ตรวจความสัมพันธ์ข้อมูลไม่สำเร็จ"),
  });

  const copyLink = async () => {
    await navigator.clipboard.writeText(latestLink);
    toast.success("คัดลอกลิงก์แล้ว");
  };

  const selectCarePerson = (id: string) => {
    const person = carePeople.data?.find((item) => item.id === id);
    setAppointmentForm((current) => ({
      ...current,
      hn: id,
      patientName: person?.name || current.patientName,
    }));
  };

  const activeTaskCount =
    data?.tasks.filter((item) => !["closed", "cancelled", "completed"].includes(item.status))
      .length || 0;
  const activeAppointments =
    data?.appointments
      .filter((item) => !["cancelled", "completed"].includes(item.status))
      .sort((a, b) =>
        `${a.appointmentDate}${a.appointmentTime || ""}`.localeCompare(
          `${b.appointmentDate}${b.appointmentTime || ""}`,
        ),
      ) || [];
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return (
    <div className="page-shell">
      <OfficialPageHeader
        eyebrow="นัดหมายและติดตามผ่าน LINE"
        title="จัดการบัตรนัดและการติดต่อผู้ป่วย"
        description="เลือกผู้รับบริการเพื่อสร้างบัตรนัด ส่งข้อความ และตรวจสถานะการตอบรับ หากยังไม่เชื่อมบัญชี LINE ระบบจะแนะนำขั้นตอนให้เจ้าหน้าที่ดำเนินการต่อ"
        badges={["ใช้รายชื่อกลางของระบบ", "แยกบัญชีผู้ป่วยและเจ้าหน้าที่", "ตรวจสอบย้อนหลังได้"]}
      >
        <Button
          variant="outline"
          className="gap-2"
          disabled={reconcile.isPending}
          onClick={() => reconcile.mutate()}
        >
          {reconcile.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="h-4 w-4" />
          )}
          ตรวจความสอดคล้องของข้อมูล
        </Button>
      </OfficialPageHeader>

      <WorkflowSteps
        title="เส้นทางการนัดหมายและติดตาม"
        steps={[
          { title: "เลือกผู้รับบริการ", detail: "ค้นหาจากทะเบียนหรือรหัสเคส" },
          { title: "ตรวจบัญชี LINE", detail: "สร้าง QR หากยังไม่เชื่อมบัญชี" },
          { title: "สร้างและส่งบัตรนัด", detail: "ระบุวัน เวลา และสถานบริการ" },
          { title: "ติดตามผล", detail: "ยืนยันนัด บันทึกมาตามนัด หรือยกเลิก" },
        ]}
      />

      {(data === undefined || carePeople.isLoading) && (
        <div className="flex items-center gap-2 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          กำลังโหลดข้อมูลนัดหมายและบัญชี LINE
        </div>
      )}
      {(carePeople.isError || (!data && !isFetching)) && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          โหลดข้อมูลบางส่วนไม่สำเร็จ กรุณากด “ตรวจความสอดคล้องของข้อมูล” หรือลองเปิดหน้านี้ใหม่
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
        <Card id="line-link-workflow" className="metric-card scroll-mt-20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="h-5 w-5 text-teal" />
              สร้าง QR ผูก LINE
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">HN</label>
                <Input
                  value={hn}
                  onChange={(event) => setHn(event.target.value)}
                  placeholder="เช่น 0001234"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">ชื่อผู้ป่วย</label>
                <Input
                  value={patientName}
                  onChange={(event) => setPatientName(event.target.value)}
                  placeholder="ระบุเพื่อแสดงในรายการ"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!hn || createInvite.isPending}
                onClick={() => createInvite.mutate(undefined)}
                className="gap-2"
              >
                {createInvite.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                สร้าง QR
              </Button>
              <Button
                disabled={!hn || queueNudge.isPending}
                onClick={() => queueNudge.mutate()}
                variant="outline"
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                จัดคิวติดตาม
              </Button>
              <Button
                disabled={!hn || sendNudge.isPending}
                onClick={() => sendNudge.mutate()}
                variant="outline"
                className="gap-2"
              >
                {sendNudge.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                ส่งข้อความ LINE
              </Button>
            </div>
            {latestLink && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=156x156&data=${encodeURIComponent(latestLink)}`}
                    alt="QR สำหรับผูก LINE"
                    className="h-36 w-36 rounded-lg border bg-white p-2"
                  />
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">สร้างลิงก์สำเร็จ</div>
                    <div className="mt-1 text-xs leading-5 text-emerald-800">
                      ให้ผู้ป่วยเปิด QR นี้ผ่าน LINE และกดยืนยัน ระบบจึงจะส่งข้อความและบัตรนัดได้
                    </div>
                    <div className="mt-2 break-all text-xs">{latestLink}</div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={copyLink}
                      className="mt-3 gap-2 bg-white/70"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      คัดลอกลิงก์
                    </Button>
                  </div>
                </div>
              </div>
            )}
            <div className="rounded-lg border bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
              ขั้นตอน: ระบุ HN → สร้าง QR → ให้ผู้ป่วยสแกนและยืนยันใน LINE →
              กลับมาตรวจสถานะก่อนส่งข้อความ
            </div>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-teal" />
              สถานะระบบ
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border bg-background/60 p-3">
              <div className="text-2xl font-bold">{data?.invites.length || 0}</div>
              <div className="text-xs text-muted-foreground">คำเชิญทั้งหมด</div>
            </div>
            <div className="rounded-lg border bg-background/60 p-3">
              <div className="text-2xl font-bold">{data?.identities.length || 0}</div>
              <div className="text-xs text-muted-foreground">บัญชี LINE ที่ผูกแล้ว</div>
            </div>
            <div className="rounded-lg border bg-background/60 p-3">
              <div className="text-2xl font-bold">{activeTaskCount}</div>
              <div className="text-xs text-muted-foreground">งานที่รอดำเนินการ</div>
            </div>
            <div className="rounded-lg border bg-background/60 p-3">
              <div className="text-2xl font-bold">{activeAppointments.length}</div>
              <div className="text-xs text-muted-foreground">นัดหมายที่กำลังติดตาม</div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[.95fr_1.05fr]">
        <Card className="metric-card border-emerald-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-5 w-5 text-teal" />
              สร้างบัตรนัดและส่ง LINE
            </CardTitle>
            <p className="text-xs leading-5 text-muted-foreground">
              เจ้าหน้าที่เลือกผู้รับบริการ วัน เวลา และสถานที่นัด ระบบจะส่งบัตรนัดเฉพาะบัญชี LINE
              ที่ยืนยันเป็นผู้ป่วยแล้ว ช่องที่มีเครื่องหมาย * จำเป็นต้องกรอก
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <datalist id="agent-care-people">
              {carePeople.data?.map((item) => (
                <option key={`${item.source}-${item.id}`} value={item.id}>
                  {item.name}
                </option>
              ))}
            </datalist>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  HN หรือรหัสเคส *
                </label>
                <Input
                  list="agent-care-people"
                  value={appointmentForm.hn}
                  onChange={(event) => selectCarePerson(event.target.value)}
                  placeholder="เลือกหรือพิมพ์รหัส"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  ชื่อผู้รับบริการ *
                </label>
                <Input
                  value={appointmentForm.patientName}
                  onChange={(event) =>
                    setAppointmentForm((current) => ({
                      ...current,
                      patientName: event.target.value,
                    }))
                  }
                  placeholder="ชื่อ-นามสกุล"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">สถานที่นัด *</label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={appointmentForm.facilityCode}
                onChange={(event) =>
                  setAppointmentForm((current) => ({
                    ...current,
                    facilityCode: event.target.value,
                  }))
                }
              >
                {HEPA_SERVICE_AREAS.map((facility) => (
                  <option key={facility.code} value={facility.code}>
                    {facility.unitName}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">วันนัด *</label>
                <Input
                  type="date"
                  min={today}
                  value={appointmentForm.appointmentDate}
                  onChange={(event) =>
                    setAppointmentForm((current) => ({
                      ...current,
                      appointmentDate: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">เวลานัด</label>
                <Input
                  type="time"
                  value={appointmentForm.appointmentTime}
                  onChange={(event) =>
                    setAppointmentForm((current) => ({
                      ...current,
                      appointmentTime: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                หมายเหตุสำหรับผู้รับบริการ
              </label>
              <textarea
                value={appointmentForm.note}
                onChange={(event) =>
                  setAppointmentForm((current) => ({ ...current, note: event.target.value }))
                }
                placeholder="เช่น งดน้ำงดอาหาร หรือนำผลตรวจเดิมมาด้วย"
                className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={
                  createAppointmentMutation.isPending ||
                  !appointmentForm.hn ||
                  !appointmentForm.patientName ||
                  !appointmentForm.appointmentDate
                }
                onClick={() => createAppointmentMutation.mutate(false)}
              >
                บันทึกนัด
              </Button>
              <Button
                className="gap-2"
                disabled={
                  createAppointmentMutation.isPending ||
                  !appointmentForm.hn ||
                  !appointmentForm.patientName ||
                  !appointmentForm.appointmentDate
                }
                onClick={() => createAppointmentMutation.mutate(true)}
              >
                {createAppointmentMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                บันทึกและส่งบัตรนัด
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock3 className="h-5 w-5 text-teal" />
              นัดหมายที่กำลังติดตาม
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {activeAppointments.length} นัดที่ยังไม่ปิดงาน
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeAppointments.slice(0, 8).map((appointment) => (
              <div key={appointment.id} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{appointment.patientName}</div>
                    <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {appointment.appointmentCode} · {appointment.hn}
                    </div>
                  </div>
                  <Badge variant="outline">{appointmentStatusLabel(appointment.status)}</Badge>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5 text-teal" />
                    {new Date(`${appointment.appointmentDate}T12:00:00`).toLocaleDateString(
                      "th-TH",
                    )}
                    {appointment.appointmentTime ? ` · ${appointment.appointmentTime} น.` : ""}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-teal" />
                    {appointment.facilityName}
                  </div>
                </div>
                <div
                  className={`mt-3 flex items-start gap-2 rounded-lg border p-2.5 text-xs ${
                    appointment.notificationStatus === "sent"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : appointment.notificationStatus === "failed"
                        ? "border-rose-200 bg-rose-50 text-rose-900"
                        : appointment.notificationStatus === "not_linked"
                          ? "border-amber-200 bg-amber-50 text-amber-900"
                          : "border-sky-200 bg-sky-50 text-sky-900"
                  }`}
                >
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div>
                    <div className="font-semibold">
                      {notificationStatusLabel(appointment.notificationStatus)}
                    </div>
                    {appointment.notificationStatus === "not_linked" && (
                      <div className="mt-0.5">
                        ต้องให้ผู้ป่วยสแกน QR และยืนยันบัญชี LINE ก่อนส่งบัตรนัด
                      </div>
                    )}
                  </div>
                </div>
                {appointment.note && (
                  <div className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
                    {appointment.note}
                  </div>
                )}
                {!["completed", "cancelled"].includes(appointment.status) && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {appointment.notificationStatus === "not_linked" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={createInvite.isPending}
                        onClick={() =>
                          createInvite.mutate({
                            hn: appointment.hn,
                            patientName: appointment.patientName,
                          })
                        }
                      >
                        สร้าง QR ผูก LINE
                      </Button>
                    ) : appointment.notificationStatus === "sent" ? (
                      <ConfirmAction
                        trigger="ส่งบัตรนัดซ้ำ"
                        title={`ส่งบัตรนัดให้ ${appointment.patientName} อีกครั้ง`}
                        description={`ระบบจะส่งบัตรนัด ${appointment.appointmentCode} ซ้ำไปยังบัญชี LINE ของผู้ป่วย`}
                        confirmLabel="ยืนยันส่งซ้ำ"
                        disabled={appointmentAction.isPending}
                        onConfirm={() =>
                          appointmentAction.mutate({
                            action: "send_appointment",
                            id: appointment.id,
                          })
                        }
                      />
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={appointmentAction.isPending}
                        onClick={() =>
                          appointmentAction.mutate({
                            action: "send_appointment",
                            id: appointment.id,
                          })
                        }
                      >
                        ส่งบัตรนัด
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={appointmentAction.isPending || appointment.status === "confirmed"}
                      onClick={() =>
                        appointmentAction.mutate({
                          action: "update_appointment",
                          id: appointment.id,
                          status: "confirmed",
                        })
                      }
                    >
                      ยืนยันนัด
                    </Button>
                    <ConfirmAction
                      trigger="มาตามนัดแล้ว"
                      title={`ยืนยันการมาตามนัดของ ${appointment.patientName}`}
                      description="นัดหมายนี้จะถูกบันทึกว่าเสร็จสิ้นและออกจากรายการที่กำลังติดตาม"
                      confirmLabel="ยืนยันมาตามนัด"
                      disabled={appointmentAction.isPending}
                      onConfirm={() =>
                        appointmentAction.mutate({
                          action: "update_appointment",
                          id: appointment.id,
                          status: "completed",
                        })
                      }
                    />
                    <ConfirmAction
                      trigger="ยกเลิกนัด"
                      title={`ยืนยันยกเลิกนัดของ ${appointment.patientName}`}
                      description={`นัดหมาย ${appointment.appointmentCode} จะถูกยกเลิกและออกจากรายการที่กำลังติดตาม`}
                      confirmLabel="ยืนยันยกเลิกนัด"
                      destructive
                      disabled={appointmentAction.isPending}
                      onConfirm={() =>
                        appointmentAction.mutate({
                          action: "update_appointment",
                          id: appointment.id,
                          status: "cancelled",
                        })
                      }
                    />
                  </div>
                )}
              </div>
            ))}
            {!activeAppointments.length && <EmptyLine text="ยังไม่มีนัดหมายที่ต้องติดตาม" />}
          </CardContent>
        </Card>
      </section>

      <Card className="metric-card border-sky-200 bg-sky-50/70">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base text-sky-950">
                <BookOpenCheck className="h-5 w-5 text-teal" />
                ข้อสังเกต HBV/HDV สำหรับการติดตาม
              </CardTitle>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-sky-900/80">
                {HBV_HDV_MONITORING_INSIGHT.summary}
              </p>
            </div>
            <a
              href={HBV_HDV_MONITORING_INSIGHT.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-200 bg-white/70 px-3 py-1 text-xs font-medium text-sky-900 hover:bg-white"
            >
              <BookOpenCheck className="h-3.5 w-3.5" />
              {HBV_HDV_MONITORING_INSIGHT.evidenceDate}
            </a>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_.9fr]">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-sky-900/70">
              ใช้ในงานติดตาม
            </div>
            <div className="grid gap-2">
              {HBV_HDV_MONITORING_INSIGHT.operationalUse.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-2 rounded-lg border border-sky-200 bg-white/70 p-3 text-sm text-sky-950"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-900/70">
                <Activity className="h-3.5 w-3.5" />
                ตัวชี้วัดที่ควรพิจารณาร่วมกัน
              </div>
              <div className="flex flex-wrap gap-2">
                {HBV_HDV_MONITORING_INSIGHT.markers.map((marker) => (
                  <Badge
                    key={marker}
                    variant="outline"
                    className="border-sky-200 bg-white/80 text-sky-900"
                  >
                    {marker}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              {HBV_HDV_MONITORING_INSIGHT.disclaimer}
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-3">
        <Card className="metric-card">
          <CardHeader>
            <CardTitle className="text-base">ลิงก์ยืนยันล่าสุด</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data?.invites.slice(0, 8).map((item) => (
              <div key={item.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs">{item.hn}</span>
                  <Badge variant="outline">{inviteStatusLabel(item.status)}</Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  หมดอายุ {new Date(item.expiresAt).toLocaleString("th-TH")}
                </div>
              </div>
            ))}
            {!data?.invites.length && <EmptyLine text="ยังไม่มีลิงก์ยืนยัน" />}
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardHeader>
            <CardTitle className="text-base">การผูกบัญชี LINE</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data?.identities.slice(0, 8).map((item) => (
              <div key={item.lineUserId} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs">{item.hn || "-"}</span>
                  <Badge variant="outline">{identityRoleLabel(item.role)}</Badge>
                </div>
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  {item.displayName || maskLineUserId(item.lineUserId)}
                </div>
              </div>
            ))}
            {!data?.identities.length && <EmptyLine text="ยังไม่มีการผูก LINE" />}
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardHeader>
            <CardTitle className="text-base">งานติดตามอัตโนมัติ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isFetching && <div className="text-xs text-muted-foreground">กำลังอัปเดต...</div>}
            {data?.tasks.slice(0, 8).map((item) => (
              <div key={item.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs">{item.hn}</span>
                  <Badge variant="outline">{taskStatusLabel(item.status)}</Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{item.message}</div>
              </div>
            ))}
            {!data?.tasks.length && <EmptyLine text="ยังไม่มีงานค้าง" />}
          </CardContent>
        </Card>
      </section>

      <Card className="metric-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PlayCircle className="h-5 w-5 text-teal" />
            บันทึกการทำงาน
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data?.audit.slice(0, 12).map((item) => (
            <div
              key={item.id}
              className="grid gap-2 rounded-lg border p-3 text-sm md:grid-cols-[180px_140px_1fr]"
            >
              <div className="text-xs text-muted-foreground">
                {new Date(item.at).toLocaleString("th-TH")}
              </div>
              <div className="text-xs font-medium">{auditActionLabel(item.action)}</div>
              <div className="text-xs text-muted-foreground">{item.detail}</div>
            </div>
          ))}
          {!data?.audit.length && <EmptyLine text="ยังไม่มีบันทึกการทำงาน" />}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}
