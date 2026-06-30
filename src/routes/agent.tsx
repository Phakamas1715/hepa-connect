import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, BookOpenCheck, CheckCircle2, Copy, Link2, Loader2, PlayCircle, QrCode, Send, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { HBV_HDV_MONITORING_INSIGHT } from "@/lib/hepa-clinical-evidence";

export const Route = createFileRoute("/agent")({
  head: () => ({
    meta: [
      { title: "ตัวจัดการ Agent — HEPA-GLUE Engine" },
      {
        name: "description",
        content: "สร้าง QR ผูก LINE, จัดคิวติดตามผู้ป่วย และบันทึกการทำงานของ agent",
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
    mutationFn: () => postAgent("send_nudge", { hn, persona: "engaged", messageType: "LINE_NUDGE" }),
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
          ตัวจัดการ Agent
        </div>
        <h1 className="page-title">ติดตามผู้ป่วยผ่าน LINE</h1>
        <p className="page-description">
          สร้าง QR ผูกบัญชี LINE กับ HN จัดคิวแจ้งเตือนผู้ป่วยที่ยังติดตามไม่ครบ และบันทึกทุกขั้นตอนก่อนส่งข้อความ
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
              <div className="text-xs text-muted-foreground">คำเชิญทั้งหมด</div>
            </div>
            <div className="rounded-2xl border bg-background/60 p-3">
              <div className="text-2xl font-bold">{data?.identities.length || 0}</div>
              <div className="text-xs text-muted-foreground">บัญชี LINE ที่ผูกแล้ว</div>
            </div>
            <div className="rounded-2xl border bg-background/60 p-3">
              <div className="text-2xl font-bold">{data?.tasks.length || 0}</div>
              <div className="text-xs text-muted-foreground">งานที่รอดำเนินการ</div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="metric-card border-sky-200 bg-sky-50/70">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base text-sky-950">
                <BookOpenCheck className="h-5 w-5 text-teal" />
                {HBV_HDV_MONITORING_INSIGHT.title}
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
                <div key={item} className="flex items-start gap-2 rounded-lg border border-sky-200 bg-white/70 p-3 text-sm text-sky-950">
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
                marker ที่ควรดูร่วมกัน
              </div>
              <div className="flex flex-wrap gap-2">
                {HBV_HDV_MONITORING_INSIGHT.markers.map((marker) => (
                  <Badge key={marker} variant="outline" className="border-sky-200 bg-white/80 text-sky-900">
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
            <CardTitle className="text-base">คำเชิญล่าสุด</CardTitle>
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
            {!data?.invites.length && <EmptyLine text="ยังไม่มีคำเชิญ" />}
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
            <CardTitle className="text-base">งานของ Agent</CardTitle>
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
            <div key={item.id} className="grid gap-2 rounded-lg border p-3 text-sm md:grid-cols-[180px_140px_1fr]">
              <div className="text-xs text-muted-foreground">{new Date(item.at).toLocaleString("th-TH")}</div>
              <div className="font-mono text-xs">{item.action}</div>
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
  return <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">{text}</div>;
}
