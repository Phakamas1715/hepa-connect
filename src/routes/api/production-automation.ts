import { createFileRoute } from "@tanstack/react-router";
import { getKumhosHosxpProxyStatus } from "@/lib/kumhos-client";
import { getAgentStorePath, readAgentStore } from "@/lib/hepa-agent-store";
import { serverEnv } from "@/lib/server-env";
import { PREPARED_PATIENTS } from "@/lib/hepa-data";

type GateState = "ready" | "partial" | "blocked";

type Gate = {
  id: string;
  name: string;
  state: GateState;
  detail: string;
  required: boolean;
  action?: string;
};

function ready(id: string, name: string, detail: string, required = true, action?: string): Gate {
  return { id, name, state: "ready", detail, required, action };
}

function partial(id: string, name: string, detail: string, required = true, action?: string): Gate {
  return { id, name, state: "partial", detail, required, action };
}

function blocked(id: string, name: string, detail: string, required = true, action?: string): Gate {
  return { id, name, state: "blocked", detail, required, action };
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
  return withTimeout(
    getKumhosHosxpProxyStatus(),
    8_000,
    "KUMHOS/HOSxP proxy health check timed out after 8 seconds",
  );
}

type KumhosStatus = Awaited<ReturnType<typeof getKumhosHosxpProxyStatus>>;

function lineGate(): Gate {
  const token = serverEnv("LINE_CHANNEL_ACCESS_TOKEN");
  const pushEnabled = serverEnv("LINE_PUSH_ENABLED") === "true";
  if (token && pushEnabled)
    return ready("line_push", "LINE push", "LINE token พร้อม และเปิดส่งจริงแล้ว");
  if (token) {
    return partial(
      "line_push",
      "LINE push",
      "มี token แล้ว แต่ยังไม่ได้เปิด LINE_PUSH_ENABLED=true",
      true,
      "ทดสอบส่งหา LINE_TEST_RECIPIENT_ID ก่อน แล้วตั้ง LINE_PUSH_ENABLED=true เมื่อพร้อมส่งจริง",
    );
  }
  return blocked(
    "line_push",
    "LINE push",
    "ยังไม่มี LINE_CHANNEL_ACCESS_TOKEN",
    true,
    "สร้าง long-lived channel access token ใน LINE Developers แล้วใส่ LINE_CHANNEL_ACCESS_TOKEN",
  );
}

function mophGate(): Gate {
  const username = serverEnv("MOPH_USERNAME") || serverEnv("VITE_MOPH_USERNAME");
  const password = serverEnv("MOPH_PASSWORD") || serverEnv("VITE_MOPH_PASSWORD");
  const endpoint = serverEnv("MOPH_REPORTER_ENDPOINT");
  if (username && password && endpoint)
    return ready(
      "moph_report",
      "MOPH report",
      "มี credential และ endpoint สำหรับส่ง production",
      false,
    );
  if (username && password) {
    return partial(
      "moph_report",
      "MOPH report",
      "มี credential แล้ว แต่ยังไม่มี MOPH_REPORTER_ENDPOINT",
      false,
      "ตั้ง MOPH_REPORTER_ENDPOINT เป็น service ภายในที่ login/session ถูกต้อง",
    );
  }
  return partial(
    "moph_report",
    "MOPH report",
    "ยังไม่บล็อกการทำงาน LINE/HOSxP: ใช้รายงานแบบตรวจสอบก่อนส่ง MOPH ภายหลัง",
    false,
    "เติม MOPH_USERNAME, MOPH_PASSWORD และ MOPH_REPORTER_ENDPOINT เมื่อจะส่งรายงานจริง",
  );
}

