import { createFileRoute } from "@tanstack/react-router";
import { bootstrapFromPreparedPatients } from "@/lib/bootstrap-hosxp-sync";
import {
  isHosxpSyncFresh,
  mergeHosxpSyncRecords,
  readHosxpSync,
} from "@/lib/hosxp-sync-store";
import { serverEnv } from "@/lib/server-env";

function authorized(request: Request) {
  const required =
    serverEnv("HEPA_HOSXP_SYNC_TOKEN") ||
    serverEnv("HEPA_HOSXP_PROXY_TOKEN") ||
    serverEnv("HEPA_AWS_API_KEY");
  if (!required) return true;

  const header = request.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const apiKey = request.headers.get("x-hepaglue-token") || request.headers.get("x-api-key") || "";
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token") || "";
  return bearer === required || apiKey === required || queryToken === required;
}

export const Route = createFileRoute("/api/hosxp-sync")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!authorized(request)) {
          return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        }
        const sync = readHosxpSync();
        return Response.json({
          ok: true,
          fresh: isHosxpSyncFresh(),
          syncedAt: sync?.syncedAt || null,
          source: sync?.source || null,
          count: sync?.records?.length || 0,
          dateFrom: sync?.dateFrom || null,
          dateTo: sync?.dateTo || null,
        });
      },
      POST: async ({ request }) => {
        if (!authorized(request)) {
          return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        }

        const body = (await request.json().catch(() => ({}))) as {
          action?: string;
          source?: string;
          date_from?: string;
          date_to?: string;
          records?: Array<Record<string, unknown>>;
          bridge?: { records?: Array<Record<string, unknown>> };
        };

        if (body.action === "bootstrap_prepared") {
          const saved = bootstrapFromPreparedPatients();
          return Response.json({
            ok: true,
            bootstrapped: true,
            syncedAt: saved.syncedAt,
            count: saved.records.length,
            message: "Seeded HOSxP sync cache from prepared target registry",
          });
        }

        const records = body.records || body.bridge?.records || [];
        if (!Array.isArray(records) || records.length === 0) {
          return Response.json({ ok: false, error: "records required" }, { status: 400 });
        }

        const saved = mergeHosxpSyncRecords(records, {
          source: body.source || "hospital_push",
          dateFrom: body.date_from,
          dateTo: body.date_to,
        });

        return Response.json({
          ok: true,
          syncedAt: saved.syncedAt,
          count: saved.records.length,
          message: "HOSxP lab data synced to VPS",
        });
      },
    },
  },
});