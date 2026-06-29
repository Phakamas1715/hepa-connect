import { createFileRoute } from "@tanstack/react-router";
import { getKumhosHosxpProxyStatus } from "@/lib/kumhos-client";
import { readAgentStore } from "@/lib/hepa-agent-store";
import { serverEnv } from "@/lib/server-env";

type GateState = "ready" | "partial" | "blocked";

type Gate = {
  id: string;
  name: string;
  state: GateState;
  detail: string;
  required: boolean;
};

function ready(id: string, name: string, detail: string, required = true): Gate {
  return { id, name, state: "ready", detail, required };
}

function partial(id: string, name: string, detail: string, required = true): Gate {
  return { id, name, state: "partial", detail, required };
}

function blocked(id: string, name: string, detail: string, required = true): Gate {
  return { id, name, state: "blocked", detail, required };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function getKumhosStatusFast() {
  return withTimeout(getKumhosHosxpProxyStatus(), 8_000, "KUMHOS/HOSxP proxy health check timed out after 8 seconds");
}

type KumhosStatus = Awaited<ReturnType<typeof getKumhosHosxpProxyStatus>>;

function lineGate(): Gate {
  const token = serverEnv("LINE_CHANNEL_ACCESS_TOKEN");
  const pushEnabled = serverEnv("LINE_PUSH_ENABLED") === "true";
  if (token && pushEnabled) return ready("line_push", "LINE push", "LINE token พร้อม และเปิดส่งจริงแล้ว");
  if (token) return partial("line_push", "LINE push", "มี token แล้ว แต่ยังไม่ได้เปิด LINE_PUSH_ENABLED=true");
  return blocked("line_push", "LINE push", "ยังไม่มี LINE_CHANNEL_ACCESS_TOKEN");
}

function mophGate(): Gate {
  const username = serverEnv("MOPH_USERNAME") || serverEnv("VITE_MOPH_USERNAME");
  const password = serverEnv("MOPH_PASSWORD") || serverEnv("VITE_MOPH_PASSWORD");
  const endpoint = serverEnv("MOPH_REPORTER_ENDPOINT");
  if (username && password && endpoint) return ready("moph_report", "MOPH report", "มี credential และ endpoint สำหรับส่ง production", false);
  if (username && password) return partial("moph_report", "MOPH report", "มี credential แล้ว แต่ยังไม่มี MOPH_REPORTER_ENDPOINT", false);
  return partial("moph_report", "MOPH report", "ยังไม่บล็อกการทำงาน LINE/HOSxP: ใช้รายงานแบบตรวจสอบก่อนส่ง MOPH ภายหลัง", false);
}

async function awsGatewayGate(): Promise<Gate> {
  const apiKey = serverEnv("HEPA_AWS_API_KEY");
  const gatewayUrl = serverEnv("HEPA_AWS_API_GATEWAY_URL");
  const healthPath = serverEnv("HEPA_AWS_API_HEALTH_PATH") || "/health";

  if (!apiKey && !gatewayUrl) {
    return partial("aws_api_gateway", "AWS API Gateway", "ยังไม่ได้ตั้งค่า AWS API Gateway สำหรับ public webhook/proxy", false);
  }

  if (apiKey && !gatewayUrl) {
    return partial("aws_api_gateway", "AWS API Gateway", "มี API key แล้ว แต่ยังไม่มี HEPA_AWS_API_GATEWAY_URL จึงยังยิงทดสอบ endpoint ไม่ได้", false);
  }

  if (!apiKey && gatewayUrl) {
    return partial("aws_api_gateway", "AWS API Gateway", "มี Invoke URL แล้ว แต่ยังไม่มี HEPA_AWS_API_KEY สำหรับส่ง x-api-key", false);
  }

  try {
    const baseUrl = gatewayUrl.endsWith("/") ? gatewayUrl : `${gatewayUrl}/`;
    const url = new URL(healthPath.replace(/^\//, ""), baseUrl);
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "x-api-key": apiKey,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (response.ok) {
      return ready("aws_api_gateway", "AWS API Gateway", `API Gateway ตอบกลับสำเร็จที่ ${url.pathname}`, false);
    }

    return partial(
      "aws_api_gateway",
      "AWS API Gateway",
      `ตั้งค่าแล้ว แต่ health check ตอบ ${response.status}; ตรวจ route/stage/usage plan อีกครั้ง`,
      false,
    );
  } catch (error) {
    return partial(
      "aws_api_gateway",
      "AWS API Gateway",
      `ตั้งค่าแล้ว แต่ยังเรียก endpoint ไม่สำเร็จ: ${error instanceof Error ? error.message : "unknown error"}`,
      false,
    );
  }
}

async function bridgeGate(kumhosStatus?: KumhosStatus): Promise<Gate> {
  const proxyUrl = serverEnv("HEPA_HOSXP_PROXY_URL");
  const token = serverEnv("HEPA_HOSXP_PROXY_TOKEN");

  if (proxyUrl) {
    const url = new URL(proxyUrl);
    url.searchParams.set("action", "hepatitis_labs");
    url.searchParams.set("limit", "1");

    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          ...(token ? { "X-HEPAGLUE-TOKEN": token } : {}),
        },
        signal: AbortSignal.timeout(12_000),
      });
      const payload = (await response.json().catch(() => null)) as null | { ok?: boolean; count?: number; error?: string };
      if (response.ok && payload?.ok) {
        return ready(
          "hepatitis_feed",
          "Hepatitis lab feed",
          `ดึง HBsAg / Anti-HCV / HCV RNA ผ่าน bridge ได้แล้ว (${payload.count ?? 0} records preview)`,
        );
      }
    } catch {
      // Fall back to the no-IT path below.
    }
  }

  try {
    const kumhos = kumhosStatus || (await getKumhosStatusFast());
    return ready(
      "hepatitis_feed",
      "Hepatitis lab feed",
      `ใช้โหมดไม่ง้อ IT: KUMHOS ดึง HOSxP แบบ HN/date pull ได้แล้ว; lab code ที่พบ ${Object.values(kumhos.codes).join(", ") || "-"}`,
    );
  } catch (error) {
    return blocked(
      "hepatitis_feed",
      "Hepatitis lab feed",
      `ยังดึง lab hepatitis ไม่สำเร็จ: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

async function automationStatus() {
  const gates: Gate[] = [];
  let kumhosStatus: KumhosStatus | undefined;

  try {
    const kumhos = await getKumhosStatusFast();
    kumhosStatus = kumhos;
    gates.push(
      ready(
        "hosxp_proxy",
        "HOSxP proxy",
        `KUMHOS proxy login/query สำเร็จ; test lab codes ${Object.values(kumhos.codes).join(", ") || "-"}`,
      ),
    );
  } catch (error) {
    gates.push(blocked("hosxp_proxy", "HOSxP proxy", error instanceof Error ? error.message : "KUMHOS proxy ไม่พร้อม"));
  }

  gates.push(await bridgeGate(kumhosStatus));
  gates.push(lineGate());
  gates.push(mophGate());
  gates.push(await awsGatewayGate());

  const store = readAgentStore();
  gates.push(
    store.audit.length > 0
      ? ready("audit_closed_loop", "Audit / closed loop", `มี audit log แล้ว ${store.audit.length} events`, false)
      : partial("audit_closed_loop", "Audit / closed loop", "ระบบ audit พร้อม แต่ยังไม่มี event production", false),
  );

  const required = gates.filter((gate) => gate.required);
  const readyRequired = required.filter((gate) => gate.state === "ready").length;
  const readiness = Math.round((readyRequired / Math.max(required.length, 1)) * 100);
  const canRunProduction = required.every((gate) => gate.state === "ready");

  return {
    checkedAt: new Date().toISOString(),
    readiness,
    canRunProduction,
    mode: canRunProduction ? "production-no-it" : "guarded",
    gates,
    nextAction: canRunProduction
      ? "พร้อมเปิด production automation แบบไม่ง้อ IT: ใช้ KUMHOS เป็น HOSxP proxy, LINE เป็น closed loop, และ audit ทุกครั้ง"
      : "ยังไม่เปิดส่ง production อัตโนมัติ เพราะ gate สำคัญยังไม่ครบ",
  };
}

function automationTimeoutStatus(error: unknown) {
  const detail = error instanceof Error ? error.message : "production automation health check timed out";
  return {
    checkedAt: new Date().toISOString(),
    readiness: 0,
    canRunProduction: false,
    mode: "guarded",
    gates: [
      blocked("hosxp_proxy", "HOSxP proxy", detail),
      blocked("hepatitis_feed", "Hepatitis lab feed", "Health check did not finish fast enough; automation remains guarded."),
      lineGate(),
      mophGate(),
      partial("aws_api_gateway", "AWS API Gateway", "Skipped because the main production health check timed out", false),
      partial("audit_closed_loop", "Audit / closed loop", "Audit store is available; endpoint returned guarded timeout status", false),
    ],
    nextAction: "HOSxP/KUMHOS bridge is slow or unreachable from the VPS; keep the app online and run automation in guarded mode.",
  };
}

async function automationStatusFast() {
  try {
    return await withTimeout(automationStatus(), 9_000, "production automation health check timed out after 9 seconds");
  } catch (error) {
    return automationTimeoutStatus(error);
  }
}

export const Route = createFileRoute("/api/production-automation")({
  server: {
    handlers: {
      GET: async () => Response.json(await automationStatusFast()),
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as { force?: boolean };
        const status = await automationStatusFast();
        if (!status.canRunProduction && !body.force) {
          return Response.json(
            {
              status: "blocked",
              message: "ยังไม่เปิด production automation เพราะ gate สำคัญยังไม่ครบ",
              ...status,
            },
            { status: 409 },
          );
        }
        return Response.json({
          status: "armed",
          message: body.force
            ? "เปิดแบบ force guard แล้ว: ระบบจะ audit และไม่ส่งออกปลายทางที่ยังไม่พร้อม"
            : "production automation armed",
          ...status,
        });
      },
    },
  },
});
