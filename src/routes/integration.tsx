import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Cable,
  Eye,
  EyeOff,
  Building2,
  KeyRound,
  Lock,
  CheckCircle2,
  Loader2,
  Upload,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { MOPH_CONFIG, PATIENTS, isPositive, type Patient } from "@/lib/hepa-data";
import { toast } from "sonner";

export const Route = createFileRoute("/integration")({
  head: () => ({
    meta: [
      { title: "MOPH Integration — HEPA-GLUE Engine" },
      {
        name: "description",
        content:
          "Secure credential vault and automated D506/Hep-BC-DDC/DOE portal submission with ICD-10 mapping.",
      },
    ],
  }),
  component: IntegrationPage,
});

type SyncStep = { label: string; status: "pending" | "running" | "done" };

const STEPS: Omit<SyncStep, "status">[] = [
  { label: "Validate data integrity (no #VALUE! / null demographics)" },
  { label: "Map clinical data to ICD-10 (B18.1 / B18.2)" },
  { label: "Authenticating Hospital 11000…" },
  { label: "Uploading Lab values to ddsdoe.ddc.moph.go.th" },
  { label: "Surveillance logging on d506portal.ddc.moph.go.th" },
  { label: "Registering on doeportal.moph.go.th" },
  { label: "Successfully Registered" },
];

function IntegrationPage() {
  const [show, setShow] = useState(false);
  const [reported, setReported] = useState<Record<string, { txId: string; ts: string }>>({});
  const [syncing, setSyncing] = useState<string | null>(null);
  const [steps, setSteps] = useState<SyncStep[]>([]);

  const positivePatients = PATIENTS.filter(isPositive);

  const handleSync = async (p: Patient) => {
    setSyncing(p.hn);
    const initial = STEPS.map((s) => ({ ...s, status: "pending" as const }));
    setSteps(initial);
    for (let i = 0; i < initial.length; i++) {
      await new Promise((r) => setTimeout(r, 650));
      setSteps((prev) =>
        prev.map((s, idx) =>
          idx < i ? { ...s, status: "done" } : idx === i ? { ...s, status: "running" } : s,
        ),
      );
    }
    await new Promise((r) => setTimeout(r, 500));
    setSteps((prev) => prev.map((s) => ({ ...s, status: "done" })));
    const txId = "MOPH-" + Date.now().toString(36).toUpperCase();
    const ts = new Date().toLocaleString("th-TH");
    setReported((r) => ({ ...r, [p.hn]: { txId, ts } }));
    toast.success(`Synced ${p.hn} to MOPH portals`, { description: `Transaction ${txId}` });
    setTimeout(() => {
      setSyncing(null);
      setSteps([]);
    }, 900);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          MOPH Portal Integration
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Credential vault and automated surveillance reporting — Hep-BC-DDC, D506, and DOE portals.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4 text-teal" />
              Integration Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                MOPH Hospital Code
              </Label>
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                <Building2 className="h-4 w-4 text-teal" />
                <span className="font-mono text-sm font-bold">{MOPH_CONFIG.hospitalCode}</span>
                <span className="text-xs text-muted-foreground">· {MOPH_CONFIG.hospitalName}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Authorized User
              </Label>
              <Input value={MOPH_CONFIG.username} readOnly className="font-mono" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                API Password
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type={show ? "text" : "password"}
                  value={show ? MOPH_CONFIG.password : "••••••"}
                  readOnly
                  className="pl-9 pr-10 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cable className="h-4 w-4 text-teal" />
              Connected Portals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {MOPH_CONFIG.portals.map((p) => (
              <div
                key={p.id}
                className="flex items-start justify-between gap-2 rounded-lg border bg-card p-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">{p.name}</div>
                  <div className="truncate font-mono text-[11px] text-muted-foreground">
                    {p.url}
                  </div>
                </div>
                <Badge className="bg-success/15 text-success border-success/30 shrink-0" variant="outline">
                  <span className="mr-1 h-1.5 w-1.5 rounded-full bg-success" />
                  Live
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-teal" />
              Positive Cases · Awaiting MOPH Sync
            </CardTitle>
            <Badge variant="outline" className="self-start sm:self-auto">
              {positivePatients.length} cases · ICD-10 B18.1 / B18.2
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2">HN</th>
                  <th className="px-3 py-2">Patient</th>
                  <th className="px-3 py-2">Diagnosis · ICD-10</th>
                  <th className="px-3 py-2">MOPH Status</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {positivePatients.map((p) => {
                  const rep = reported[p.hn];
                  const icd =
                    p.hbsag === "Positive" && p.hcvAb === "Positive"
                      ? "B18.1 + B18.2"
                      : p.hbsag === "Positive"
                        ? "B18.1 · Chronic HBV"
                        : "B18.2 · Chronic HCV";
                  return (
                    <tr key={p.hn} className="border-t align-middle">
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{p.hn}</td>
                      <td className="px-3 py-2 font-medium text-foreground">
                        {p.name}
                        <div className="text-[10px] text-muted-foreground">{p.village}</div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                          {icd}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {rep ? (
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4 text-success" />
                            <div className="text-xs">
                              <div className="font-semibold text-success">Reported</div>
                              <div className="font-mono text-[10px] text-muted-foreground">
                                {rep.txId} · {rep.ts}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Pending
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          disabled={!!rep || !!syncing}
                          onClick={() => handleSync(p)}
                          className="gap-1.5 gradient-medical text-white disabled:opacity-50"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          {rep ? "Reported" : "Sync & Report"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {syncing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-lg border-teal/40 shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Loader2 className="h-4 w-4 animate-spin text-teal" />
                Syncing patient {syncing} to MOPH
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {steps.map((s, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors ${
                    s.status === "done"
                      ? "border-success/30 bg-success/5 text-foreground"
                      : s.status === "running"
                        ? "border-teal/40 bg-teal/5 text-foreground"
                        : "border-border bg-muted/20 text-muted-foreground"
                  }`}
                >
                  <div className="grid h-5 w-5 shrink-0 place-items-center">
                    {s.status === "done" ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : s.status === "running" ? (
                      <Loader2 className="h-4 w-4 animate-spin text-teal" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                    )}
                  </div>
                  <span>{s.label}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
