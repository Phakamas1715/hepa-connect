import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, ScanLine, ShieldCheck, Smartphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type InvitePreview = {
  id: string;
  hn: string;
  patientName?: string;
  status: string;
  expiresAt: string;
  usedAt?: string;
};

type LineProfile = {
  userId: string;
  displayName?: string;
};

declare global {
  interface Window {
    liff?: {
      init: (input: { liffId: string }) => Promise<void>;
      isLoggedIn: () => boolean;
      login: () => void;
      getProfile: () => Promise<LineProfile>;
    };
  }
}

export const Route = createFileRoute("/line/link")({
  component: LineLinkPage,
});

async function postAgent(action: string, payload: Record<string, unknown>) {
  const response = await fetch("/api/agent-orchestrator", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || "ดำเนินการไม่สำเร็จ");
  return data;
}

async function inspectInvite(token?: string): Promise<InvitePreview> {
  if (!token) throw new Error("ลิงก์นี้ไม่มี token");
  const data = await postAgent("inspect_invite", { token });
  return data.invite;
}

async function loadLiffSdk() {
  if (window.liff) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://static.line-scdn.net/liff/edge/2/sdk.js"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("โหลด LIFF SDK ไม่สำเร็จ")), {
        once: true,
      });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("โหลด LIFF SDK ไม่สำเร็จ"));
    document.head.appendChild(script);
  });
}

async function getLiffProfile(liffId: string): Promise<LineProfile> {
  await loadLiffSdk();
  if (!window.liff) throw new Error("ไม่พบ LIFF SDK");
  await window.liff.init({ liffId });
  if (!window.liff.isLoggedIn()) {
    window.liff.login();
    throw new Error("กำลังเปิด LINE login");
  }
  return window.liff.getProfile();
}

function maskHn(hn?: string) {
  if (!hn) return "-";
  if (hn.length <= 4) return hn;
  return `${hn.slice(0, 2)}${"*".repeat(Math.max(2, hn.length - 5))}${hn.slice(-3)}`;
}

