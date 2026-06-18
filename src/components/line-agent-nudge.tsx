import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  Terminal,
  Send,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Github,
  Sparkles,
  MessageCircle,
} from "lucide-react";
import type { Patient } from "@/lib/hepa-data";
import { toast } from "sonner";

// Extended persona set including "The Striver" as requested by LINE MCP brief
type ExtendedPersona = "The Forgetful" | "The Fearful" | "The Denier" | "The Engaged" | "The Striver";

const NUDGE_LIBRARY: Record<ExtendedPersona, { headline: string; body: string; cta: string; accent: string }> = {
  "The Forgetful": {
    headline: "📅 อย่าลืมนัดเจาะเลือดยืนยันผล",
    body: "คุณ {name} — รพ.น้ำพองนัด เจาะเลือดยืนยัน Viral Load วันพุธ 25 มี.ค. 2569 เวลา 08:00 น. มี อสม. รออยู่ที่ศาลาวัด 07:30 พาไปพร้อมกันค่ะ",
    cta: "ยืนยันมาตามนัด",
    accent: "from-blue-500 to-teal-500",
  },
  "The Fearful": {
    headline: "💚 ไม่ต้องกลัว — รักษาฟรี หายขาด 99%",
    body: "คุณ {name} ค่ะ ยา Sofvel ฟรีตามนโยบายรัฐ ไม่มีผลข้างเคียงรุนแรง 99 ใน 100 คนหายขาดภายใน 12 สัปดาห์ ข้อมูลของท่านเป็นความลับ พบหมอเป็นการส่วนตัว",
    cta: "ขอนัดพบแพทย์",
    accent: "from-teal-500 to-emerald-500",
  },
  "The Striver": {
    headline: "🏆 ก้าวสำคัญสู่ชัยชนะเหนือไวรัส",
    body: "คุณ {name} ท่านเดินมาถูกทางแล้ว! เหลืออีกเพียง 1 ขั้นตอน — ตรวจ Viral Load เพื่อเริ่ม Sofvel ผู้ป่วยในชุมชนกว่า 28 ท่านได้รับ SVR12 (หายขาด) แล้ว ท่านจะเป็นคนต่อไป",
    cta: "เริ่มแผนรักษาวันนี้",
    accent: "from-amber-500 to-orange-500",
  },
  "The Denier": {
    headline: "⚠ การไม่ตัดสินใจ คือการเลือกที่จะเสี่ยง",
    body: "คุณ {name} ผลเบื้องต้นต้องยืนยันเพิ่ม การปล่อยไว้อาจนำสู่ตับแข็ง/มะเร็งตับ — แต่หากรักษาวันนี้ โอกาสหาย 99% และฟรี 100% โปรดทบทวนอีกครั้งเพื่อครอบครัวของท่าน",
    cta: "ขอข้อมูลเพิ่ม",
    accent: "from-red-500 to-rose-500",
  },
  "The Engaged": {
    headline: "🌟 ขอบคุณที่ใส่ใจสุขภาพ",
    body: "ขอบคุณคุณ {name} ที่ติดตามผลอย่างสม่ำเสมอ นัดติดตามครั้งถัดไป พุธ 25 มี.ค. 2569",
    cta: "รับทราบ",
    accent: "from-emerald-500 to-teal-500",
  },
};

function mapPersona(p: Patient): ExtendedPersona {
  if (p.persona === "The Forgetful" && (p.hcvVL === "รอผล" || p.hcvVL === "ไม่พอตรวจขอเจาะใหม่")) {
    return "The Striver";
  }
  return p.persona as ExtendedPersona;
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
        LINE Agent Nudge
      </Button>
      {open && <LineAgentDialog patient={patient} onClose={() => setOpen(false)} />}
    </>
  );
}

