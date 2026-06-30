import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Copy, Link2, Loader2, PlayCircle, QrCode, Send, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/agent")({
  head: () => ({
    meta: [
      { title: "HEPA Agent Orchestrator — HEPA-GLUE Engine" },
      {
        name: "description",
        content: "ระบบจัดการ LINE invite, การผูกตัวตน และคิวติดตาม care gap",
      },
    ],
  }),
  component: AgentPage,
});

type Store = {
  invites: Array<{ id: string; hn: string; patientName?: string; status: string; expiresAt: string; usedAt?: string }>;
  identities: Array<{ lineUserId: string; hn?: string; role: string; displayName?: string; verifiedAt: string; status: string }>;
  tasks: Array<{ id: string; hn: string; type: string; status: string; message?: string; lineUserId?: string; createdAt: string }>;
  audit: Array<{ id: string; at: string; actor: string; action: string; hn?: string; detail: string }>;
};

async function fetchStore(): Promise<Store> {
  const response = await fetch("/api/agent-orchestrator");
  if (!response.ok) throw new Error("โหลดสถานะ agent ไม่สำเร็จ");
  return response.json();
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

function AgentPage() {
  const [hn, setHn] = useState("");
  const [patientName, setPatientName] = useState("");
  const [latestLink, setLatestLink] = useState("");
  const { data, refetch, isFetching } = useQuery({ queryKey: ["agent-store"], queryFn: fetchStore });

  const createInvite = useMutation({
    mutationFn: () => postAgent("create_invite", { hn, patientName }),
    onSuccess: (result) => {
      setLatestLink(result.link);
      toast.success("สร้างลิงก์ผูก LINE แล้ว");
      refetch();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "สร้างลิงก์ไม่สำเร็จ"),
  });

  const queueNudge = useMutation({
    mutationFn: () => postAgent("queue_nudge", { hn, persona: "The Engaged" }),
    onSuccess: (result) => {
      toast.success(result.task?.status === "blocked" ? "สร้าง task แล้ว แต่ยังไม่มี LINE identity" : "จัดคิวส่ง LINE แล้ว");
      refetch();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "จัดคิวไม่สำเร็จ"),
  });

  const sendNudge = useMutation({
    mutationFn: () => postAgent("send_nudge", { hn, persona: "The Engaged", messageType: "LINE_NUDGE" }),
    onSuccess: (result) => {
      toast.success(result.status === "sent" ? "ส่งข้อความ LINE แล้ว" : result.line?.message || "ยังไม่ได้ส่งข้อความ LINE");
      refetch();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "ส่ง LINE ไม่สำเร็จ"),
  });

  const copyLink = async () => {
    await navigator.clipboard.writeText(latestLink);
    toast.success("คัดลอกลิงก์แล้ว");
  };

  return (
    <div className="page-shell">
      <header className="page-header">
        <div className="page-eyebrow">
          <ShieldCheck className="h-3.5 w-3.5" />
          HEPA Agent Orchestrator
        </div>
        <h1 className="page-title">ระบบติดตามผ่าน LINE</h1>
        <p className="page-description">
          จัดการลิงก์/QR สำหรับผูก LINE กับ HN, จัดคิวติดตาม care gap และบันทึก audit log ก่อนส่งข้อความ
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
        <Card className="metric-card">
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
                <Input value={hn} onChange={(event) => setHn(event.target.value)} placeholder="เช่น 0001234" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">ชื่อผู้ป่วย</label>
                <Input value={patientName} onChange={(event) => setPatientName(event.target.value)} placeholder="ระบุเพื่อแสดงในรายการ" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={!hn || createInvite.isPending} onClick={() => createInvite.mutate()} className="gap-2">
                {createInvite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                สร้าง QR
              </Button>
              <Button disabled={!hn || queueNudge.isPending} onClick={() => queueNudge.mutate()} variant="outline" className="gap-2">
                <Send className="h-4 w-4" />
                จัดคิวติดตาม
              </Button>
              <Button disabled={!hn || sendNudge.isPending} onClick={() => sendNudge.mutate()} variant="outline" className="gap-2">
                {sendNudge.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
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
                      ใช้ QR นี้สำหรับผูก LINE กับ HN ตามสิทธิ์ที่ผู้ป่วยยืนยันใน LIFF
                    </div>
                    <div className="mt-2 break-all text-xs">{latestLink}</div>
                    <Button size="sm" variant="outline" onClick={copyLink} className="mt-3 gap-2 bg-white/70">
                      <Copy className="h-3.5 w-3.5" />
                      คัดลอกลิงก์
                    </Button>
                  </div>
                </div>
              </div>
            )}
            <div className="rounded-lg border bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
              ขั้นตอนมาตรฐาน: เลือก HN → สร้าง QR → ผู้ป่วยยืนยันใน LINE → ระบบบันทึก mapping สำหรับการติดตาม
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
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border bg-background/60 p-3">
              <div className="text-2xl font-bold">{data?.invites.length || 0}</div>
              <div className="text-xs text-muted-foreground">invite ทั้งหมด</div>
            </div>
            <div className="rounded-2xl border bg-background/60 p-3">
              <div className="text-2xl font-bold">{data?.identities.length || 0}</div>
              <div className="text-xs text-muted-foreground">LINE identity</div>
            </div>
            <div className="rounded-2xl border bg-background/60 p-3">
              <div className="text-2xl font-bold">{data?.tasks.length || 0}</div>
              <div className="text-xs text-muted-foreground">agent tasks</div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Card className="metric-card">
          <CardHeader>
            <CardTitle className="text-base">Invite ล่าสุด</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data?.invites.slice(0, 8).map((item) => (
              <div key={item.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs">{item.hn}</span>
                  <Badge variant="outline">{item.status}</Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">หมดอายุ {new Date(item.expiresAt).toLocaleString("th-TH")}</div>
              </div>
            ))}
            {!data?.invites.length && <EmptyLine text="ยังไม่มี invite" />}
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardHeader>
            <CardTitle className="text-base">Identity map</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data?.identities.slice(0, 8).map((item) => (
              <div key={item.lineUserId} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs">{item.hn || "-"}</span>
                  <Badge variant="outline">{item.role}</Badge>
                </div>
                <div className="mt-1 truncate text-xs text-muted-foreground">{item.lineUserId}</div>
              </div>
            ))}
            {!data?.identities.length && <EmptyLine text="ยังไม่มีการผูก LINE" />}
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardHeader>
            <CardTitle className="text-base">Agent tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isFetching && <div className="text-xs text-muted-foreground">กำลังอัปเดต...</div>}
            {data?.tasks.slice(0, 8).map((item) => (
              <div key={item.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs">{item.hn}</span>
                  <Badge variant="outline">{item.status}</Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{item.message}</div>
              </div>
            ))}
            {!data?.tasks.length && <EmptyLine text="ยังไม่มี task" />}
          </CardContent>
        </Card>
      </section>

      <Card className="metric-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PlayCircle className="h-5 w-5 text-teal" />
            Audit log
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data?.audit.slice(0, 12).map((item) => (
            <div key={item.id} className="grid gap-2 rounded-lg border p-3 text-sm md:grid-cols-[180px_140px_1fr]">
              <div className="text-xs text-muted-foreground">{new Date(item.at).toLocaleString("th-TH")}</div>
              <div className="font-mono text-xs">{item.action}</div>
              <div className="text-xs text-muted-foreground">{item.detail}</div>
            </div>
          ))}
          {!data?.audit.length && <EmptyLine text="ยังไม่มี audit log" />}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">{text}</div>;
}
