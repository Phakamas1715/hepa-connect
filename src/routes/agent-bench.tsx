import { createFileRoute } from "@tanstack/react-router";
import { InnovationShowcase, OfficialNavHint, OfficialPageHeader } from "@/components/official-layout";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  Database,
  Loader2,
  PlayCircle,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/agent-bench")({
  head: () => ({
    meta: [
      { title: "ทดสอบ Agent — HEPA-GLUE Engine" },
      {
        name: "description",
        content: "รัน AgentWorldBench แบบปรับใช้กับ endpoint จริงของ HEPA-Connect",
      },
    ],
  }),
  component: AgentBenchPage,
});

type ScenarioMeta = {
  task: string;
  id: string;
  title: string;
  instruction: string;
};

type HfDatasetMeta = {
  repo: string;
  loaded: boolean;
  totalSamples: number;
  hepaFocus: string[];
  domains: Array<{ domain: string; samples: number }>;
  previews: Array<{ domain: string; id: string | number; turn: string; instruction: string }>;
  s3: { configured: boolean; endpoint: string | null; bucket: string | null };
};

type BenchMeta = {
  source: string;
  adapter: string;
  description: string;
  dimensions: string[];
  scenarios: ScenarioMeta[];
  dataset?: HfDatasetMeta;
};

type BenchResult = {
  scenario: { task: string; id: string; title: string };
  passed: boolean;
  averageScore: number;
  latencyMs: number;
  failures: string[];
  scores: Record<string, number>;
};

type BenchSummary = {
  status: string;
  ranAt: string;
  total: number;
  passed: number;
  failed: number;
  averageScore: number;
  byDomain: Record<string, { total: number; passed: number; averageScore: number }>;
  results: BenchResult[];
};

const domainLabels: Record<string, string> = {
  mcp: "API / MCP",
  web: "เว็บ / Automation",
  terminal: "เทอร์มินัล",
  search: "ค้นหา",
  swe: "แก้โค้ด",
  android: "Android",
  os: "ระบบปฏิบัติการ",
};

const dimensionLabels: Record<string, string> = {
  format: "รูปแบบ",
  factuality: "ความถูกต้อง",
  consistency: "ความสอดคล้อง",
  realism: "ความสมจริง",
  quality: "คุณภาพข้อความ",
};

async function fetchBenchMeta(): Promise<BenchMeta> {
  const response = await fetch("/api/agent-world-bench");
  if (!response.ok) throw new Error("โหลดชุดทดสอบไม่สำเร็จ");
  return response.json();
}

async function runBench(): Promise<BenchSummary> {
  const response = await fetch("/api/agent-world-bench", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || "รันชุดทดสอบไม่สำเร็จ");
  return data;
}

