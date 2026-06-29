import { createFileRoute } from "@tanstack/react-router";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { serverEnv } from "@/lib/server-env";
import { getKumhosHosxpProxyStatus } from "@/lib/kumhos-client";

type CheckState = "ready" | "partial" | "blocked" | "not_configured";

const execFileAsync = promisify(execFile);

async function getHermesStatus(): Promise<{ state: CheckState; detail: string }> {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) {
    return { state: "not_configured", detail: "ตรวจ Hermes Agent ได้เฉพาะเครื่อง Windows local; บน VPS ถือเป็น optional" };
  }

  const hermesExe = `${localAppData}\\hermes\\hermes-agent\\venv\\Scripts\\hermes.exe`;
  if (!existsSync(hermesExe)) {
    return { state: "not_configured", detail: "ยังไม่พบ hermes.exe ในเครื่องนี้" };
  }

  try {
    const { stdout } = await execFileAsync(hermesExe, ["version"], { timeout: 10_000 });
    const versionLine = stdout.split(/\r?\n/).find((line) => line.trim().startsWith("Hermes Agent"));
    const zaiReady = Boolean(serverEnv("GLM_API_KEY") || serverEnv("ZAI_API_KEY") || serverEnv("Z_AI_API_KEY"));
    return {
      state: zaiReady ? "ready" : "partial",
      detail: zaiReady
        ? `${versionLine || "Hermes Agent ติดตั้งแล้ว"} และตั้งค่า Z.AI/GLM provider แล้ว`
        : `${versionLine || "Hermes Agent ติดตั้งแล้ว"} แต่ยังไม่พบ Z.AI/GLM API key ใน env`,
    };
  } catch {
    const zaiReady = Boolean(serverEnv("GLM_API_KEY") || serverEnv("ZAI_API_KEY") || serverEnv("Z_AI_API_KEY"));
    return {
      state: zaiReady ? "ready" : "partial",
      detail: zaiReady ? "พบ Hermes Agent และตั้งค่า Z.AI/GLM provider แล้ว" : "พบ hermes.exe แล้ว แต่ยังไม่พบ Z.AI/GLM API key ใน env",
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
    return { state: "blocked", detail: "เรียก LINE Bot Info API ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตหรือ token" };
  }
}

async function getHosxpBridgeStatus(): Promise<{ state: CheckState; detail: string }> {
  const proxyUrl = serverEnv("HEPA_HOSXP_PROXY_URL");
  if (!proxyUrl) {
    return {
      state: "not_configured",
      detail: "ยังไม่ได้ตั้งค่า HEPA_HOSXP_PROXY_URL สำหรับผลยืนยันจาก HOSxP/Lab",
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

    const hasTables = Boolean(payload.tables?.lab_head && payload.tables?.lab_order && payload.tables?.patient);
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

export const Route = createFileRoute("/api/connection-status")({
  server: {
    handlers: {
      GET: async () => {
        const [hermes, line, hosxpBridge, kumhosProxy] = await Promise.all([
          getHermesStatus(),
          getLineStatus(),
          getHosxpBridgeStatus(),
          getKumhosProxyStatus(),
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
            detail: "พร้อมสร้าง QR/ลิงก์จากรายชื่อเดิม ให้ รพ.สต. สแกนและบันทึกผล rapid test เข้า HEPA โดยตรง",
          },
          {
            id: "line_bot",
            name: "LINE Messaging API",
            state: line.state,
            detail: line.detail,
          },
          {
            id: "hermes_zai",
            name: "Hermes Agent + Z.AI",
            state: hermes.state,
            detail: hermes.detail,
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
