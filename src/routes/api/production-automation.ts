import { createFileRoute } from "@tanstack/react-router";
import {
  isProbeFresh,
  probeToGate,
  readAutomationHealthCache,
  refreshAutomationHealthCache,
  scheduleAutomationHealthRefresh,
  type AutomationHealthCache,
  type HealthProbe,
} from "@/lib/automation-health";
import { getAgentStorePath, readAgentStore } from "@/lib/hepa-agent-store";
import { serverEnv } from "@/lib/server-env";
import { listPatients } from "@/lib/patient-registry";

type GateState = "ready" | "partial" | "blocked";

type Gate = {
  id: string;
  name: string;
  state: GateState;
  detail: string;
  required: boolean;
  action?: string;
};

const DEEP_PROBE_TIMEOUT_MS = Number(serverEnv("HEPA_PRODUCTION_DEEP_PROBE_TIMEOUT_MS") || 12_000);

function ready(id: string, name: string, detail: string, required = true, action?: string): Gate {
  return { id, name, state: "ready", detail, required, action };
}

function partial(id: string, name: string, detail: string, required = true, action?: string): Gate {
  return { id, name, state: "partial", detail, required, action };
}

function blocked(id: string, name: string, detail: string, required = true, action?: string): Gate {
  return { id, name, state: "blocked", detail, required, action };
}

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
  const registry = listPatients();
  const count = registry.patients.length;
  const source =
    registry.meta.source === "google-sheet" ? "Google Sheet รายชื่อสถานบริการ" : "รายชื่อสำรอง";
  if (confirmed) {
    return ready(
      "target_registry_confirmed",
      "Prepared target registry",
      `ยืนยันทะเบียน production แล้ว ${count.toLocaleString()} ราย จาก ${source}`,
    );
  }

  return partial(
    "target_registry_confirmed",
    "Prepared target registry",
    `มีทะเบียนในระบบ ${count.toLocaleString()} ราย จาก ${source} แต่ยังไม่ได้ยืนยันว่าเป็นรายชื่อจริงครบชุด`,
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

function fallbackProbe(detail: string): HealthProbe {
  return {
    checkedAt: new Date(0).toISOString(),
    state: "blocked",
    ok: false,
    detail,
    latencyMs: 0,
  };
}

async function withOverallTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
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

function gateFromProbe(
  id: string,
  name: string,
  probe: HealthProbe | undefined,
  fallbackDetail: string,
  required = true,
  action?: string,
): Gate {
  const resolved = probe || fallbackProbe(fallbackDetail);
  const gate = probeToGate(id, name, resolved, required);
  return { ...gate, action };
}

async function automationStatusFromCache(cache: AutomationHealthCache | null, stale: boolean) {
  const gates: Gate[] = [
    targetRegistryGate(),
    gateFromProbe(
      "hosxp_proxy",
      "HOSxP proxy",
      cache?.hosxpBridge,
      "ยังไม่มีผลตรวจ HOSxP bridge — รอ background health probe",
      true,
      "ตั้ง HEPA_HOSXP_PROXY_PUBLIC_URL ผ่าน tunnel หรือตรวจ HEPA_HOSXP_PROXY_URL",
    ),
    gateFromProbe(
      "hepatitis_feed",
      "Hepatitis lab feed",
      cache?.hepatitisFeed,
      "ยังไม่มีผลตรวจ hepatitis feed — รอ background health probe",
      true,
      "เปิด tunnel จากโรงพยาบาล (deploy/hospital-reverse-tunnel.sh) แล้วตั้ง HEPA_HOSXP_PROXY_PUBLIC_URL",
    ),
    lineGate(),
    workerGate(),
    mophGate(),
    await awsGatewayGate(),
    await appointmentGate(),
    agentStoreGate(),
  ];

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
    cacheUpdatedAt: cache?.updatedAt || null,
    cacheStale: stale,
    readiness,
    canRunProduction,
    mode: canRunProduction ? "production-no-it" : "guarded",
    gates,
    gaps,
    nextAction: canRunProduction
      ? "ผ่านเงื่อนไขการใช้งาน: HOSxP bridge + LINE + worker พร้อมแล้ว"
      : stale
        ? "กำลัง refresh health cache — ถ้า HOSxP ยัง blocked ให้เปิด tunnel จากโรงพยาบาล (deploy/hospital-reverse-tunnel.sh)"
        : "ยังไม่ผ่านเงื่อนไขการใช้งาน เนื่องจาก gate สำคัญยังไม่ครบ",
  };
}

async function automationStatusFast(deep = false) {
  if (deep) {
    try {
      const cache = await withOverallTimeout(
        refreshAutomationHealthCache(),
        DEEP_PROBE_TIMEOUT_MS,
        `deep probe timeout หลัง ${DEEP_PROBE_TIMEOUT_MS}ms`,
      );
      return { ...(await automationStatusFromCache(cache, false)), probeTimedOut: false };
    } catch (error) {
      const cache = readAutomationHealthCache();
      scheduleAutomationHealthRefresh(true);
      return {
        ...(await automationStatusFromCache(cache, true)),
        probeTimedOut: true,
        probeTimeoutMs: DEEP_PROBE_TIMEOUT_MS,
        probeMessage:
          error instanceof Error
            ? error.message
            : `deep probe timeout หลัง ${DEEP_PROBE_TIMEOUT_MS}ms`,
      };
    }
  }

  const cache = readAutomationHealthCache();
  const stale =
    !cache ||
    !isProbeFresh({
      checkedAt: cache.updatedAt,
      state: "ready",
      ok: true,
      detail: "",
      latencyMs: 0,
    });
  scheduleAutomationHealthRefresh(stale);
  return automationStatusFromCache(cache, stale);
}

export const Route = createFileRoute("/api/production-automation")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const deep = url.searchParams.get("probe") === "deep";
        return Response.json(await automationStatusFast(deep));
      },
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as { force?: boolean };
        const status = await automationStatusFast(false);
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
