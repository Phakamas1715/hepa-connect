import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Building2,
  Check,
  CheckCircle2,
  Loader2,
  Search,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
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

const DEFAULT_POSITIVE_RESULT = "ไม่แน่ใจ / รอผลยืนยัน";

type PositiveRecord = {
  caseCode: string;
  fullName: string;
  testFacilityName: string;
  positiveResult: string;
  consentAcceptedAt: string;
  agentTaskId?: string;
  patientIdentityStatus?: "verified" | "blocked";
  patientIdentityReason?: string;
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
  const [profileError, setProfileError] = useState("");
  const [record, setRecord] = useState<PositiveRecord | null>(null);
  const [facilityQuery, setFacilityQuery] = useState("");
  const [facilityOpen, setFacilityOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    testFacilityCode: "",
    positiveResult: DEFAULT_POSITIVE_RESULT,
    consentAccepted: false,
  });
  const summary = useQuery({ queryKey: ["positive-intake-summary"], queryFn: fetchSummary });

  useEffect(() => {
    if (!liffId) return;
    getLiffProfile(liffId)
      .then((nextProfile) => {
        setProfile(nextProfile);
        setProfileError("");
      })
      .catch((error) => {
        if (!(error instanceof Error) || error.message !== "กำลังเปิด LINE login") {
          const message = error instanceof Error ? error.message : "อ่านบัญชี LINE ไม่สำเร็จ";
          setProfileError(message);
          toast.error(message);
        }
      });
  }, [liffId]);

  const allowTestIdentity = import.meta.env.DEV && !liffId;
  const identityUnavailable = !liffId && !allowTestIdentity;
  const resolvedLine = useMemo(
    () => ({
      lineUserId: profile?.userId || (allowTestIdentity ? search.lineUserId : undefined),
      lineDisplayName: profile?.displayName || (allowTestIdentity ? search.displayName : undefined),
    }),
    [allowTestIdentity, profile, search.displayName, search.lineUserId],
  );

  const selectedFacility = summary.data?.facilities.find(
    (item) => item.code === form.testFacilityCode,
  );
  const filteredFacilities = useMemo(() => {
    const query = facilityQuery.trim().toLocaleLowerCase("th");
    const facilities = summary.data?.facilities || [];
    if (!query) return facilities;
    return facilities.filter(
      (facility) =>
        facility.name.toLocaleLowerCase("th").includes(query) ||
        facility.code.toLocaleLowerCase("th").includes(query),
    );
  }, [facilityQuery, summary.data?.facilities]);
  const canSubmit = Boolean(
    form.fullName.trim() &&
    form.testFacilityCode &&
    form.consentAccepted &&
    resolvedLine.lineUserId &&
    !summary.isLoading,
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
            <Badge className="bg-emerald-700/60 text-[9px] hover:bg-emerald-700/60">
              ผ่าน LINE
            </Badge>
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
                  {record.patientIdentityStatus === "verified"
                    ? "บัญชี LINE พร้อมรับข้อความติดตามและบัตรนัดแล้ว "
                    : "ระบบส่งข้อมูลเข้าคิวเจ้าหน้าที่แล้ว "}
                  เจ้าหน้าที่จะตรวจสอบข้อมูลและติดต่อกลับตามขั้นตอนของหน่วยบริการ
                </div>
                {record.patientIdentityStatus === "blocked" && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                    บัญชี LINE ยังรับบัตรนัดไม่ได้:{" "}
                    {record.patientIdentityReason || "เจ้าหน้าที่ต้องตรวจสอบการเชื่อมบัญชี"}
                  </div>
                )}
                <Button
                  variant="outline"
                  className="w-full bg-white"
                  onClick={() => {
                    setRecord(null);
                    setForm({
                      fullName: "",
                      testFacilityCode: "",
                      positiveResult: DEFAULT_POSITIVE_RESULT,
                      consentAccepted: false,
                    });
                    setFacilityQuery("");
                  }}
                >
                  ส่งข้อมูลรายใหม่
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div
                className={`rounded-xl border p-3 text-xs leading-5 ${
                  profile
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : profileError
                      ? "border-rose-200 bg-rose-50 text-rose-900"
                      : "border-sky-200 bg-sky-50 text-sky-900"
                }`}
              >
                <div className="font-bold">
                  {profile
                    ? `ยืนยันบัญชี LINE แล้ว${profile.displayName ? `: ${profile.displayName}` : ""}`
                    : identityUnavailable
                      ? "ยังไม่พร้อมเปิดรับข้อมูล"
                      : profileError
                        ? "ยังยืนยันบัญชี LINE ไม่สำเร็จ"
                        : "กำลังยืนยันบัญชี LINE"}
                </div>
                {!profile && (
                  <div className="mt-1">
                    {identityUnavailable
                      ? "ระบบยังไม่ได้ตั้งค่าช่องทาง LINE สำหรับแบบฟอร์มนี้ กรุณาติดต่อเจ้าหน้าที่"
                      : profileError ||
                        "หากระบบเปิดหน้าเข้าสู่ระบบ LINE กรุณาอนุญาต แล้วกลับมากรอกแบบฟอร์มนี้"}
                  </div>
                )}
              </div>
              {summary.isError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-900">
                  โหลดรายชื่อสถานบริการไม่สำเร็จ กรุณาปิดแล้วเปิดแบบฟอร์มอีกครั้ง
                </div>
              )}
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
                  <div className="space-y-1.5">
                    <label
                      htmlFor="positive-facility"
                      className="text-xs font-semibold text-slate-700"
                    >
                      สถานบริการที่ตรวจ <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                      <Input
                        id="positive-facility"
                        role="combobox"
                        aria-autocomplete="list"
                        aria-expanded={facilityOpen}
                        aria-controls="positive-facility-options"
                        autoComplete="off"
                        value={facilityQuery}
                        onFocus={() => setFacilityOpen(true)}
                        onBlur={() => window.setTimeout(() => setFacilityOpen(false), 150)}
                        onChange={(event) => {
                          const value = event.target.value;
                          setFacilityQuery(value);
                          setFacilityOpen(true);
                          if (value !== selectedFacility?.name) {
                            setForm((current) => ({ ...current, testFacilityCode: "" }));
                          }
                        }}
                        placeholder="พิมพ์ชื่อ รพ.สต. เพื่อค้นหา"
                        className="h-11 pl-9"
                      />
                      {facilityOpen && (
                        <div
                          id="positive-facility-options"
                          role="listbox"
                          className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
                        >
                          {summary.isLoading ? (
                            <div className="flex items-center justify-center gap-2 px-3 py-4 text-xs text-slate-500">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              กำลังโหลดสถานบริการ
                            </div>
                          ) : filteredFacilities.length ? (
                            filteredFacilities.map((facility) => (
                              <button
                                key={facility.code}
                                type="button"
                                role="option"
                                aria-selected={facility.code === form.testFacilityCode}
                                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-emerald-50 focus:bg-emerald-50 focus:outline-none"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                  setForm((current) => ({
                                    ...current,
                                    testFacilityCode: facility.code,
                                  }));
                                  setFacilityQuery(facility.name);
                                  setFacilityOpen(false);
                                }}
                              >
                                <span>
                                  <span className="block font-semibold text-slate-800">
                                    {facility.name}
                                  </span>
                                  <span className="text-[11px] text-slate-500">
                                    รหัส {facility.code}
                                  </span>
                                </span>
                                {facility.code === form.testFacilityCode && (
                                  <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                                )}
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-4 text-center text-xs text-slate-500">
                              ไม่พบสถานบริการ กรุณาตรวจสอบคำค้นหา
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {selectedFacility && (
                      <p className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        เลือก {selectedFacility.name} แล้ว
                      </p>
                    )}
                  </div>

                  <fieldset className="space-y-2">
                    <legend className="text-xs font-semibold text-slate-700">
                      ผลตรวจที่ได้รับแจ้ง
                    </legend>
                    <div className="grid gap-2">
                      {(summary.data?.resultOptions || [DEFAULT_POSITIVE_RESULT]).map((result) => {
                        const selected = form.positiveResult === result;
                        return (
                          <button
                            key={result}
                            type="button"
                            aria-pressed={selected}
                            onClick={() =>
                              setForm((current) => ({ ...current, positiveResult: result }))
                            }
                            className={`flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${
                              selected
                                ? "border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-100"
                                : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/60"
                            }`}
                          >
                            <span
                              className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                                selected
                                  ? "border-emerald-600 bg-emerald-600 text-white"
                                  : "border-slate-300 bg-white"
                              }`}
                            >
                              {selected && <Check className="h-3.5 w-3.5" />}
                            </span>
                            {result}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                  <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-900">
                    ระบบใช้ข้อมูลนี้เพื่อให้เจ้าหน้าที่ตรวจสอบผลบวก ประสานสถานบริการที่ตรวจ
                    และจัดคิวติดตามต่อ ไม่ใช่การวินิจฉัยใหม่
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">ความยินยอมให้ใช้ข้อมูลส่วนบุคคล</CardTitle>
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
                  {!resolvedLine.lineUserId && (
                    <p className="text-center text-xs leading-5 text-rose-700">
                      ต้องยืนยันบัญชี LINE ก่อนจึงจะส่งข้อมูลได้
                    </p>
                  )}
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