function targetRegistryGate(): Gate {
  const confirmed = serverEnv("HEPA_TARGET_REGISTRY_CONFIRMED") === "true";
  if (confirmed) {
    return ready(
      "target_registry_confirmed",
      "Prepared target registry",
      `ยืนยันรายชื่อกลางสำหรับ production แล้ว (${PREPARED_PATIENTS.length.toLocaleString()} records ใน runtime นี้)`,
    );
  }

  return partial(
    "target_registry_confirmed",
    "Prepared target registry",
    `มีรายชื่อกลางในระบบ ${PREPARED_PATIENTS.length.toLocaleString()} records แต่ยังไม่ได้ยืนยันว่าเป็นรายชื่อจริงครบชุด`,
    true,
    "นำเข้ารายชื่อจริงทั้งหมดและตั้ง HEPA_TARGET_REGISTRY_CONFIRMED=true หลังตรวจ mapping รพ.สต./ตำบล/หมู่บ้าน",
  );
}

function workerGate(): Gate {
  const workerEnabled = serverEnv("HEPA_BACKGROUND_WORKER_ENABLED") === "true";
  if (workerEnabled) {
    return ready(
      "background_worker",
      "Background worker / retry",
      "เปิด worker สำหรับ queue, retry และ scheduled jobs แล้ว",
    );
  }
  return partial(
    "background_worker",
    "Background worker / retry",
    "ยังไม่มี worker แยกสำหรับ queue/retry; ตอนนี้เหมาะกับ manual operation และ guarded automation",
    true,
    "เพิ่ม worker/cron สำหรับส่ง LINE, sync lab, retry failed jobs และ nightly audit แล้วตั้ง HEPA_BACKGROUND_WORKER_ENABLED=true",
  );
}

function agentStoreGate(): Gate {
  const configuredPath = serverEnv("HEPA_AGENT_STORE_PATH");
  const currentPath = getAgentStorePath();
  if (configuredPath) {
    return ready(
      "agent_store",
      "Persistent agent store",
      `เก็บ invite/identity/task/audit ที่ ${currentPath}`,
      false,
    );
  }
  return partial(
    "agent_store",
    "Persistent agent store",
    `ยังใช้ local file ${currentPath}; ถ้า deploy บน Render/VPS ต้อง mount persistent disk หรือย้ายไป DB`,
    false,
    "ตั้ง HEPA_AGENT_STORE_PATH ไปยัง mounted disk หรือย้าย agent store ไป Postgres/Supabase ก่อน production ระยะยาว",
  );
}

async function appointmentGate(): Promise<Gate> {
  const appointmentUrl = serverEnv("NPH_APPOINTMENT_URL");
  const username = serverEnv("NPH_APPOINTMENT_USERNAME");
  const password = serverEnv("NPH_APPOINTMENT_PASSWORD");

  if (!appointmentUrl) {
    return partial(
      "nph_appointment",
      "NPH appointment",
      "ยังไม่ได้ตั้งค่า NPH_APPOINTMENT_URL",
      false,
      "เติม URL ระบบนัดหมายใน NPH_APPOINTMENT_URL หากต้องการใช้ปิด loop เรื่องนัดติดตาม",
    );
  }

  try {
    const response = await fetch(appointmentUrl, {
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
    });
    const loginRedirect =
      response.status >= 300 &&
      response.status < 400 &&
      response.headers.get("location")?.includes("login");
    if (!response.ok && !loginRedirect) {
      return partial(
        "nph_appointment",
        "NPH appointment",
        `ระบบนัดหมายตอบกลับ ${response.status}`,
        false,
        "ตรวจ URL, network และสิทธิ์เข้าถึงระบบนัดหมาย",
      );
    }

    if (username && password) {
      return ready(
        "nph_appointment",
        "NPH appointment",
        "เข้าถึงระบบนัดหมายได้ และมี credential ใน env แล้ว",
        false,
      );
    }

    return partial(
      "nph_appointment",
      "NPH appointment",
      "เข้าถึงระบบนัดหมายได้ แต่ยังไม่ได้ตั้งค่า username/password",
      false,
      "เติม NPH_APPOINTMENT_USERNAME และ NPH_APPOINTMENT_PASSWORD",
    );
  } catch (error) {
    return partial(
      "nph_appointment",
      "NPH appointment",
      `ยังเรียกระบบนัดหมายไม่สำเร็จ: ${error instanceof Error ? error.message : "unknown error"}`,
      false,
      "ตรวจ network ไป 192.168.215.18 หรือเปิด tunnel/agent ฝั่งโรงพยาบาล",
    );
  }
}

