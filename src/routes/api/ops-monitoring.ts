import { createFileRoute } from "@tanstack/react-router";
import { readAgentStore } from "@/lib/hepa-agent-store";
import { serverEnv } from "@/lib/server-env";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ route: "/api/ops-monitoring" });

function mask(str?: string, keep = 4) {
  if (!str) return undefined;
  if (str.length <= keep * 2) return "***";
  return str.slice(0, keep) + "..." + str.slice(-keep);
}

function isAuthorized(request: Request) {
  const required = serverEnv("OPS_MONITORING_TOKEN");
  if (!required) return true;

  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token");
  const header = request.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  return queryToken === required || bearer === required;
}

export const Route = createFileRoute("/api/ops-monitoring")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthorized(request)) {
          logger.warn("ops monitoring unauthorized");
          return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        }

        const store = readAgentStore();

        // Recent safe audit summary (last 20, masked)
        const recentAudit = store.audit.slice(0, 20).map((a) => ({
          at: a.at,
          actor: a.actor,
          action: a.action,
          hn: mask(a.hn),
          detail: a.detail?.slice(0, 120),
        }));

        const status = {
          ok: true,
          service: "hepa-connect-ops",
          environment: serverEnv("NODE_ENV") || "production",
          time: new Date().toISOString(),
          config: {
            linePushEnabled: serverEnv("LINE_PUSH_ENABLED") === "true",
            hasLineToken: !!serverEnv("LINE_CHANNEL_ACCESS_TOKEN"),
            hasHosxpProxy: !!serverEnv("HEPA_HOSXP_PROXY_URL"),
            agentStorePath: serverEnv("HEPA_AGENT_STORE_PATH") || "data/hepa-agent-store.json",
            workerEnabled: serverEnv("HEPA_BACKGROUND_WORKER_ENABLED") === "true",
          },
          storeSummary: {
            invites: store.invites.length,
            verifiedIdentities: store.identities.filter((i) => i.status === "verified").length,
            pendingTasks: store.tasks.filter((t) => t.status === "pending").length,
            activeAppointments: store.appointments.filter(
              (item) => item.status !== "completed" && item.status !== "cancelled",
            ).length,
            totalAudit: store.audit.length,
          },
          recentAudit,
          note: "This endpoint is for operator debugging. Do not expose publicly without auth.",
        };

        logger.info("ops monitoring accessed");

        return Response.json(status);
      },
    },
  },
});
