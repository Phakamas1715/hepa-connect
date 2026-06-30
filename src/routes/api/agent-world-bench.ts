import { createFileRoute } from "@tanstack/react-router";
import { getAgentWorldBenchDatasetInfo } from "@/lib/agent-world-bench/hf-dataset";
import {
  listAgentWorldBenchScenarios,
  runAgentWorldBench,
} from "@/lib/agent-world-bench/runner";

function requestBaseUrl(request: Request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export const Route = createFileRoute("/api/agent-world-bench")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json({
          source: "Qwen/AgentWorldBench",
          adapter: "HEPA-Connect",
          description:
            "ชุดทดสอบจำลองสภาพแวดล้อม agent สำหรับ endpoint จริงของ HEPA — อ้างอิงรูปแบบ AgentWorldBench",
          dimensions: ["format", "factuality", "consistency", "realism", "quality"],
          scenarios: listAgentWorldBenchScenarios(),
          dataset: getAgentWorldBenchDatasetInfo(),
        });
      },
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as { baseUrl?: string };
          const baseUrl = body.baseUrl || requestBaseUrl(request);
          const summary = await runAgentWorldBench(baseUrl);
          return Response.json({ status: "success", ...summary });
        } catch (error) {
          const message = error instanceof Error ? error.message : "agent world bench failed";
          return Response.json({ status: "error", message }, { status: 500 });
        }
      },
    },
  },
});