async function awsGatewayGate(): Promise<Gate> {
  const apiKey = serverEnv("HEPA_AWS_API_KEY");
  const gatewayUrl = serverEnv("HEPA_AWS_API_GATEWAY_URL");
  const healthPath = serverEnv("HEPA_AWS_API_HEALTH_PATH") || "/health";

  if (!apiKey && !gatewayUrl) {
    return partial(
      "aws_api_gateway",
      "AWS API Gateway",
      "ยังไม่ได้ตั้งค่า AWS API Gateway สำหรับ public webhook/proxy",
      false,
      "ตั้งเฉพาะเมื่อจะรับ webhook/public proxy ผ่าน AWS API Gateway",
    );
  }

  if (apiKey && !gatewayUrl) {
    return partial(
      "aws_api_gateway",
      "AWS API Gateway",
      "มี API key แล้ว แต่ยังไม่มี HEPA_AWS_API_GATEWAY_URL จึงยังยิงทดสอบ endpoint ไม่ได้",
      false,
      "เติม Invoke URL ของ API Gateway",
    );
  }

  if (!apiKey && gatewayUrl) {
    return partial(
      "aws_api_gateway",
      "AWS API Gateway",
      "มี Invoke URL แล้ว แต่ยังไม่มี HEPA_AWS_API_KEY สำหรับส่ง x-api-key",
      false,
      "เติม API key หรือปรับ authorizer ให้ตรงกับ gateway จริง",
    );
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
      return ready(
        "aws_api_gateway",
        "AWS API Gateway",
        `API Gateway ตอบกลับสำเร็จที่ ${url.pathname}`,
        false,
      );
    }

    return partial(
      "aws_api_gateway",
      "AWS API Gateway",
      `ตั้งค่าแล้ว แต่ health check ตอบ ${response.status}; ตรวจ route/stage/usage plan อีกครั้ง`,
      false,
      "ตรวจ HEPA_AWS_API_HEALTH_PATH, stage, route และ usage plan",
    );
  } catch (error) {
    return partial(
      "aws_api_gateway",
      "AWS API Gateway",
      `ตั้งค่าแล้ว แต่ยังเรียก endpoint ไม่สำเร็จ: ${error instanceof Error ? error.message : "unknown error"}`,
      false,
      "ตรวจ network, DNS, certificate และ API Gateway invoke URL",
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
      const payload = (await response.json().catch(() => null)) as null | {
        ok?: boolean;
        count?: number;
        error?: string;
      };
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
      `KUMHOS ดึงข้อมูล HOSxP แบบ HN/date pull ได้แล้ว; lab code ที่พบ ${Object.values(kumhos.codes).join(", ") || "-"}`,
    );
  } catch (error) {
    return blocked(
      "hepatitis_feed",
      "Hepatitis lab feed",
      `ยังดึง lab hepatitis ไม่สำเร็จ: ${error instanceof Error ? error.message : "unknown error"}`,
      true,
      "ตั้ง HEPA_HOSXP_PROXY_URL หรือ KUMHOS credential ให้ดึง HBsAg / Anti-HCV / HCV RNA ได้",
    );
  }
}