function LineLinkPage() {
  const search = useSearch({ from: "/line/link" }) as {
    token?: string;
    lineUserId?: string;
    displayName?: string;
  };
  const liffId = (import.meta.env.VITE_PATIENT_LIFF_ID || import.meta.env.VITE_LIFF_ID) as
    | string
    | undefined;
  const [profile, setProfile] = useState<LineProfile | null>(null);
  const allowTestIdentity = import.meta.env.DEV && !liffId;
  const [manualLineUserId, setManualLineUserId] = useState(
    allowTestIdentity ? search.lineUserId || "" : "",
  );
  const [manualDisplayName, setManualDisplayName] = useState(
    allowTestIdentity ? search.displayName || "" : "",
  );

  const invite = useQuery({
    queryKey: ["line-invite", search.token],
    queryFn: () => inspectInvite(search.token),
    retry: false,
  });

  useEffect(() => {
    if (!liffId) return;
    getLiffProfile(liffId)
      .then(setProfile)
      .catch((error) => {
        if (!(error instanceof Error) || error.message !== "กำลังเปิด LINE login") {
          toast.error(error instanceof Error ? error.message : "อ่าน LINE profile ไม่สำเร็จ");
        }
      });
  }, [liffId]);

  const resolvedLine = useMemo(
    () => ({
      lineUserId: profile?.userId || (allowTestIdentity ? manualLineUserId.trim() : ""),
      displayName: profile?.displayName || (allowTestIdentity ? manualDisplayName.trim() : ""),
    }),
    [allowTestIdentity, manualDisplayName, manualLineUserId, profile],
  );

  const mutation = useMutation({
    mutationFn: () =>
      postAgent("verify_invite", {
        token: search.token,
        hn: invite.data?.hn,
        lineUserId: resolvedLine.lineUserId,
        displayName: resolvedLine.displayName,
        role: "patient",
      }),
    onSuccess: () => toast.success("ผูก LINE กับ HN สำเร็จ"),
    onError: (error) => toast.error(error instanceof Error ? error.message : "ยืนยันไม่สำเร็จ"),
  });

  const done = mutation.isSuccess;
  const canConfirm = Boolean(
    search.token && invite.data?.hn && resolvedLine.lineUserId && !mutation.isPending,
  );

  return (
    <div className="mx-auto grid min-h-screen max-w-xl place-items-center px-4 py-8">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-teal" />
            ยืนยัน LINE สำหรับน้ำพองรักตับ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {done ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-5 w-5" />
                ผูกตัวตนสำเร็จ
              </div>
              <p className="mt-2 text-sm leading-6">
                ระบบบันทึก LINE สำหรับการติดตามผู้ป่วยเรียบร้อยแล้ว
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-teal/20 bg-teal/5 p-4">
                <div className="flex items-start gap-3">
                  <ScanLine className="mt-1 h-5 w-5 text-teal" />
                  <div>
                    <div className="font-semibold">ยืนยันบัญชี LINE สำหรับรับการติดตาม</div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      กรุณาตรวจสอบข้อมูลด้านล่าง แล้วกดยืนยันเพื่อรับข้อความติดตามและบัตรนัดผ่าน
                      LINE
                    </p>
                  </div>
                </div>
              </div>

              {invite.isLoading && (
                <div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  กำลังตรวจลิงก์เชิญ
                </div>
              )}
              {invite.error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {invite.error instanceof Error ? invite.error.message : "ลิงก์เชิญไม่ถูกต้อง"}
                </div>
              )}

              {invite.data && (
                <div className="grid gap-2 rounded-lg border bg-card p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">หมายเลขผู้รับบริการ</span>
                    <span className="font-mono font-semibold">{maskHn(invite.data.hn)}</span>
                  </div>
                  {invite.data.patientName && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">ชื่อ</span>
                      <span className="font-semibold">{invite.data.patientName}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">หมดอายุ</span>
                    <span>{new Date(invite.data.expiresAt).toLocaleString("th-TH")}</span>
                  </div>
                </div>
              )}

              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-start gap-2">
                  <Smartphone className="mt-0.5 h-4 w-4 text-teal" />
                  <div className="text-sm">
                    <div className="font-semibold">
                      {profile
                        ? "ยืนยันบัญชี LINE แล้ว"
                        : liffId
                          ? "กำลังยืนยันบัญชี LINE"
                          : allowTestIdentity
                            ? "โหมดทดสอบ"
                            : "ยังไม่พร้อมให้บริการ"}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-muted-foreground">
                      {profile
                        ? `บัญชี LINE: ${profile.displayName || "ยืนยันแล้ว"}`
                        : liffId
                          ? "ระบบจะขออนุญาตเชื่อมบัญชี LINE โดยอัตโนมัติ"
                          : allowTestIdentity
                            ? "ใช้สำหรับทดสอบในเครื่องเท่านั้น"
                            : "กรุณาติดต่อเจ้าหน้าที่ เนื่องจากยังไม่ได้ตั้งค่าช่องทาง LINE"}
                    </div>
                  </div>
                </div>
              </div>

              {allowTestIdentity && !profile && (
                <div className="space-y-3 rounded-lg border border-dashed p-3">
                  <div className="text-xs font-semibold text-muted-foreground">
                    ช่องทดสอบสำหรับ local เท่านั้น
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      LINE userId จาก webhook/test tool
                    </label>
                    <Input
                      value={manualLineUserId}
                      onChange={(event) => setManualLineUserId(event.target.value)}
                      placeholder="Uxxxxxxxxxxxxxxxxxxxx"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">ชื่อใน LINE</label>
                    <Input
                      value={manualDisplayName}
                      onChange={(event) => setManualDisplayName(event.target.value)}
                      placeholder="ไม่บังคับ"
                    />
                  </div>
                </div>
              )}

              <Button
                className="w-full gap-2"
                disabled={!canConfirm}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                ยืนยันและผูก LINE
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
