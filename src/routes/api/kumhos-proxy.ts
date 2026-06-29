import { createFileRoute } from "@tanstack/react-router";
import { getKumhosHosxpProxyStatus } from "@/lib/kumhos-client";

export const Route = createFileRoute("/api/kumhos-proxy")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const status = await getKumhosHosxpProxyStatus();
          return Response.json({
            ok: true,
            state: "ready",
            status,
          });
        } catch (error) {
          return Response.json({
            ok: false,
            state: "blocked",
            error: error instanceof Error ? error.message : "KUMHOS proxy check failed",
          });
        }
      },
    },
  },
});