async function automationStatus() {
  const gates: Gate[] = [];
  let kumhosStatus: KumhosStatus | undefined;

  gates.push(targetRegistryGate());

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
    gates.push(
      blocked(
        "hosxp_proxy",
        "HOSxP proxy",
        error instanceof Error ? error.message : "KUMHOS proxy ไม่พร้อม",
      ),
    );
  }

  gates.push(await bridgeGate(kumhosStatus));
  gates.push(lineGate());
  gates.push(workerGate());
  gates.push(mophGate());
  gates.push(await awsGatewayGate());
  gates.push(await appointmentGate());
  gates.push(agentStoreGate());

  const store = readAgentStore();
  gates.push(
    store.audit.length > 0
      ? ready(
          "audit_closed_loop",
          "Audit / closed loop",
          `มี audit log แล้ว ${store.audit.length} events`,
          false,
        )
      : partial(
          "audit_closed_loop",
          "Audit / closed loop",
          "ระบบ audit พร้อม แต่ยังไม่มี event production",
          false,
        ),
  );

  const required = gates.filter((gate) => gate.required);
  const readyRequired = required.filter((gate) => gate.state === "ready").length;
  const readiness = Math.round((readyRequired / Math.max(required.length, 1)) * 100);
  const canRunProduction = required.every((gate) => gate.state === "ready");
  const gaps = gates
    .filter((gate) => gate.state !== "ready")
    .map((gate) => ({
      id: gate.id,
      name: gate.name,
      state: gate.state,
      required: gate.required,
      detail: gate.detail,
      action: gate.action || "ตรวจ configuration และทดสอบซ้ำ",
      priority: gate.required ? (gate.state === "blocked" ? "critical" : "high") : "medium",
    }));

  return {
    checkedAt: new Date().toISOString(),
    readiness,
    canRunProduction,
    mode: canRunProduction ? "production-no-it" : "guarded",
    gates,
    gaps,
    nextAction: canRunProduction
      ? "ผ่านเงื่อนไขการใช้งาน: ใช้ KUMHOS เป็น HOSxP proxy, LINE เป็นช่องทางติดตาม และบันทึก audit log"
      : "ยังไม่ผ่านเงื่อนไขการใช้งาน เนื่องจาก gate สำคัญยังไม่ครบ",
  };
}

function automationTimeoutStatus(error: unknown) {
  const detail =
    error instanceof Error ? error.message : "production automation health check timed out";
  return {
    checkedAt: new Date().toISOString(),
    readiness: 0,
    canRunProduction: false,
    mode: "guarded",
    gates: [
      blocked("hosxp_proxy", "HOSxP proxy", detail),
      blocked(
        "hepatitis_feed",
        "Hepatitis lab feed",
        "Health check did not finish fast enough; automation remains guarded.",
      ),
      lineGate(),
      targetRegistryGate(),
      workerGate(),
      mophGate(),
      partial(
        "aws_api_gateway",
        "AWS API Gateway",
        "Skipped because the main production health check timed out",
        false,
      ),
      agentStoreGate(),
      partial(
        "audit_closed_loop",
        "Audit / closed loop",
        "Audit store is available; endpoint returned guarded timeout status",
        false,
      ),
    ],
    gaps: [
      {
        id: "health_check_timeout",
        name: "Production health check",
        state: "blocked",
        required: true,
        detail,
        action: "ตรวจ network ไป KUMHOS/HOSxP และลด timeout/ทำ background health cache",
        priority: "critical",
      },
    ],
    nextAction:
      "HOSxP/KUMHOS bridge is slow or unreachable from the VPS; keep the app online and run automation in guarded mode.",
  };
}

async function automationStatusFast() {
  try {
    return await withTimeout(
      automationStatus(),
      9_000,
      "production automation health check timed out after 9 seconds",
    );
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
              message: "ยังไม่เปิดใช้งาน เนื่องจาก gate สำคัญยังไม่ครบ",
              ...status,
            },
            { status: 409 },
          );
        }
        return Response.json({
          status: "armed",
          message: body.force
            ? "เปิดแบบ force guard แล้ว: ระบบจะ audit และไม่ส่งออกปลายทางที่ยังไม่พร้อม"
            : "เปิดใช้งานแล้ว",
          ...status,
        });
      },
    },
  },
});
