import { useState } from "react";
import { Bot, CheckCircle2, Loader2, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type Patient, type Persona } from "@/lib/hepa-data";

const HOSPITAL_NAME = "โรงพยาบาลน้ำพอง";

type Nudge = {
  headline: string;
  body: string;
  cta: string;
  accent: string;
};

const NUDGE_LIBRARY: Record<Persona, Nudge> = {
  "The Forgetful": {
    headline: "อย่าลืมนัดตรวจยืนยันผล",
    body: `{name} มีนัดเจาะเลือดยืนยัน viral load ที่${HOSPITAL_NAME} กรุณายืนยันนัดหรือแจ้งทีมดูแลหากต้องการเลื่อน`,
    cta: "ยืนยันนัดตรวจ",
    accent: "from-blue-500 to-teal-500",
  },
  "The Fearful": {
    headline: "ทีมดูแลพร้อมให้คำปรึกษา",
    body: "{name} การรักษาไวรัสตับอักเสบเป็นความลับ มีทีมดูแลอธิบายทุกขั้นตอน และยารักษาอยู่ในสิทธิประโยชน์ตามนโยบายรัฐ",
    cta: "คุยกับทีมดูแล",
    accent: "from-teal-500 to-emerald-500",
  },
  "The Denier": {
    headline: "ตรวจยืนยันเพื่อลดความเสี่ยงระยะยาว",
    body: "{name} ผลคัดกรองต้องติดตามต่อ การตรวจยืนยันช่วยป้องกันภาวะตับแข็งและมะเร็งตับได้ตั้งแต่ระยะต้น",
    cta: "ดูขั้นตอนถัดไป",
    accent: "from-red-500 to-rose-500",
  },
  "The Engaged": {
    headline: "ติดตามตามแผนการดูแล",
    body: "{name} มีนัดติดตามตามแผนการดูแลไวรัสตับอักเสบ กรุณามาตามวันและเวลาที่กำหนด",
    cta: "รับทราบ",
    accent: "from-emerald-500 to-teal-500",
  },
  "The Striver": {
    headline: "อีกขั้นก่อนเริ่มแผนรักษา",
    body: "{name} เหลือขั้นตอนตรวจยืนยัน viral load เพื่อเริ่มวางแผนรักษา Sofvel และปิด care gap",
    cta: "เริ่มขั้นตอนถัดไป",
    accent: "from-amber-500 to-orange-500",
  },
};

function mapPersona(patient: Patient): Persona {
  if (
    patient.persona === "The Forgetful" &&
    (patient.hcvVL === "รอผล" ||
      patient.hcvVL === "ไม่พอตรวจขอเจาะใหม่" ||
      patient.hcvVL === "Pending")
  ) {
    return "The Striver";
  }
  return patient.persona;
}

export function LineAgentNudgeButton({ patient }: { patient: Patient }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 border-success/40 bg-success/5 text-success hover:bg-success/15"
        onClick={() => setOpen(true)}
      >
        <MessageCircle className="h-3.5 w-3.5" />
        LINE ติดตาม
      </Button>
      {open && <LineAgentDialog patient={patient} onClose={() => setOpen(false)} />}
    </>
  );
}

