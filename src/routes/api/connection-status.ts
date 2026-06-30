import { createFileRoute } from "@tanstack/react-router";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolveHosxpProxyUrl } from "@/lib/hosxp-proxy-url";
import { serverEnv } from "@/lib/server-env";
import { getKumhosHosxpProxyStatus } from "@/lib/kumhos-client";

type CheckState = "ready" | "partial" | "blocked" | "not_configured";

const execFileAsync = promisify(execFile);
const HERMES_AGENT_REPO = "https://github.com/NousResearch/hermes-agent";
const GROK_BUILD_URL = "https://x.ai/cli";

function hermesModelReady() {
  return Boolean(
    serverEnv("NOUS_API_KEY") ||
    serverEnv("OPENROUTER_API_KEY") ||
    serverEnv("OPENAI_API_KEY") ||
    serverEnv("GLM_API_KEY") ||
    serverEnv("ZAI_API_KEY") ||
    serverEnv("Z_AI_API_KEY"),
  );
}

async function runHermesVersion(command: string) {
  const { stdout } = await execFileAsync(command, ["version"], { timeout: 10_000 });
  return stdout.split(/\r?\n/).find((line) => line.trim().startsWith("Hermes Agent"));
}

async function findHermesVersion() {
  const explicitPath = serverEnv("HERMES_CLI_PATH");
  if (explicitPath) {
    return runHermesVersion(explicitPath);
  }

  try {
    return await runHermesVersion("hermes");
  } catch {
    // Fall through to the Windows installer path used by the native Hermes installer.
  }

  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    return runHermesVersion(`${localAppData}\\hermes\\hermes-agent\\venv\\Scripts\\hermes.exe`);
  }

  throw new Error("Hermes CLI not found");
}

async function getHermesStatus(): Promise<{ state: CheckState; detail: string }> {
  const modelReady = hermesModelReady();
  try {
    return {
      state: modelReady ? "ready" : "partial",
      detail: modelReady
        ? `${(await findHermesVersion()) || "Hermes Agent ติดตั้งแล้ว"} จาก NousResearch และตั้งค่า model provider แล้ว`
        : `${(await findHermesVersion()) || "Hermes Agent ติดตั้งแล้ว"} จาก NousResearch แต่ยังไม่พบ provider API key ใน env`,
    };
  } catch {
    if (modelReady) {
      return {
        state: "partial",
        detail: `พบ provider API key แล้ว แต่ยังเรียก Hermes CLI ไม่ได้ ให้ติดตั้งจาก ${HERMES_AGENT_REPO} หรือกำหนด HERMES_CLI_PATH`,
      };
    }

    return {
      state: "not_configured",
      detail: `ยังไม่พบ Hermes CLI และ provider API key ให้ติดตั้งจาก ${HERMES_AGENT_REPO} แล้วตั้งค่า NOUS_API_KEY/OpenRouter/OpenAI หรือ Z.AI`,
    };
  }
}

async function runGrokVersion(command: string) {
  const { stdout } = await execFileAsync(command, ["--version"], { timeout: 10_000 });
  return stdout.trim();
}

async function findGrokVersion() {
  const explicitPath = serverEnv("GROK_CLI_PATH");
  if (explicitPath) return runGrokVersion(explicitPath);

  const home = process.env.HOME || process.env.USERPROFILE;
  if (home) {
    try {
      return await runGrokVersion(`${home}/.grok/bin/grok`);
    } catch {
      // Fall through to PATH for installations managed outside the user account.
    }
  }

  try {
    return await runGrokVersion("grok");
  } catch {
    throw new Error("Grok CLI not found");
  }
}

async function getGrokStatus(): Promise<{ state: CheckState; detail: string }> {
  const apiKeyReady = Boolean(serverEnv("GROK_API_KEY"));
  const subscriptionReady = serverEnv("GROK_SUBSCRIPTION_AUTHENTICATED") === "true";
  try {
    const version = await findGrokVersion();
    const officialBuild = version.toLowerCase().startsWith("grok ");

    if (officialBuild) {
      return {
        state: subscriptionReady ? "ready" : "partial",
        detail: subscriptionReady
          ? `Grok Build ${version} ตัวทางการ ติดตั้งและยืนยันบัญชี SuperGrok/X Premium+ แล้ว`
          : `Grok Build ${version} ตัวทางการติดตั้งแล้ว ให้เปิด terminal และ login ด้วยบัญชี SuperGrok/X Premium+`,
      };
    }

    return {
      state: apiKeyReady ? "ready" : "partial",
      detail: apiKeyReady
        ? `Community Grok CLI ${version} ติดตั้งแล้วและพบ GROK_API_KEY`
        : `Community Grok CLI ${version} ติดตั้งแล้ว แต่แพ็กเกจสมาชิกใช้กับตัวนี้ไม่ได้ ให้ติดตั้ง Grok Build ตัวทางการ`,
    };
  } catch {
    return {
      state: "not_configured",
      detail: `ยังไม่พบ Grok Build ตัวทางการ ติดตั้งจาก ${GROK_BUILD_URL} แล้ว login ด้วยบัญชี SuperGrok/X Premium+`,
    };
  }
}