function LineAgentDialog({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const [stage, setStage] = useState<"preview" | "executing" | "sent">("preview");
  const persona = mapPersona(patient.persona);
  const nudge = NUDGE_LIBRARY[persona] ?? NUDGE_LIBRARY["The Forgetful"];
  const text = nudge.body.replace("{name}", patient.name);

  // อสม. LINE user id — derived deterministically from village
  const osmId = `อสม_${patient.subdistrict}_${patient.hn.slice(-4)}`;
  const patientLineId = `U${patient.hn.replace(/-/g, "").toLowerCase()}`;

  const handleExecute = async () => {
    setStage("executing");
    await new Promise((r) => setTimeout(r, 1400));
    setStage("sent");
    toast.success("LINE Bot MCP invoked successfully", {
      description: `2 push messages dispatched · ${persona} nudge`,
    });
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
            LINE Bot MCP Server · Agent Simulation
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <span>Target:</span>
            <Badge variant="outline">{patient.name}</Badge>
            <Badge variant="outline" className="border-warning/40 text-warning-foreground">
              VL: {patient.hcvVL}
            </Badge>
            <Badge className="bg-success/15 text-success border-success/30" variant="outline">
              Persona → {persona}
            </Badge>
            <a
              href="https://github.com/line/line-bot-mcp-server"
              target="_blank"
              rel="noopener"
              className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-teal"
            >
              <Github className="h-3 w-3" /> line/line-bot-mcp-server
            </a>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          {/* MCP Tool Invocation */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Terminal className="h-3.5 w-3.5" /> MCP Tool Invocation
            </div>

            <div className="space-y-2">
              <div className="rounded-lg border border-border bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-100 shadow-inner">
                <div className="mb-1.5 flex items-center gap-2 text-[10px] text-slate-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>agent → mcp://line-bot-mcp-server</span>
                </div>
                <div>
                  <span className="text-pink-400">line</span>
                  <span className="text-slate-400">.</span>
                  <span className="text-teal-300">push_message</span>
                  <span className="text-slate-400">(</span>
                </div>
                <div className="pl-3">
                  <span className="text-amber-300">to</span>
                  <span className="text-slate-400">: </span>
                  <span className="text-emerald-300">"{osmId}"</span>
                  <span className="text-slate-400">,</span>
                </div>
                <div className="pl-3">
                  <span className="text-amber-300">text</span>
                  <span className="text-slate-400">: </span>
                  <span className="text-emerald-300 whitespace-pre-wrap">
                    "[Nudge:{persona}] {text.slice(0, 80)}…"
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">)</span>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-100">
                <div className="mb-1.5 flex items-center gap-2 text-[10px] text-slate-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>then → patient channel</span>
                </div>
                <div>
                  <span className="text-pink-400">line</span>
                  <span className="text-slate-400">.</span>
                  <span className="text-teal-300">push_flex_message</span>
                  <span className="text-slate-400">(</span>
                </div>
                <div className="pl-3">
                  <span className="text-amber-300">to</span>
                  <span className="text-slate-400">: </span>
                  <span className="text-emerald-300">"{patientLineId}"</span>
                  <span className="text-slate-400">,</span>
                </div>
                <div className="pl-3">
                  <span className="text-amber-300">altText</span>
                  <span className="text-slate-400">: </span>
                  <span className="text-emerald-300">"HEPA-GLUE Nudge"</span>
                  <span className="text-slate-400">,</span>
                </div>
                <div className="pl-3">
                  <span className="text-amber-300">contents</span>
                  <span className="text-slate-400">: flex_bubble(...)</span>
                </div>
                <div>
                  <span className="text-slate-400">)</span>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-teal/30 bg-teal/5 p-2.5 text-[11px] text-muted-foreground">
              <div className="mb-0.5 flex items-center gap-1 font-semibold text-teal">
                <Sparkles className="h-3 w-3" /> AI Reasoning
              </div>
              Patient VL status is <code className="rounded bg-muted px-1">{patient.hcvVL}</code>.
              Behavioral classifier selected <strong>{persona}</strong>. MCP server will dispatch
              two messages: action prompt to อสม., and a rich Flex bubble nudge to the patient.
            </div>
          </div>

          {/* Rich messaging card preview */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <MessageCircle className="h-3.5 w-3.5" /> LINE Flex Card Preview
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-[#7e8e9f]/10 p-3 shadow-md">
              <div className="overflow-hidden rounded-xl bg-card shadow-lg">
                <div className={`h-20 bg-gradient-to-br ${nudge.accent} relative`}>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.4),transparent_60%)]" />
                  <div className="absolute bottom-2 left-3 text-[10px] font-semibold uppercase tracking-wider text-white/90">
                    HEPA-GLUE • รพ.น้ำพอง
                  </div>
                </div>
                <div className="space-y-2 p-4">
                  <div className="text-sm font-bold leading-snug text-foreground">{nudge.headline}</div>
                  <div className="text-[12px] leading-relaxed text-muted-foreground">{text}</div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <Badge variant="outline" className="text-[10px]">
                      Persona · {persona}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">HN {patient.hn}</span>
                  </div>
                  <Button size="sm" className={`mt-1 w-full bg-gradient-to-r ${nudge.accent} text-white shadow`}>
                    {nudge.cta} <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="mt-3 overflow-hidden rounded-xl bg-card shadow-lg">
                <div className="flex items-center gap-2 border-b border-border bg-success/5 px-3 py-2">
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-success text-success-foreground text-[10px] font-bold">
                    อสม
                  </div>
                  <div className="min-w-0 text-xs">
                    <div className="truncate font-semibold text-foreground">ถึง อสม. {patient.subdistrict}</div>
                    <div className="truncate text-[10px] text-muted-foreground">LINE ID: {osmId}</div>
                  </div>
                </div>
                <div className="space-y-1.5 p-3 text-[12px] leading-relaxed text-foreground">
                  📍 <strong>{patient.name}</strong> ({patient.village})<br />
                  สถานะ: <span className="text-warning-foreground">รอ Viral Load</span> ·{" "}
                  Persona: <em>{persona}</em><br />
                  ขอความกรุณาเยี่ยมบ้านและพามาเจาะเลือดวันพุธ 25 มี.ค. 07:30 ที่ศาลาวัด
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-border bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
          <strong className="text-foreground">MCP server:</strong>{" "}
          <code className="rounded bg-card px-1">line-bot-mcp-server</code> · transport{" "}
          <code className="rounded bg-card px-1">stdio</code> · channel{" "}
          <code className="rounded bg-card px-1">@hepa-glue-bot</code>
        </div>

        <DialogFooter>
          {stage === "preview" && (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button className="gradient-medical text-white gap-1.5" onClick={handleExecute}>
                <Send className="h-4 w-4" /> Invoke MCP & Send
              </Button>
            </>
          )}
          {stage === "executing" && (
            <Button disabled className="gap-1.5">
              <Loader2 className="h-4 w-4 animate-spin" /> Calling line.push_message…
            </Button>
          )}
          {stage === "sent" && (
            <Button onClick={handleClose} className="gap-1.5 bg-success text-success-foreground hover:bg-success/90">
              <CheckCircle2 className="h-4 w-4" /> Delivered · Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