function LineAgentDialog({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const [stage, setStage] = useState<"preview" | "executing" | "sent">("preview");
  const persona = mapPersona(patient);
  const nudge = NUDGE_LIBRARY[persona];
  const text = nudge.body.replace("{name}", patient.name);
  const osmId = `อสม_${patient.subdistrict}_${patient.hn.slice(-4)}`;
  const patientLineId = `U${patient.hn.replace(/-/g, "").toLowerCase()}`;

  const handleExecute = async () => {
    setStage("executing");
    try {
      const response = await fetch("/api/send-nudge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: patient.hn,
          persona,
          messageType: "LINE_NUDGE",
        }),
      });

      if (!response.ok) throw new Error("ส่ง LINE nudge ไม่สำเร็จ");

      setStage("sent");
      toast.success("ส่งคำขอติดตามผ่าน LINE แล้ว", {
        description: `ใช้รูปแบบข้อความ: ${persona}`,
      });
    } catch (error) {
      console.error("Error sending nudge:", error);
      toast.error("ส่งข้อความติดตามไม่สำเร็จ", {
        description: "กรุณาลองใหม่หรือตรวจสอบการเชื่อมต่อ LINE",
      });
      setStage("preview");
    }
  };

  const handleClose = () => {
    setStage("preview");
    onClose();
  };

  return (
    <Dialog open onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-success text-success-foreground">
              <Bot className="h-4 w-4" />
            </div>
            ตัวอย่างข้อความติดตามผ่าน LINE
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <span>เป้าหมาย:</span>
            <Badge variant="outline">{patient.name}</Badge>
            <Badge variant="outline" className="border-warning/40 text-warning-foreground">
              VL: {patient.hcvVL}
            </Badge>
            <Badge className="bg-success/15 text-success border-success/30" variant="outline">
              รูปแบบข้อความ: {persona}
            </Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              รายละเอียดการส่งข้อความ
            </div>
            <div className="rounded-lg border border-border bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-100 shadow-inner">
              <div className="mb-1.5 flex items-center gap-2 text-[10px] text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>ระบบติดตาม → LINE</span>
              </div>
              <div>line.push_message(</div>
              <div className="pl-3">to: "{osmId}",</div>
              <div className="pl-3">
                text: "[{persona}] {text.slice(0, 80)}..."
              </div>
              <div>)</div>
            </div>

            <div className="rounded-lg border border-border bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-100">
              <div className="mb-1.5 flex items-center gap-2 text-[10px] text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>ส่งต่อถึงผู้ป่วย</span>
              </div>
              <div>line.push_flex_message(</div>
              <div className="pl-3">to: "{patientLineId}",</div>
              <div className="pl-3">altText: "HEPA-GLUE Nudge",</div>
              <div className="pl-3">contents: flex_bubble(...)</div>
              <div>)</div>
            </div>

            <div className="rounded-md border border-teal/30 bg-teal/5 p-2.5 text-[11px] text-muted-foreground">
              <strong className="text-teal">เกณฑ์ประเมิน:</strong> สถานะ viral load คือ{" "}
              <code className="rounded bg-muted px-1">{patient.hcvVL}</code> ระบบเลือกแบบข้อความ{" "}
              <strong>{persona}</strong> และเตรียมส่งข้อความให้ทั้ง อสม. และผู้ป่วย
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              ตัวอย่าง LINE Flex Card
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-[#7e8e9f]/10 p-3 shadow-md">
              <div className="overflow-hidden rounded-xl bg-card shadow-lg">
                <div className={`h-20 bg-gradient-to-br ${nudge.accent} relative`}>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.4),transparent_60%)]" />
                  <div className="absolute bottom-2 left-3 text-[10px] font-semibold uppercase tracking-wider text-white/90">
                    HEPA-GLUE · {HOSPITAL_NAME.replace("โรงพยาบาล", "รพ.")}
                  </div>
                </div>
                <div className="space-y-2 p-4">
                  <div className="text-sm font-bold leading-snug text-foreground">
                    {nudge.headline}
                  </div>
                  <div className="text-[12px] leading-relaxed text-muted-foreground">{text}</div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <Badge variant="outline" className="text-[10px]">
                      รูปแบบ · {persona}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">HN {patient.hn}</span>
                  </div>
                  <Button
                    size="sm"
                    className={`mt-1 w-full bg-gradient-to-r ${nudge.accent} text-white shadow`}
                  >
                    {nudge.cta}
                  </Button>
                </div>
              </div>

              <div className="mt-3 overflow-hidden rounded-xl bg-card shadow-lg">
                <div className="flex items-center gap-2 border-b border-border bg-success/5 px-3 py-2">
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-success text-success-foreground text-[10px] font-bold">
                    อสม.
                  </div>
                  <div className="min-w-0 text-xs">
                    <div className="truncate font-semibold text-foreground">
                      ถึง อสม. {patient.subdistrict}
                    </div>
                    <div className="truncate text-[10px] text-muted-foreground">
                      LINE ID: {osmId}
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5 p-3 text-[12px] leading-relaxed text-foreground">
                  <strong>{patient.name}</strong> ({patient.village})<br />
                  สถานะ: <span className="text-warning-foreground">รอติดตาม viral load</span> ·
                  รูปแบบข้อความ: <em>{persona}</em>
                  <br />
                  ขอความกรุณาประสานผู้ป่วยมาตรวจหรือยืนยันนัดที่{HOSPITAL_NAME}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          {stage === "preview" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                ยกเลิก
              </Button>
              <Button className="gradient-medical text-white gap-1.5" onClick={handleExecute}>
                <Send className="h-4 w-4" /> ส่งข้อความติดตาม
              </Button>
            </>
          )}
          {stage === "executing" && (
            <Button disabled className="gap-1.5">
              <Loader2 className="h-4 w-4 animate-spin" /> กำลังเรียก line.push_message...
            </Button>
          )}
          {stage === "sent" && (
            <Button
              onClick={handleClose}
              className="gap-1.5 bg-success text-success-foreground hover:bg-success/90"
            >
              <CheckCircle2 className="h-4 w-4" /> ส่งแล้ว · ปิด
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