async function getLineStatus(): Promise<{ state: CheckState; detail: string }> {
  const token = serverEnv("LINE_CHANNEL_ACCESS_TOKEN");
  if (!token) {
    return { state: "not_configured", detail: "ยังไม่มี LINE_CHANNEL_ACCESS_TOKEN ใน env" };
  }

  try {
    const response = await fetch("https://api.line.me/v2/bot/info", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = (await response.json().catch(() => null)) as null | {
      displayName?: string;
      basicId?: string;
      message?: string;
    };

    if (!response.ok) {
      return {
        state: "blocked",
        detail: `LINE token ตรวจไม่ผ่าน (${response.status}) ${payload?.message || "กรุณาตรวจ token"}`,
      };
    }

    const pushEnabled = serverEnv("LINE_PUSH_ENABLED") === "true";
    const name = payload?.displayName || "LINE Bot";
    const basicId = payload?.basicId ? ` (${payload.basicId})` : "";
    return {
      state: pushEnabled ? "ready" : "partial",
      detail: `${name}${basicId} ตรวจ token ผ่านแล้ว${pushEnabled ? " และเปิดโหมดส่งจริง" : " แต่ยังไม่ได้เปิด LINE_PUSH_ENABLED=true"}`,
    };
  } catch {
    return {
      state: "blocked",
      detail: "เรียก LINE Bot Info API ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตหรือ token",
    };
  }
}

async function getHosxpBridgeStatus(): Promise<{ state: CheckState; detail: string }> {
  const proxyUrl = resolveHosxpProxyUrl();
  if (!proxyUrl) {
    return {
      state: "not_configured",
      detail: "ยังไม่ได้ตั้งค่า HEPA_HOSXP_PROXY_URL / HEPA_HOSXP_PROXY_PUBLIC_URL",
    };
  }

  const url = new URL(proxyUrl);
  url.searchParams.set("action", "status");
  const token = serverEnv("HEPA_HOSXP_PROXY_TOKEN");

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...(token ? { "X-HEPAGLUE-TOKEN": token } : {}),
      },
      signal: AbortSignal.timeout(10_000),
    });
    const payload = (await response.json().catch(() => null)) as null | {
      ok?: boolean;
      error?: string;
      mysql_version?: string;
      tables?: Record<string, boolean>;
    };

    if (!response.ok || !payload?.ok) {
      return {
        state: response.status === 404 ? "not_configured" : "blocked",
        detail:
          response.status === 404
            ? "ยังไม่พบไฟล์ hepa_glue_hepatitis_proxy.php บน server ภายใน"
            : `HEPA HOSxP bridge ตอบกลับไม่สำเร็จ (${response.status}) ${payload?.error || ""}`.trim(),
      };
    }

    const hasTables = Boolean(
      payload.tables?.lab_head && payload.tables?.lab_order && payload.tables?.patient,
    );
    return {
      state: hasTables ? "ready" : "partial",
      detail: hasTables
        ? `เชื่อม HOSxP ผ่าน server-side bridge ได้แล้ว · MySQL ${payload.mysql_version || "พร้อมใช้งาน"}`
        : "bridge เปิดแล้ว แต่ยังตรวจตาราง lab_head/lab_order/patient ไม่ครบ",
    };
  } catch (error) {
    return {
      state: "blocked",
      detail: `ยังเรียก HEPA HOSxP bridge ไม่สำเร็จ: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}

async function getKumhosProxyStatus(): Promise<{ state: CheckState; detail: string }> {
  try {
    const status = await getKumhosHosxpProxyStatus();
    const codes = Object.entries(status.codes)
      .map(([key, value]) => `${key}:${value}`)
      .join(", ");
    return {
      state: "partial",
      detail: `KUMHOS query ได้ ใช้เป็นแหล่งยืนยันผลบางรายการได้${codes ? ` · test codes ${codes}` : ""}`,
    };
  } catch (error) {
    return {
      state: "blocked",
      detail: `KUMHOS/HOSxP ยังเรียกจาก VPS ไม่สำเร็จ: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}

async function getAppointmentStatus(): Promise<{ state: CheckState; detail: string }> {
  const appointmentUrl = serverEnv("NPH_APPOINTMENT_URL");
  const username = serverEnv("NPH_APPOINTMENT_USERNAME");
  const password = serverEnv("NPH_APPOINTMENT_PASSWORD");

  if (!appointmentUrl) {
    return {
      state: "not_configured",
      detail: "ยังไม่ได้ตั้งค่า NPH_APPOINTMENT_URL สำหรับระบบนัดหมาย",
    };
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
    const reachable = response.ok || loginRedirect;
    if (!reachable) {
      return {
        state: "blocked",
        detail: `ระบบนัดหมายตอบกลับ ${response.status}; ตรวจ URL หรือ network ไป 192.168.215.18`,
      };
    }

    if (username && password) {
      return {
        state: "ready",
        detail: "เข้าถึงระบบนัดหมายได้ และมี credential ใน env แล้ว",
      };
    }

    return {
      state: "partial",
      detail: "เข้าถึงระบบนัดหมายได้ แต่ยังไม่ได้ตั้งค่า NPH_APPOINTMENT_USERNAME/PASSWORD",
    };
  } catch (error) {
    return {
      state: "blocked",
      detail: `ยังเรียกระบบนัดหมายไม่สำเร็จ: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}

export const Route = createFileRoute("/api/connection-status")({
  server: {
    handlers: {
      GET: async () => {
        const [hermes, grok, line, hosxpBridge, kumhosProxy, appointment] = await Promise.all([
          getHermesStatus(),
          getGrokStatus(),
          getLineStatus(),
          getHosxpBridgeStatus(),
          getKumhosProxyStatus(),
          getAppointmentStatus(),
        ]);

        const checks: Array<{
          id: string;
          name: string;
          state: CheckState;
          detail: string;
        }> = [
          {
            id: "target_registry",
            name: "รายชื่อเป้าหมายกลาง",
            state: "ready",
            detail: "ใช้รายชื่อที่จัดทำและ mapping ให้ รพ.สต. เป็นแหล่งข้อมูลคัดกรองหลัก",
          },
          {
            id: "rphst_scan",
            name: "รพ.สต. scan workflow",
            state: "ready",
            detail:
              "พร้อมสร้าง QR/ลิงก์จากรายชื่อเดิม ให้ รพ.สต. สแกนและบันทึกผล rapid test เข้า HEPA โดยตรง",
          },
          {
            id: "line_bot",
            name: "LINE Messaging API",
            state: line.state,
            detail: line.detail,
          },
          {
            id: "hermes_zai",
            name: "Hermes Agent provider",
            state: hermes.state,
            detail: hermes.detail,
          },
          {
            id: "grok_cli",
            name: "Grok CLI developer agent",
            state: grok.state,
            detail: `${grok.detail} · ไม่ส่ง CID/HN หรือข้อมูลสุขภาพจริงออกไปใน prompt`,
          },
          {
            id: "hosxp_bridge",
            name: "ผลยืนยัน HOSxP/Lab",
            state: hosxpBridge.state,
            detail: `${hosxpBridge.detail} · ใช้เป็นข้อมูลยืนยันหลังคัดกรอง ไม่ใช่ source หลักของรายชื่อ`,
          },
          {
            id: "kumhos_hosxp_proxy",
            name: "KUMHOS HOSxP proxy",
            state: kumhosProxy.state,
            detail: kumhosProxy.detail,
          },
          {
            id: "nph_appointment",
            name: "ระบบนัดหมาย NPH",
            state: appointment.state,
            detail: appointment.detail,
          },
          {
            id: "moph_production",
            name: "MOPH production",
            state: "partial",
            detail: "เตรียมรายงานจากข้อมูลที่ รพ.สต. ส่งเข้า HEPA และตรวจสอบก่อนส่งออกภายนอก",
          },
        ];

        return Response.json({
          checkedAt: new Date().toISOString(),
          checks,
        });
      },
    },
  },
});
