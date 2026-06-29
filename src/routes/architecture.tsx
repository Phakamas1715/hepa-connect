import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  BellRing,
  Bot,
  CheckCircle2,
  Cloud,
  Database,
  FileCheck2,
  HeartPulse,
  Hospital,
  MessageCircle,
  Network,
  ScanLine,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/architecture")({
  head: () => ({
    meta: [
      { title: "สถาปัตยกรรมระบบ — HEPA-GLUE Engine" },
      {
        name: "description",
        content: "แผนภาพ Data Flow และสถานะการเชื่อมต่อจริงของ HEPA-GLUE Engine",
      },
    ],
  }),
  component: ArchitecturePage,
});

const statusItems = [
  {
    title: "หน้าเว็บ local",
    status: "พร้อมใช้งาน",
    detail: "แดชบอร์ดและหน้า architecture รันอยู่บน localhost:5174",
    icon: CheckCircle2,
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  {
    title: "Smart Query server",
    status: "เชื่อมได้บางส่วน",
    detail: "ล็อกอิน demo admin ได้ และดึง OPD/IPD preview ผ่าน API ได้",
    icon: CheckCircle2,
    tone: "border-sky-200 bg-sky-50 text-sky-800",
  },
  {
    title: "HOSxP MySQL ตรง",
    status: "ยังถูก block",
    detail: "server ตอบกลับว่า host เครื่องนี้ไม่ได้รับอนุญาตให้ต่อ MariaDB",
    icon: AlertTriangle,
    tone: "border-amber-200 bg-amber-50 text-amber-900",
  },
  {
    title: "Lab HBsAg / HCV RNA",
    status: "ต้องเพิ่ม endpoint หรือสิทธิ์",
    detail: "dataset ที่เข้าถึงได้ตอนนี้ยังไม่มี lab_order สำหรับไวรัสตับอักเสบโดยตรง",
    icon: AlertTriangle,
    tone: "border-orange-200 bg-orange-50 text-orange-900",
  },
];

const sources = [
  {
    title: "รพ.สต. / อสม.",
    subtitle: "คัดกรอง Rapid Test ในชุมชน",
    icon: ScanLine,
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
    points: ["HBsAg / Anti-HCV", "กลุ่มเป้าหมายเกิดก่อนปี 2535", "ส่งผลเข้าระบบกลางแบบ zero-typing"],
  },
  {
    title: "HOSxP โรงพยาบาล",
    subtitle: "ผลยืนยันจากห้องแล็บ",
    icon: Hospital,
    tone: "bg-sky-50 text-sky-700 border-sky-200",
    points: ["ELISA / HCV RNA", "รับ lab event หรือ query เฉพาะช่วง", "ต้องมีสิทธิ์ต่อ DB/API ที่ถูกต้อง"],
  },
];

const cloudNodes = [
  { title: "Local Agent", desc: "อ่านข้อมูลจาก JHCIS/HOSxP แล้วส่งขึ้น cloud ผ่าน HTTPS", icon: Network },
  { title: "HEPA-GLUE Cloud", desc: "รวม care gap, persona, cascade และสถานะ linkage to care", icon: Cloud },
  { title: "AI Decision Layer", desc: "ประเมินผลบวก ค้างนัด และเลือก behavioral nudge ตามบริบท", icon: Bot },
];

const outputs = [
  { title: "LINE น้ำพองรักตับ", desc: "แจ้ง อสม. และผู้ป่วย พร้อม QR/ใบนัด เมื่อเชื่อม LINE channel แล้ว", icon: MessageCircle },
  { title: "MOPH Auto Reporting", desc: "เตรียมข้อมูล Hep-BC-DDC, D506 และ DOE ด้วยรหัสหน่วย 11000", icon: FileCheck2 },
];

const sequence = [
  ["1", "คัดกรองในชุมชน", "อสม. ตรวจ Rapid Test และบันทึกผลผ่านระบบที่กำหนด"],
  ["2", "Agent อ่านข้อมูล", "ดึง rapid result จาก JHCIS และผลยืนยันจาก HOSxP/API"],
  ["3", "Cloud วิเคราะห์ care gap", "ตรวจคนที่ผลบวกแต่ยังไม่มีผลยืนยัน หรือขาดนัดเกินเกณฑ์"],
  ["4", "ส่ง nudge", "เลือกข้อความตาม persona แล้วส่งผ่าน LINE Bot"],
  ["5", "กลับมาตรวจยืนยัน", "ผู้ป่วยเข้ารับการเจาะเลือดดำที่โรงพยาบาล"],
  ["6", "อัปเดตผล lab", "HCV RNA / HBsAg ถูก sync กลับเข้า HEPA-GLUE"],
  ["7", "รายงานประเทศ", "จัดรูปแบบและส่งข้อมูลเข้า DDC/D506/DOE"],
  ["8", "ปิดลูปการรักษา", "อัปเดตสถานะรักษา นัดรับยา และตัวชี้วัด cascade"],
];

const pillars = [
  {
    title: "Zero-Typing Screening",
    desc: "ลดงานกรอกซ้ำของคนหน้างาน โดยให้ข้อมูลวิ่งจาก workflow เดิมหรือ LINE quick action",
    icon: ScanLine,
  },
  {
    title: "Smart Data Agent",
    desc: "ทำงานเบื้องหลังเพื่อรวมข้อมูลจาก JHCIS, HOSxP และ server API อย่างเป็นรอบ",
    icon: Database,
  },
  {
    title: "Automated Follow-up",
    desc: "AI จัดกลุ่ม persona แล้วช่วยสั่ง nudge เพื่อพาผู้ป่วยกลับเข้าสู่การตรวจยืนยันและรักษา",
    icon: BellRing,
  },
  {
    title: "National Reporting",
    desc: "ลดภาระคีย์รายงานซ้ำ โดยเตรียม payload สำหรับส่งเข้าระบบกระทรวง",
    icon: ShieldCheck,
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
            สถาปัตยกรรมระบบและการไหลของข้อมูล
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            ภาพรวมระบบปิดลูปสำหรับงานไวรัสตับอักเสบ B/C ตั้งแต่คัดกรองในชุมชน,
            ยืนยันผลในโรงพยาบาล, แจ้งเตือนผ่าน LINE และส่งรายงานเข้าสู่ระบบกระทรวง
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
    </div>
  );
}
