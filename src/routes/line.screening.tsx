import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Award,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Loader2,
  QrCode,
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

type RiskFactors = {
  bornBefore2535: boolean;
  familyHistory: boolean;
  bloodTransfusion: boolean;
  drugUse: boolean;
  uncleanTattoo: boolean;
  multiplePartners: boolean;
  chronicLiverDisease: boolean;
};

type ScreeningUnit = {
  code: string;
  unitName: string;
  subdistrict: string;
  quota: number;
  booked: number;
  remaining: number;
  percentage: number;
};

type ScreeningSummary = {
  totalQuota: number;
  booked: number;
  remaining: number;
  percentage: number;
  units: ScreeningUnit[];
};

type Booking = {
  id: string;
  bookingCode: string;
  fullName: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  recommendation: string;
  selectedServiceUnit: { unitName: string; subdistrict: string };
  preferredDate?: string;
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

export const Route = createFileRoute("/line/screening")({
  component: LineScreeningPage,
});

const riskItems: Array<{ key: keyof RiskFactors; label: string }> = [
  { key: "familyHistory", label: "คนในครอบครัวเป็นไวรัสตับอักเสบหรือโรคตับ" },
  { key: "bloodTransfusion", label: "เคยรับเลือด/ผ่าตัด/หัตถการก่อนมาตรฐานคัดกรองปัจจุบัน" },
  { key: "drugUse", label: "เคยใช้เข็มหรืออุปกรณ์ร่วมกับผู้อื่น" },
  { key: "uncleanTattoo", label: "เคยสัก เจาะ หรือทำหัตถการที่ไม่มั่นใจความสะอาด" },
  { key: "multiplePartners", label: "มีประวัติเสี่ยงทางเพศสัมพันธ์" },
  { key: "chronicLiverDisease", label: "เคยมีโรคตับ/ค่าตับผิดปกติเรื้อรัง" },
];

const emptyRiskFactors: RiskFactors = {
  bornBefore2535: false,
  familyHistory: false,
  bloodTransfusion: false,
  drugUse: false,
  uncleanTattoo: false,
  multiplePartners: false,
  chronicLiverDisease: false,
};

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

async function fetchSummary(): Promise<ScreeningSummary> {
  const response = await fetch("/api/screening-bookings");
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || "โหลดโควตาไม่สำเร็จ");
  return data;
}

function riskLevelStyle(level: Booking["riskLevel"]) {
  if (level === "HIGH") return "border-red-200 bg-red-50 text-red-900";
  if (level === "MEDIUM") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-emerald-200 bg-emerald-50 text-emerald-900";
}

