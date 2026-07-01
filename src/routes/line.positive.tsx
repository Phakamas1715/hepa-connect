import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, CheckCircle2, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type LineProfile = {
  userId: string;
  displayName?: string;
};

type PositiveFacility = {
  code: string;
  name: string;
};

type PositiveSummary = {
  facilities: PositiveFacility[];
  resultOptions: string[];
};

type PositiveRecord = {
  caseCode: string;
  fullName: string;
  testFacilityName: string;
  positiveResult: string;
  consentAcceptedAt: string;
  agentTaskId?: string;
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

export const Route = createFileRoute("/line/positive")({
  component: LinePositivePage,
});

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

async function fetchSummary(): Promise<PositiveSummary> {
  const response = await fetch("/api/positive-intake");
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || "โหลดข้อมูลสถานบริการไม่สำเร็จ");
  return data;
}

function LinePositivePage() {
  const search = useSearch({ from: "/line/positive" }) as {
    lineUserId?: string;
    displayName?: string;
  };
  const liffId = (import.meta.env.VITE_POSITIVE_LIFF_ID ||
    import.meta.env.VITE_PATIENT_LIFF_ID ||
    import.meta.env.VITE_LIFF_ID) as string | undefined;
  const [profile, setProfile] = useState<LineProfile | null>(null);
  const [record, setRecord] = useState<PositiveRecord | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    testFacilityCode: "",
    positiveResult: "ไม่แน่ใจ/รอเจ้าหน้าที่ตรวจสอบ",
    consentAccepted: false,
  });
  const summary = useQuery({ queryKey: ["positive-intake-summary"], queryFn: fetchSummary });

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
      lineUserId: profile?.userId || search.lineUserId,
      lineDisplayName: profile?.displayName || search.displayName,
    }),
    [profile, search.displayName, search.lineUserId],
  );

  const selectedFacility = summary.data?.facilities.find(
    (item) => item.code === form.testFacilityCode,
  );
  const canSubmit = Boolean(
    form.fullName.trim() && form.testFacilityCode && form.consentAccepted && !summary.isLoading,
  );

  const submit = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/positive-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          testFacilityName: selectedFacility?.name,
          ...resolvedLine,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "ส่งข้อมูลไม่สำเร็จ");
      return data.record as PositiveRecord;
    },
    onSuccess: (next) => {
      setRecord(next);
      toast.success("ส่งข้อมูลให้ทีมดูแลแล้ว");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "ส่งข้อมูลไม่สำเร็จ"),
  });

  return (
    <div className="min-h-screen bg-slate-950 px-3 py-4 sm:px-4">
      <div className="mx-auto min-h-[calc(100vh-2rem)] max-w-md overflow-hidden rounded-[2rem] border border-slate-800 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 bg-[#06C755] px-4 py-3.5 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-white/20">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-sm font-black leading-tight">แจ้งข้อมูลผู้พบเชื้อ</h1>
                <p className="text-[10px] font-semibold text-green-50">
                  ยืนยันชื่อ สถานบริการที่ตรวจ และความยินยอม PDPA
                </p>
              </div>
            </div>
            <Badge className="bg-emerald-700/60 text-[9px] hover:bg-emerald-700/60">LIFF</Badge>
          </div>
        </div>

        <main className="space-y-4 p-4 pb-8">
          {record ? (
            <Card className="border-emerald-200 bg-emerald-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-emerald-950">
                  <CheckCircle2 className="h-5 w-5" />
                  ส่งข้อมูลสำเร็จ
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-emerald-950">
                <div className="rounded-xl border border-emerald-200 bg-white p-4 text-center">
                  <div className="text-xs text-slate-500">รหัสติดตาม</div>
                  <div className="mt-1 text-2xl font-black tracking-wide">{record.caseCode}</div>
                </div>
                <div className="space-y-2 rounded-lg border bg-white p-3 text-sm">
                  <div className="font-semibold">{record.fullName}</div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Building2 className="h-4 w-4 text-[#06C755]" />
                    {record.testFacilityName}
                  </div>
                  <div>ผลที่แจ้ง: {record.positiveResult}</div>
                  <div className="text-xs text-slate-500">
                    บันทึก PDPA: {new Date(record.consentAcceptedAt).toLocaleString("th-TH")}
                  </div>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-white p-3 text-xs leading-5">
                  ระบบสร้างงานให้ Agent/เจ้าหน้าที่ติดตามต่อแล้ว
                  เจ้าหน้าที่จะตรวจสอบข้อมูลและติดต่อกลับตามขั้นตอนของหน่วยบริการ
                </div>
                <Button
                  variant="outline"
                  className="w-full bg-white"
                  onClick={() => {
                    setRecord(null);
                    setForm({
                      fullName: "",
                      testFacilityCode: "",
                      positiveResult: "ไม่แน่ใจ/รอเจ้าหน้าที่ตรวจสอบ",
                      consentAccepted: false,
                    });
                  }}
                >
                  ส่งข้อมูลรายใหม่
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">ข้อมูลผู้พบเชื้อ</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    value={form.fullName}
                    onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                    placeholder="ชื่อ-นามสกุล *"
                  />
                  <select
                    className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                    value={form.testFacilityCode}
                    onChange={(event) => setForm({ ...form, testFacilityCode: event.target.value })}
                  >
                    <option value="">เลือกสถานบริการที่ตรวจ *</option>
                    {summary.data?.facilities.map((facility) => (
                      <option key={facility.code} value={facility.code}>
                        {facility.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                    value={form.positiveResult}
                    onChange={(event) => setForm({ ...form, positiveResult: event.target.value })}
                  >
                    {summary.data?.resultOptions.map((result) => (
                      <option key={result} value={result}>
                        {result}
                      </option>
                    ))}
                  </select>
                  <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-900">
                    ระบบใช้ข้อมูลนี้เพื่อให้เจ้าหน้าที่ตรวจสอบผลบวก ประสานสถานบริการที่ตรวจ
                    และจัดคิวติดตามต่อ ไม่ใช่การวินิจฉัยใหม่
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">ความยินยอม PDPA</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <label className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-950">
                    <input
                      type="checkbox"
                      checked={form.consentAccepted}
                      onChange={(event) =>
                        setForm({ ...form, consentAccepted: event.target.checked })
                      }
                      className="mt-1"
                    />
                    <span>
                      ข้าพเจ้ายินยอมให้โครงการน้ำพองรักตับเก็บ ใช้ และเปิดเผยข้อมูลที่จำเป็น ได้แก่
                      ชื่อ-นามสกุล สถานบริการที่ตรวจ ข้อมูล LINE และผลที่แจ้ง
                      เพื่อให้เจ้าหน้าที่ตรวจสอบ ประสานการดูแล และติดตามต่ออย่างเหมาะสม
                    </span>
                  </label>
                  <Button
                    disabled={!canSubmit || submit.isPending}
                    onClick={() => submit.mutate()}
                    className="w-full gap-2"
                  >
                    {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    ส่งข้อมูลให้ทีมดูแล
                  </Button>
                </CardContent>
              </Card>
            </>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-600">
            <div className="mb-1 flex items-center gap-2 font-bold text-slate-800">
              <Smartphone className="h-4 w-4 text-[#06C755]" />
              หมายเหตุ
            </div>
            หากเปิดผ่าน LINE ระบบจะอ่านบัญชี LINE เพื่อให้เจ้าหน้าที่ติดต่อกลับได้ถูกต้อง
            ข้อมูลนี้ใช้เพื่อการติดตามดูแล ไม่แสดงผลต่อสาธารณะ
          </div>
        </main>
      </div>
    </div>
  );
}
