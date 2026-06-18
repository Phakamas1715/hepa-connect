import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Sparkles, MessageSquare, Phone, Send, CheckCircle2, Users, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PATIENTS, PERSONA_NUDGES, type Patient, hasCareGap } from "@/lib/hepa-data";
import { toast } from "sonner";
import { LineAgentNudgeButton } from "@/components/line-agent-nudge";

export const Route = createFileRoute("/patients")({
  head: () => ({
    meta: [
      { title: "Patient Care Gap — HEPA-GLUE Engine" },
      {
        name: "description",
        content:
          "Behavioral AI command center: persona-tailored nudges, LINE Health Card dispatch to อสม., and care-gap triage.",
      },
    ],
  }),
  component: PatientsPage,
});

const personaColor: Record<string, string> = {
  "The Forgetful": "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  "The Fearful": "bg-warning/20 text-warning-foreground border-warning/40",
  "The Denier": "bg-destructive/15 text-destructive border-destructive/40",
  "The Engaged": "bg-success/15 text-success border-success/40",
};

function ResultBadge({ value }: { value: string }) {
  if (value === "Positive")
    return <Badge variant="destructive" className="font-semibold">Positive</Badge>;
  if (value === "Negative")
    return <Badge variant="outline" className="text-muted-foreground">Negative</Badge>;
  if (value === "Detected")
    return <Badge variant="destructive">Detected</Badge>;
  if (value === "Not Detected")
    return <Badge className="bg-success text-success-foreground">Not Detected</Badge>;
  if (value === "รอผล" || value === "ไม่พอตรวจขอเจาะใหม่")
    return (
      <span className="blink-warning inline-flex items-center rounded-md border border-warning/50 bg-warning/20 px-2 py-0.5 text-[11px] font-semibold text-warning-foreground">
        ⚠ {value}
      </span>
    );
  return <span className="text-xs text-muted-foreground">{value}</span>;
}

function PatientsPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "hbv+" | "hcv+" | "gap">("all");
  const [selected, setSelected] = useState<Patient | null>(null);

  const filtered = useMemo(() => {
    return PATIENTS.filter((p) => {
      const q = query.toLowerCase();
      const matches =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.hn.toLowerCase().includes(q) ||
        p.village.toLowerCase().includes(q);
      const matchFilter =
        filter === "all"
          ? true
          : filter === "hbv+"
            ? p.hbsag === "Positive"
            : filter === "hcv+"
              ? p.hcvAb === "Positive"
              : hasCareGap(p);
      return matches && matchFilter;
    });
  }, [query, filter]);

  const stats = useMemo(
    () => ({
      total: PATIENTS.length,
      hbv: PATIENTS.filter((p) => p.hbsag === "Positive").length,
      hcv: PATIENTS.filter((p) => p.hcvAb === "Positive").length,
      gaps: PATIENTS.filter(hasCareGap).length,
    }),
    [],
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Patient Care Gap & Behavioral AI Command
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Active patient triage with persona-tailored nudges and อสม. dispatch.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Active Patients", value: stats.total, icon: Users, tone: "text-foreground" },
          { label: "HBV Positive", value: stats.hbv, icon: Users, tone: "text-destructive" },
          { label: "HCV Positive", value: stats.hcv, icon: Users, tone: "text-destructive" },
          { label: "Care Gaps", value: stats.gaps, icon: Users, tone: "text-warning-foreground" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {s.label}
              </div>
              <div className={`mt-1 text-2xl font-bold ${s.tone}`}>{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Active Patient List</CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search HN, name, village…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-9 pl-9 sm:w-64"
                />
              </div>
              <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                <SelectTrigger className="h-9 sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All patients</SelectItem>
                  <SelectItem value="hbv+">HBV Positive</SelectItem>
                  <SelectItem value="hcv+">HCV Positive</SelectItem>
                  <SelectItem value="gap">Care Gap</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2">HN</th>
                  <th className="px-3 py-2">Patient</th>
                  <th className="px-3 py-2">Village / Subdistrict</th>
                  <th className="px-3 py-2">Test Date</th>
                  <th className="px-3 py-2">FY</th>
                  <th className="px-3 py-2">HBsAg</th>
                  <th className="px-3 py-2">HBsAb</th>
                  <th className="px-3 py-2">HCV Ab</th>
                  <th className="px-3 py-2">HCV VL</th>
                  <th className="px-3 py-2">AI Flag</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.hn} className="border-t align-middle hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{p.hn}</td>
                    <td className="px-3 py-2 font-medium text-foreground">{p.name}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span>{p.village}</span>
                      </div>
                      <div className="text-[10px] opacity-70">ต.{p.subdistrict}</div>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-xs text-muted-foreground">
                      {p.testDate}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{p.fiscalYear}</td>
                    <td className="px-3 py-2"><ResultBadge value={p.hbsag} /></td>
                    <td className="px-3 py-2"><ResultBadge value={p.hbsab} /></td>
                    <td className="px-3 py-2"><ResultBadge value={p.hcvAb} /></td>
                    <td className="px-3 py-2"><ResultBadge value={p.hcvVL} /></td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                          personaColor[p.persona]
                        }`}
                      >
                        {p.persona}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 border-teal/40 text-teal hover:bg-teal/10"
                          onClick={() => setSelected(p)}
                        >
                          <Sparkles className="h-3.5 w-3.5" /> AI Contact
                        </Button>
                        {(p.hcvVL === "รอผล" || p.hcvVL === "ไม่พอตรวจขอเจาะใหม่") && (
                          <LineAgentNudgeButton patient={p} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      No patients match filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AIContactDialog patient={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function AIContactDialog({
  patient,
  onClose,
}: {
  patient: Patient | null;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"compose" | "sent">("compose");

  if (!patient) return null;

  const nudge = PERSONA_NUDGES[patient.persona];
  const date = "พุธ 25 มี.ค. 2569";
  const sms = nudge.sms.replace("{name}", patient.name).replace("{date}", date);

  const handleSend = () => {
    setStep("sent");
    toast.success("LINE Health Card dispatched to อสม.", {
      description: `Village ${patient.village} • SMS queued to ${patient.name}`,
    });
  };

  const handleClose = () => {
    setStep("compose");
    onClose();
  };

  return (
    <Dialog open onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-teal" />
            AI Behavioral Contact
          </DialogTitle>
          <DialogDescription>
            Persona-tailored nudge for{" "}
            <strong className="text-foreground">{patient.name}</strong> ·{" "}
            <Badge variant="outline" className="ml-1">{patient.persona}</Badge>
          </DialogDescription>
        </DialogHeader>

        {step === "compose" ? (
          <Tabs defaultValue="sms" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="sms" className="gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> SMS</TabsTrigger>
              <TabsTrigger value="call" className="gap-1.5"><Phone className="h-3.5 w-3.5" /> Call Script</TabsTrigger>
              <TabsTrigger value="line" className="gap-1.5"><Send className="h-3.5 w-3.5" /> อสม.</TabsTrigger>
            </TabsList>

            <TabsContent value="sms">
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  SMS Draft · TH
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{sms}</p>
              </div>
              <div className="mt-2 rounded-md bg-teal/10 px-3 py-2 text-[11px] text-teal">
                Nudge: {patient.persona === "The Fearful" ? "Reassurance + Free-of-charge framing" : patient.persona === "The Forgetful" ? "Commitment device + reminder cadence" : patient.persona === "The Denier" ? "Loss aversion + social proof" : "Positive reinforcement"}
              </div>
            </TabsContent>

            <TabsContent value="call">
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Phone Call Script · Behavioral Economics
                </div>
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">{nudge.script}</pre>
              </div>
            </TabsContent>

            <TabsContent value="line">
              <div className="rounded-lg border border-success/30 bg-success/5 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-md bg-success text-success-foreground">
                    <Send className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">LINE Health Card</div>
                    <div className="text-[11px] text-muted-foreground">To อสม. · {patient.village}</div>
                  </div>
                </div>
                <div className="rounded-md bg-card p-3 text-sm leading-relaxed text-foreground shadow-sm">
                  📋 <strong>คำขอเยี่ยมบ้าน</strong><br />
                  ผู้ป่วย: {patient.name} (HN {patient.hn})<br />
                  ที่อยู่: {patient.village}<br />
                  ประเด็น: {patient.hcvAb === "Positive" ? "HCV Ab Positive — ติดตามนัดเจาะ Viral Load" : "HBV Positive — ติดตามเข้าระบบรักษา"}<br />
                  Persona: <em>{patient.persona}</em><br />
                  Action: นัดมา รพ.น้ำพอง วันที่ {date}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="grid gap-3 py-6 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div className="text-lg font-semibold">Nudge sent successfully</div>
            <div className="text-sm text-muted-foreground">
              SMS queued · LINE Health Card delivered to อสม. · Logged in care registry
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "compose" ? (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button className="gradient-medical text-white" onClick={handleSend}>
                <Send className="mr-1.5 h-4 w-4" /> Send All Channels
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