function LineScreeningPage() {
  const search = useSearch({ from: "/line/screening" }) as {
    lineUserId?: string;
    displayName?: string;
  };
  const liffId = import.meta.env.VITE_SCREENING_LIFF_ID as string | undefined;
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<LineProfile | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    birthYear: "",
    gender: "",
    idNumber: "",
    selectedServiceUnitCode: "",
    preferredDate: "",
    riskFactors: emptyRiskFactors,
  });
  const summary = useQuery({ queryKey: ["screening-summary"], queryFn: fetchSummary });

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

  useEffect(() => {
    const year = Number(form.birthYear);
    if (!year) return;
    setForm((prev) => ({
      ...prev,
      riskFactors: { ...prev.riskFactors, bornBefore2535: year <= 2535 },
    }));
  }, [form.birthYear]);

  const resolvedLine = useMemo(
    () => ({
      lineUserId: profile?.userId || search.lineUserId,
      lineDisplayName: profile?.displayName || search.displayName,
    }),
    [profile, search.displayName, search.lineUserId],
  );

  const selectedUnit = summary.data?.units.find((item) => item.code === form.selectedServiceUnitCode);
  const riskCount = riskItems.filter((item) => form.riskFactors[item.key]).length;

  const submitBooking = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/screening-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          birthYear: Number(form.birthYear),
          ...resolvedLine,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "บันทึกจองสิทธิ์ไม่สำเร็จ");
      return data.booking as Booking;
    },
    onSuccess: (next) => {
      setBooking(next);
      setStep(3);
      summary.refetch();
      toast.success("จองสิทธิ์คัดกรองสำเร็จ");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "จองสิทธิ์ไม่สำเร็จ"),
  });

  const canNextProfile = Boolean(form.fullName.trim() && form.phone.trim() && form.birthYear.trim());
  const canSubmit = Boolean(canNextProfile && form.selectedServiceUnitCode && !submitBooking.isPending);

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
                <h1 className="text-sm font-black leading-tight">คัดกรองไวรัสตับอักเสบ น้ำพอง</h1>
                <p className="text-[10px] font-semibold text-green-50">ประเมินสิทธิ์และจองคิวคัดกรอง</p>
              </div>
            </div>
            <Badge className="bg-emerald-700/60 text-[9px] hover:bg-emerald-700/60">LINE</Badge>
          </div>
        </div>

        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-4 py-3 text-white">
          <div className="flex items-center justify-between text-xs">
            <span>เป้าหมายโครงการ {summary.data?.totalQuota?.toLocaleString() || "2,500"} ราย</span>
            <span className="font-bold">{summary.data?.percentage ?? 0}%</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-white/25">
            <div
              className="h-2 rounded-full bg-white transition-all"
              style={{ width: `${summary.data?.percentage ?? 0}%` }}
            />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[10px]">
            <div className="rounded-lg bg-white/15 p-2">
              <div className="text-sm font-black">{summary.data?.booked ?? "-"}</div>
              <div>ลงทะเบียน</div>
            </div>
            <div className="rounded-lg bg-white/15 p-2">
              <div className="text-sm font-black">{summary.data?.remaining ?? "-"}</div>
              <div>คงเหลือ</div>
            </div>
            <div className="rounded-lg bg-white/15 p-2">
              <div className="text-sm font-black">{summary.data?.units?.length ?? "-"}</div>
              <div>หน่วยบริการ</div>
            </div>
          </div>
        </div>

        <main className="space-y-4 p-4 pb-8">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              {step < 3 ? `ขั้นตอน ${step + 1}/3` : "จองสำเร็จ"}
            </span>
            <div className="flex gap-1">
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className={`h-1.5 rounded-full transition-all ${
                    step === item ? "w-8 bg-[#06C755]" : step > item ? "w-4 bg-emerald-300" : "w-2 bg-slate-200"
                  }`}
                />
              ))}
            </div>
          </div>

          {step === 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">ข้อมูลผู้รับบริการ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="ชื่อ-นามสกุล *" />
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="เบอร์โทรศัพท์ *" inputMode="tel" />
                <div className="grid grid-cols-2 gap-2">
                  <Input value={form.birthYear} onChange={(e) => setForm({ ...form, birthYear: e.target.value })} placeholder="ปีเกิด พ.ศ. *" inputMode="numeric" />
                  <Input value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} placeholder="เพศ" />
                </div>
                <Input value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} placeholder="เลขบัตรประชาชน (ไม่บังคับ)" inputMode="numeric" />
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                  ระบบเก็บเฉพาะเลขท้ายบัตร 4 หลักเพื่อใช้ตรวจสอบหน้างาน ไม่เก็บเลขเต็มใน queue นี้
                </div>
                <Button disabled={!canNextProfile} onClick={() => setStep(1)} className="w-full gap-2">
                  ถัดไป <ChevronRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}

          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">ประเมินปัจจัยเสี่ยง</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border bg-slate-50 p-3 text-sm">
                  <div className="font-semibold">สิทธิ์ตามปีเกิด</div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    ผู้เกิดก่อนหรือเท่ากับ พ.ศ. 2535 เข้าเกณฑ์แนะนำให้คัดกรองไวรัสตับอักเสบ B/C
                  </p>
                  {form.riskFactors.bornBefore2535 && (
                    <Badge className="mt-2 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                      เข้าเกณฑ์ตามปีเกิด
                    </Badge>
                  )}
                </div>
                {riskItems.map((item) => (
                  <label key={item.key} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={form.riskFactors[item.key]}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          riskFactors: { ...form.riskFactors, [item.key]: e.target.checked },
                        })
                      }
                      className="mt-1"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
                <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
                  เลือกปัจจัยเสี่ยงแล้ว {riskCount} ข้อ ระบบจะใช้จัดระดับคำแนะนำเบื้องต้น
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => setStep(0)}>ย้อนกลับ</Button>
                  <Button onClick={() => setStep(2)}>ถัดไป</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">เลือกสถานบริการ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  type="date"
                  value={form.preferredDate}
                  onChange={(e) => setForm({ ...form, preferredDate: e.target.value })}
                />
                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {summary.isLoading && (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลดหน่วยบริการ
                    </div>
                  )}
                  {summary.data?.units.map((unit) => (
                    <button
                      key={unit.code}
                      type="button"
                      disabled={unit.remaining <= 0}
                      onClick={() => setForm({ ...form, selectedServiceUnitCode: unit.code })}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        form.selectedServiceUnitCode === unit.code
                          ? "border-[#06C755] bg-emerald-50"
                          : "border-slate-200 bg-white hover:border-emerald-200"
                      } ${unit.remaining <= 0 ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-bold text-slate-900">{unit.unitName}</div>
                          <div className="mt-1 text-xs text-slate-500">{unit.subdistrict}</div>
                        </div>
                        <Badge variant="outline">{unit.remaining > 0 ? `เหลือ ${unit.remaining}` : "เต็ม"}</Badge>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-slate-100">
                        <div className="h-1.5 rounded-full bg-[#06C755]" style={{ width: `${unit.percentage}%` }} />
                      </div>
                    </button>
                  ))}
                </div>
                {selectedUnit && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                    เลือก {selectedUnit.unitName} · คงเหลือ {selectedUnit.remaining} สิทธิ์
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => setStep(1)}>ย้อนกลับ</Button>
                  <Button disabled={!canSubmit} onClick={() => submitBooking.mutate()} className="gap-2">
                    {submitBooking.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    จองสิทธิ์
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 3 && booking && (
            <Card className="border-emerald-200 bg-emerald-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-emerald-950">
                  <CheckCircle2 className="h-5 w-5" />
                  จองสิทธิ์สำเร็จ
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-emerald-950">
                <div className="rounded-xl border border-emerald-200 bg-white p-4 text-center">
                  <div className="text-xs text-slate-500">รหัสคัดกรอง</div>
                  <div className="mt-1 text-2xl font-black tracking-wide">{booking.bookingCode}</div>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(booking.bookingCode)}`}
                    alt="QR booking code"
                    className="mx-auto mt-4 h-40 w-40 rounded-lg border bg-white p-2"
                  />
                </div>
                <div className={`rounded-lg border p-3 text-sm ${riskLevelStyle(booking.riskLevel)}`}>
                  <div className="font-bold">{booking.riskLevel === "HIGH" ? "เสี่ยงสูง" : booking.riskLevel === "MEDIUM" ? "เข้าเกณฑ์ตรวจฟรี" : "ความเสี่ยงทั่วไป"}</div>
                  <p className="mt-1 text-xs leading-5">{booking.recommendation}</p>
                </div>
                <div className="space-y-2 rounded-lg border bg-white p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-[#06C755]" />
                    {booking.selectedServiceUnit.unitName}
                  </div>
                  {booking.preferredDate && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-[#06C755]" />
                      {new Date(booking.preferredDate).toLocaleDateString("th-TH")}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-[#06C755]" />
                    นำรหัส/QR นี้ให้เจ้าหน้าที่ ณ หน่วยบริการ
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full bg-white"
                  onClick={() => {
                    setBooking(null);
                    setStep(0);
                  }}
                >
                  ลงทะเบียนรายใหม่
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-600">
            <div className="mb-1 flex items-center gap-2 font-bold text-slate-800">
              <Award className="h-4 w-4 text-amber-500" />
              หมายเหตุ
            </div>
            แบบประเมินนี้ใช้เพื่อจองสิทธิ์คัดกรองและจัดคิวบริการ ไม่ใช่การวินิจฉัยโรค
            ผลตรวจและคำแนะนำทางการแพทย์ต้องยืนยันโดยเจ้าหน้าที่/แพทย์
          </div>
        </main>
      </div>
    </div>
  );
}
