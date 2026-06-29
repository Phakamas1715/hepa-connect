import { createFileRoute } from "@tanstack/react-router";
import { serverEnv } from "@/lib/server-env";

export const Route = createFileRoute("/health")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({
          ok: true,
          service: "hepa-connect",
          environment: serverEnv("NODE_ENV") || process.env.NODE_ENV || "development",
          checkedAt: new Date().toISOString(),
        }),
    },
  },
});
