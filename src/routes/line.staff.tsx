import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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

export const Route = createFileRoute("/line/staff")({
  component: LineStaffPage,
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

async function loadLiffSdk() {
  if (window.liff) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://static.line-scdn.net/liff/edge/2/sdk.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("โหลด LIFF SDK ไม่สำเร็จ")), { once: true });
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

function LineStaffPage() {
  const search = useSearch({ from: "/line/staff" }) as { lineUserId?: string; displayName?: string };
  const liffId = (import.meta.env.VITE_STAFF_LIFF_ID || import.meta.env.VITE_LIFF_ID) as string | undefined;
  const [profile, setProfile] = useState<LineProfile | null>(null);
  const [manualLineUserId, setManualLineUserId] = useState(search.lineUserId || "");
  const [manualDisplayName, setManualDisplayName] = useState(search.displayName || "");

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
      lineUserId: profile?.userId || manualLineUserId.trim(),
      displayName: profile?.displayName || manualDisplayName.trim(),
    }),
    [manualDisplayName, manualLineUserId, profile],
  );

  const mutation = useMutation({
    mutationFn: () =>
      postAgent("verify_staff", {
        lineUserId: resolvedLine.lineUserId,
        displayName: resolvedLine.displayName,
      }),
    onSuccess: () => toast.success("บันทึก LINE เจ้าหน้าที่สำเร็จ"),
    onError: (error) => toast.error(error instanceof Error ? error.message : "ยืนยันไม่สำเร็จ"),
  });

  const done = mutation.isSuccess;
  const canConfirm = Boolean(resolvedLine.lineUserId && !mutation.isPending);

  return (
    <div className="mx-auto grid min-h-screen max-w-xl place-items-center px-4 py-8">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-teal" />
            ยืนยัน LINE เจ้าหน้าที่
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {done ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-5 w-5" />
                บันทึกเจ้าหน้าที่สำเร็จ
              </div>
              <p className="mt-2 text-sm leading-6">ระบบบันทึก LINE นี้เป็นบัญชีเจ้าหน้าที่เรียบร้อยแล้ว</p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-teal/20 bg-teal/5 p-4">
                <div className="flex items-start gap-3">
                  <Smartphone className="mt-1 h-5 w-5 text-teal" />
                  <div>
                    <div className="font-semibold">ขั้นตอนเจ้าหน้าที่: เปิด LIFF แล้วกดยืนยัน</div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      ระบบจะอ่าน LINE userId จาก LIFF และบันทึกเป็นบัญชีเจ้าหน้าที่ โดยไม่ผูกกับ HN ผู้ป่วย
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-start gap-2">
                  <Smartphone className="mt-0.5 h-4 w-4 text-teal" />
                  <div className="text-sm">
                    <div className="font-semibold">
                      {profile ? "อ่าน LINE profile แล้ว" : liffId ? "รอ LINE login" : "โหมดทดสอบ"}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-muted-foreground">
                      {profile
                        ? `LINE: ${profile.displayName || profile.userId}`
                        : liffId
                          ? "ถ้าเปิดใน LINE ระบบจะขออนุญาตและดึง userId ให้อัตโนมัติ"
                          : "ยังไม่ได้ตั้งค่า LIFF ID จึงแสดงช่องทดสอบสำหรับเจ้าหน้าที่"}
                    </div>
                  </div>
                </div>
              </div>

              {!liffId && !profile && (
                <div className="space-y-3 rounded-lg border border-dashed p-3">
                  <div className="text-xs font-semibold text-muted-foreground">ช่องทดสอบสำหรับ local เท่านั้น</div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">LINE userId จาก webhook/test tool</label>
                    <Input value={manualLineUserId} onChange={(event) => setManualLineUserId(event.target.value)} placeholder="Uxxxxxxxxxxxxxxxxxxxx" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">ชื่อใน LINE</label>
                    <Input value={manualDisplayName} onChange={(event) => setManualDisplayName(event.target.value)} placeholder="ไม่บังคับ" />
                  </div>
                </div>
              )}

              <Button className="w-full gap-2" disabled={!canConfirm} onClick={() => mutation.mutate()}>
                {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                ยืนยันเจ้าหน้าที่
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
