import { createFileRoute } from "@tanstack/react-router";
import { resolveHosxpProxyUrl } from "@/lib/hosxp-proxy-url";
import { serverEnv } from "@/lib/server-env";

type BridgePayload = {
  ok?: boolean;
  error?: string;
  count?: number;
  records?: Array<Record<string, unknown>>;
  tables?: Record<string, boolean>;
  mode?: string;
  mysql_version?: string;
  checked_at?: string;
};

async function callBridge(request: Request) {
  const proxyUrl = resolveHosxpProxyUrl();
  if (!proxyUrl) {
    return Response.json(
      {
        ok: false,
        state: "not_configured",
        error: "ยังไม่ได้ตั้งค่า HEPA_HOSXP_PROXY_URL",
      },
      { status: 200 },
    );
  }

  const requestUrl = new URL(request.url);
  const action = requestUrl.searchParams.get("action") || "status";
  const limit = requestUrl.searchParams.get("limit") || "50";
  const dateFrom = requestUrl.searchParams.get("date_from") || "";
  const dateTo = requestUrl.searchParams.get("date_to") || "";

  const url = new URL(proxyUrl);
  url.searchParams.set("action", action);
  url.searchParams.set("limit", limit);
  if (dateFrom) url.searchParams.set("date_from", dateFrom);
  if (dateTo) url.searchParams.set("date_to", dateTo);

  const token = serverEnv("HEPA_HOSXP_PROXY_TOKEN");
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...(token ? { "X-HEPAGLUE-TOKEN": token } : {}),
      },
      signal: AbortSignal.timeout(15_000),
    });
    const payload = (await response.json().catch(() => null)) as BridgePayload | null;

    if (!response.ok || !payload?.ok) {
      return Response.json(
        {
          ok: false,
          state: response.status === 401 ? "blocked" : "partial",
          httpStatus: response.status,
          error: payload?.error || "เรียก HEPA HOSxP bridge ไม่สำเร็จ",
        },
        { status: 200 },
      );
    }

    return Response.json({
      ok: true,
      state: "ready",
      bridge: payload,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        state: "blocked",
        error: error instanceof Error ? error.message : "เชื่อมต่อ HEPA HOSxP bridge ไม่สำเร็จ",
      },
      { status: 200 },
    );
  }
}

export const Route = createFileRoute("/api/hosxp-bridge")({
  server: {
    handlers: {
      GET: ({ request }) => callBridge(request),
    },
  },
});