function AgentBenchPage() {
  const meta = useQuery({ queryKey: ["agent-world-bench-meta"], queryFn: fetchBenchMeta });
  const run = useMutation({ mutationFn: runBench });

  const summary = run.data;
  const readinessPercent = summary ? Math.round(summary.averageScore * 100) : 0;

  return (
    <div className="page-shell">
      <OfficialPageHeader
        eyebrow="หลักฐานนวัตกรรมดิจิทัล · Agent Intelligence"
        title="การทดสอบความพร้อมระบบติดตามอัจฉริยะ"
        description="หน้านี้แสดงผลการทดสอบระบบ Agent กับ API จริงของโรงพยาบาล อ้างอิงมาตรฐาน AgentWorldBench จาก Qwen เพื่อยืนยันความถูกต้อง ความสอดคล้อง และความพร้อมใช้งานจริง"
        badges={["ทดสอบบนระบบจริง", "ให้คะแนน 5 มิติ", "ตรวจสอบซ้ำได้"]}
      />

      <InnovationShowcase
        items={[
          {
            title: "World Model Benchmark",
            detail: "ประเมินคุณภาพการจำลองสภาพแวดล้อมระบบหลัง agent ทำงาน ตามกรอบ Qwen/AgentWorldBench",
          },
          {
            title: "HEPA Live Adapter",
            detail: "ทดสอบ endpoint จริง เช่น สุขภาพระบบ, automation, HOSxP sync และการเชื่อมต่อรายงาน",
          },
          {
            title: "หลักฐานต่อผู้ตรวจ",
            detail: "แสดงผลแบบตรวจสอบได้ทันที พร้อมเวลาทดสอบ คะแนนรวม และรายละเอียดรายการ",
          },
        ]}
      />

      <section className="grid gap-6 lg:grid-cols-[1fr_.9fr]">
        <Card className="metric-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PlayCircle className="h-5 w-5 text-teal" />
              รันชุดทดสอบ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 text-muted-foreground">
              ระบบจะเรียก API จริง {meta.data?.scenarios.length || 0} รายการ แล้วให้คะแนน 5 มิติตามมาตรฐาน
              AgentWorldBench
            </p>
            <Button
              onClick={() => run.mutate()}
              disabled={run.isPending}
              className="gap-2"
            >
              {run.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4" />
              )}
              {run.isPending ? "กำลังทดสอบ..." : "เริ่มทดสอบทั้งหมด"}
            </Button>
            {run.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                {run.error instanceof Error ? run.error.message : "เกิดข้อผิดพลาด"}
              </div>
            )}
            {summary && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-emerald-900">
                      ผ่าน {summary.passed}/{summary.total} รายการ
                    </div>
                    <div className="mt-1 text-xs text-emerald-800">
                      อัปเดตล่าสุด {new Date(summary.ranAt).toLocaleString("th-TH")}
                    </div>
                  </div>
                  <Badge className="bg-emerald-700 text-white hover:bg-emerald-700">
                    คะแนนรวม {(summary.averageScore * 100).toFixed(1)}%
                  </Badge>
                </div>
                <Progress value={readinessPercent} className="mt-3 h-2" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5 text-teal" />
              คะแนนแยกตามโดเมน
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary
              ? Object.entries(summary.byDomain)
                  .filter(([, bucket]) => bucket.total > 0)
                  .map(([domain, bucket]) => (
                    <div key={domain} className="rounded-lg border bg-background/60 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">
                          {domainLabels[domain] || domain}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {bucket.passed}/{bucket.total} ผ่าน
                        </span>
                      </div>
                      <div className="mt-2 text-2xl font-bold">
                        {(bucket.averageScore * 100).toFixed(1)}%
                      </div>
                    </div>
                  ))
              : meta.data?.scenarios.map((scenario) => (
                  <div key={scenario.id} className="rounded-lg border bg-background/60 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{scenario.title}</span>
                      <Badge variant="outline">{domainLabels[scenario.task] || scenario.task}</Badge>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {scenario.instruction}
                    </p>
                  </div>
                ))}
          </CardContent>
        </Card>
      </section>

      <Card className="metric-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-5 w-5 text-primary" />
            ชุดข้อมูลอ้างอิง Qwen/AgentWorldBench
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {meta.data?.dataset?.loaded ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-emerald-700 text-white hover:bg-emerald-700">
                  โหลดแล้ว {meta.data.dataset.totalSamples.toLocaleString("th-TH")} ตัวอย่าง
                </Badge>
                {meta.data.dataset.s3.configured && (
                  <Badge variant="outline" className="border-violet-200 bg-white text-violet-900">
                    S3: {meta.data.dataset.s3.bucket}
                  </Badge>
                )}
              </div>
              <p className="text-sm leading-6 text-violet-950/80">
                โฟกัสโดเมนที่เกี่ยวกับ HEPA:{" "}
                {meta.data.dataset.hepaFocus.map((d) => domainLabels[d] || d).join(", ")}
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {meta.data.dataset.domains.slice(0, 7).map((item) => (
                  <div key={item.domain} className="rounded-lg border border-violet-200 bg-white/80 p-3">
                    <div className="text-xs text-muted-foreground">
                      {domainLabels[item.domain] || item.domain}
                    </div>
                    <div className="text-lg font-bold text-violet-950">
                      {item.samples.toLocaleString("th-TH")}
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-violet-900/70">
                  ตัวอย่างคำสั่งจากชุดข้อมูล
                </div>
                {meta.data.dataset.previews.map((preview) => (
                  <div
                    key={`${preview.domain}-${preview.id}`}
                    className="rounded-lg border border-violet-200 bg-white/80 p-3 text-sm text-violet-950"
                  >
                    <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{domainLabels[preview.domain] || preview.domain}</Badge>
                      <span>เทิร์น {preview.turn}</span>
                    </div>
                    {preview.instruction}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              ยังไม่พบไฟล์ชุดข้อมูล — รัน{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">pnpm bench:download</code>{" "}
              เพื่อดาวน์โหลดจาก Hugging Face
            </p>
          )}
        </CardContent>
      </Card>

      {summary && (
        <Card className="metric-card">
          <CardHeader>
            <CardTitle className="text-base">ผลรายละเอียด</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.results.map((result) => (
              <div key={result.scenario.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {result.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="font-medium">{result.scenario.title}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">
                      {domainLabels[result.scenario.task] || result.scenario.task}
                    </Badge>
                    <span>{result.latencyMs} ms</span>
                    <span>{(result.averageScore * 100).toFixed(1)}%</span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(result.scores).map(([key, value]) => (
                    <Badge key={key} variant="secondary" className="font-normal">
                      {dimensionLabels[key] || key}: {(value * 100).toFixed(0)}%
                    </Badge>
                  ))}
                </div>
                {result.failures.length > 0 && (
                  <div className="mt-2 text-xs text-red-700">{result.failures.join(" · ")}</div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <OfficialNavHint to="/agent" label="หน้าระบบติดตามอัจฉริยะ (LINE Agent)" />
    </div>
  );
}