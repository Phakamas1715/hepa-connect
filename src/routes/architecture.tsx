import { createFileRoute } from "@tanstack/react-router";
import {
  BellRing,
  Bot,
  CheckCircle2,
  Cloud,
  ClipboardList,
  Database,
  FileCheck2,
  HeartPulse,
  Hospital,
  LockKeyhole,
  MessageCircle,
  QrCode,
  ScanLine,
  ServerCog,
  ShieldCheck,
  Stethoscope,
  Users,
  Workflow,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/architecture")({
  head: () => ({
    meta: [
      { title: "สถาปัตยกรรมระบบ — HEPA-GLUE Engine" },
      {
        name: "description",
        content: "Data Flow งานคัดกรองไวรัสตับอักเสบแบบใช้รายชื่อเป้าหมายและ QR scan โดย รพ.สต.",
      },
    ],
  }),
  component: ArchitecturePage,
});

const statusItems = [
  {
    title: "รายชื่อเป้าหมายกลาง",
    status: "เป็นแหล่งข้อมูลหลัก",
    detail: "ระบบใช้รายชื่อที่จัดทำและ mapping ให้แต่ละ รพ.สต. ไม่ดึงคัดกรองจาก JHCIS เป็นหลัก",
    icon: ClipboardList,
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  {
    title: "QR Scan โดย รพ.สต.",
    status: "ลดการพิมพ์ซ้ำ",
    detail: "เจ้าหน้าที่เลือกหรือสแกนจากรายชื่อเป้าหมาย แล้วบันทึกผล rapid test เข้า HEPA โดยตรง",
    icon: QrCode,
    tone: "border-sky-200 bg-sky-50 text-sky-800",
  },
  {
    title: "LINE น้ำพองรักตับ",
    status: "พร้อม closed loop",
    detail: "ใช้ผูกตัวตนผู้ป่วย ส่งนัด แจ้งเตือน และติดตาม care gap หลังคัดกรอง",
    icon: MessageCircle,
    tone: "border-teal-200 bg-teal-50 text-teal-800",
  },
  {
    title: "ผลยืนยันโรงพยาบาล",
    status: "ใช้เมื่อจำเป็น",
    detail:
      "HOSxP/Lab ใช้ยืนยันผลหลัง rapid test หรือปิด loop การรักษา ไม่ใช่จุดเริ่มต้นของรายชื่อคัดกรอง",
    icon: Hospital,
    tone: "border-amber-200 bg-amber-50 text-amber-900",
  },
];

const sources = [
  {
    title: "รายชื่อที่เราจัดทำ",
    subtitle: "HN/CID/ชื่อ/หมู่บ้าน/ตำบล/รพ.สต.รับผิดชอบ",
    icon: Users,
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
    points: [
      "แยกตาม mapping รหัสพื้นที่/ตำบล/หมู่บ้าน",
      "สร้าง QR เฉพาะราย",
      "ไม่ต้องค้นจาก JHCIS ตอนออกคัดกรอง",
    ],
  },
  {
    title: "รพ.สต. สแกนและบันทึก",
    subtitle: "หน้างานส่งผลคัดกรองเข้า HEPA โดยตรง",
    icon: ScanLine,
    tone: "bg-sky-50 text-sky-700 border-sky-200",
    points: ["เลือก HBsAg / Anti-HCV", "ระบุวันที่และผู้บันทึก", "ลดการพิมพ์ HN/CID ซ้ำ"],
  },
];

const cloudNodes = [
  {
    title: "HEPA Target Registry",
    desc: "เก็บรายชื่อเป้าหมายและ mapping รพ.สต./ตำบล/หมู่บ้าน",
    icon: ClipboardList,
  },
  {
    title: "HEPA-GLUE Cloud",
    desc: "รวมผลคัดกรอง, care gap, persona, cascade และสถานะ linkage to care",
    icon: Cloud,
  },
  {
    title: "AI Decision Layer",
    desc: "จัดลำดับความเสี่ยง เลือก action ถัดไป และสร้าง LINE follow-up",
    icon: Bot,
  },
];

const outputs = [
  {
    title: "แดชบอร์ดผู้บริหาร",
    desc: "เห็นยอดเป้าหมาย คัดกรอง ผลบวก และ care gap แยกตาม รพ.สต.",
    icon: HeartPulse,
  },
  {
    title: "LINE Closed Loop",
    desc: "ส่งลิงก์/นัด/แจ้งเตือนผู้ป่วยและ อสม. จากสถานะจริง",
    icon: MessageCircle,
  },
  {
    title: "รายงาน MOPH",
    desc: "เตรียมข้อมูลรายงานหลังตรวจสอบความถูกต้อง ไม่บันทึกกลับ HOSxP โดยตรง",
    icon: FileCheck2,
  },
];

const sequence = [
  [
    "1",
    "เตรียมรายชื่อเป้าหมาย",
    "นำรายชื่อที่มีอยู่มา mapping รพ.สต./ตำบล/หมู่บ้าน และสร้างรายการคัดกรอง",
  ],
  ["2", "แจก QR/ลิงก์ให้ รพ.สต.", "แต่ละหน่วยเปิดรายชื่อของตัวเองหรือสแกน QR จากระบบ HEPA"],
  ["3", "สแกนหน้างาน", "เจ้าหน้าที่เลือกผู้ป่วยจากรายชื่อเดิม ระบบรู้ HN/CID/พื้นที่อยู่แล้ว"],
  ["4", "บันทึกผล rapid test", "ส่งผล HBsAg และ Anti-HCV เข้า HEPA โดยตรง พร้อมวันที่และผู้บันทึก"],
  ["5", "ระบบหา care gap", "แยกผลบวก/รอ confirm/ยังไม่ผูก LINE/ยังไม่พบแพทย์"],
  ["6", "ส่ง LINE ติดตาม", "สร้าง QR ผูก LINE หรือส่ง nudge ตาม persona โดยมี audit log"],
  [
    "7",
    "ยืนยันที่โรงพยาบาล",
    "เฉพาะรายที่ต้อง confirm lab หรือเข้าสู่การรักษา จึงใช้ HOSxP/Lab ปิด loop",
  ],
  ["8", "ขึ้นแดชบอร์ดและรายงาน", "ผู้บริหารเห็นยอดรายหน่วย และเตรียมรายงาน MOPH/ILI ตามรอบ"],
];

const pillars = [
  {
    title: "Prepared Target List",
    desc: "เริ่มจากรายชื่อที่เราทำไว้ ไม่ต้องรอ query จาก JHCIS ตอนปฏิบัติงาน",
    icon: ClipboardList,
  },
  {
    title: "Scan-First Workflow",
    desc: "รพ.สต. สแกนหรือเลือกจากรายชื่อเดิม ระบบเติมข้อมูลคนไข้ให้ ลดการพิมพ์และลดผิดคน",
    icon: QrCode,
  },
  {
    title: "Automated Follow-up",
    desc: "ผลบวกหรือขาดขั้นตอนถัดไปจะเข้าคิว LINE/เจ้าหน้าที่/อสม. อัตโนมัติ",
    icon: BellRing,
  },
  {
    title: "Guarded Reporting",
    desc: "รายงานและ dashboard ใช้ข้อมูลที่ส่งเข้า HEPA พร้อมตรวจสอบก่อนส่งออกภายนอก",
    icon: ShieldCheck,
  },
];

const systemDesignChecklist = [
  {
    title: "API Gateway Boundary",
    desc: "ให้ frontend เรียก API ของ HEPA เท่านั้น ส่วน HOSxP, LINE, MOPH และ Hermes อยู่หลัง server/API gateway พร้อม token และ audit",
    icon: ServerCog,
  },
  {
    title: "Async Queue + Retry",
    desc: "งานส่ง LINE, ส่งรายงาน, sync lab และ Hermes helper ควรเข้าคิวก่อน เพื่อ retry ได้และไม่ทำให้หน้าจอค้าง",
    icon: Workflow,
  },
  {
    title: "Data Ownership",
    desc: "รายชื่อกลางเป็น source หลักของการคัดกรอง ส่วน HOSxP/Lab เป็น source ยืนยันผลหลัง rapid test ไม่เขียนทับกันมั่ว",
    icon: Database,
  },
  {
    title: "Secure API Access",
    desc: "ทุก webhook/proxy ต้องมี API key หรือ signed token, จำกัด PHI ใน payload และแยก secret ออกจาก frontend",
    icon: LockKeyhole,
  },
  {
    title: "Auditability",
    desc: "ทุก invite, identity map, nudge, report และ automation ต้องมี actor/time/status เพื่อไล่เหตุการณ์ย้อนหลังได้",
    icon: ShieldCheck,
  },
  {
    title: "Graceful Degradation",
    desc: "ถ้า LINE/Hermes/HOSxP ล่ม ระบบยังเปิดรายชื่อและบันทึกผลหน้างานได้ แล้ว sync ตามหลังเมื่อ service กลับมา",
    icon: CheckCircle2,
  },
];

function ArchitecturePage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 border-b pb-5">
        <Badge variant="outline" className="w-fit border-teal/30 bg-teal/5 text-teal">
          HEPA-GLUE × hepa-connect
        </Badge>
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Data Flow แบบใช้รายชื่อเป้าหมายและ QR scan
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            ระบบนี้ไม่ใช้ JHCIS เป็นแหล่งคัดกรองหลัก แต่เริ่มจากรายชื่อที่เราจัดทำให้แต่ละ รพ.สต.
            จากนั้นให้หน้างานสแกน/เลือกผู้ป่วยและส่งผลคัดกรองเข้า HEPA โดยตรง
          </p>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {statusItems.map((item) => (
          <Card key={item.title} className={`border ${item.tone}`}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <item.icon className="h-4 w-4" />
                {item.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-semibold">{item.status}</div>
              <p className="mt-1 text-xs leading-5 opacity-80">{item.detail}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1.2fr_1fr]">
        <div className="space-y-4">
          {sources.map((source) => (
            <Card key={source.title} className={`border ${source.tone}`}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <source.icon className="h-5 w-5" />
                  {source.title}
                </CardTitle>
                <p className="text-xs opacity-80">{source.subtitle}</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {source.points.map((point) => (
                  <div key={point} className="rounded-md bg-white/70 px-3 py-2 text-xs">
                    {point}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-teal/30 bg-gradient-to-b from-teal/5 to-background">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HeartPulse className="h-5 w-5 text-teal" />
              HEPA-GLUE Engine
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cloudNodes.map((node) => (
              <div key={node.title} className="rounded-lg border bg-card p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-teal/10 text-teal">
                    <node.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">{node.title}</div>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">{node.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {outputs.map((output) => (
            <Card key={output.title} className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <output.icon className="h-5 w-5 text-primary" />
                  {output.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-muted-foreground">{output.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Stethoscope className="h-5 w-5 text-teal" />
              ลำดับการทำงานแบบ Closed Loop
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sequence.map(([num, title, desc]) => (
                <div key={num} className="grid grid-cols-[2.5rem_1fr] gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-teal text-sm font-bold text-white">
                    {num}
                  </div>
                  <div className="rounded-lg border bg-card p-3">
                    <div className="text-sm font-semibold text-foreground">{title}</div>
                    <div className="mt-1 text-xs leading-5 text-muted-foreground">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">4 เสาหลักของระบบ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pillars.map((pillar) => (
              <div key={pillar.title} className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <pillar.icon className="h-4 w-4 text-teal" />
                  {pillar.title}
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{pillar.desc}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card className="border-sky-200 bg-sky-50/60">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">System Design 101 checklist</CardTitle>
            <Badge variant="outline" className="border-sky-300 bg-white/70 text-sky-800">
              ByteByteGo-inspired
            </Badge>
          </div>
          <p className="text-xs leading-5 text-sky-800/80">
            สรุปหลักออกแบบจากแนว System Design 101 ให้เข้ากับ HEPA-Connect: แยก boundary ให้ชัด,
            ส่งงานผ่านคิว, เก็บ audit, และให้ระบบยังทำงานได้แม้บางบริการภายนอกล่ม
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {systemDesignChecklist.map((item) => (
              <div key={item.title} className="rounded-lg border border-sky-200 bg-white/80 p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sky-100 text-sky-700">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-sky-950">{item.title}</div>
                    <p className="mt-1 text-xs leading-5 text-sky-900/75">{item.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
