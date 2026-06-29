import { serverEnv } from "@/lib/server-env";
import { ILI_ICD10_CODES } from "@/lib/ili-constants";

export type IliReportStatus = "ready" | "partial" | "blocked";

export type IliDailySummary = {
  ok: boolean;
  state: IliReportStatus;
  reportDate: string;
  weekday: string;
  isScheduledDay: boolean;
  iliVisits: number;
  totalVisits: number;
  iliPercent: number;
  source: string;
  mode: "live_bridge" | "fallback";
  detail: string;
  codes: string[];
  checkedAt: string;
  portal: {
    name: string;
    url: string;
    loginRequired: boolean;
    autoSubmitReady: boolean;
  };
  schedule: {
    days: string[];
    pullDate: "yesterday";
    timezone: string;
  };
};

type BridgeIliPayload = {
  ok?: boolean;
  error?: string;
  report_date?: string;
  ili_visits?: number;
  total_visits?: number;
  ili_percent?: number;
  checked_at?: string;
  source?: string;
};

const dayNamesTh = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

export function yesterdayBangkok(now = new Date()) {
  const bangkok = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  bangkok.setDate(bangkok.getDate() - 1);
  const yyyy = bangkok.getFullYear();
  const mm = String(bangkok.getMonth() + 1).padStart(2, "0");
  const dd = String(bangkok.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function isIliScheduledDay(now = new Date()) {
  const bangkok = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const day = bangkok.getDay();
  return day === 1 || day === 2;
}

function thaiWeekday(dateText: string) {
  const date = new Date(`${dateText}T00:00:00+07:00`);
  return dayNamesTh[date.getDay()] || "-";
}

function createEmptySummary(reportDate: string, detail: string, state: IliReportStatus): IliDailySummary {
  return {
    ok: state === "ready",
    state,
    reportDate,
    weekday: thaiWeekday(reportDate),
    isScheduledDay: isIliScheduledDay(),
    iliVisits: 0,
    totalVisits: 0,
    iliPercent: 0,
    source: "HEPA_CONNECT",
    mode: "fallback",
    detail,
    codes: [...ILI_ICD10_CODES],
    checkedAt: new Date().toISOString(),
    portal: {
      name: "D506 Syndromic ILI",
      url: "https://ddsdoe.ddc.moph.go.th/syndromic/syndromicreport/ili",
      loginRequired: true,
      autoSubmitReady: Boolean(serverEnv("MOPH_USERNAME") && serverEnv("MOPH_PASSWORD") && serverEnv("MOPH_REPORTER_ENDPOINT")),
    },
    schedule: {
      days: ["จันทร์", "อังคาร"],
      pullDate: "yesterday",
      timezone: "Asia/Bangkok",
    },
  };
}

export async function getIliDailySummary(date = yesterdayBangkok()): Promise<IliDailySummary> {
  const proxyUrl = serverEnv("HEPA_HOSXP_PROXY_URL");
  if (!proxyUrl) {
    return createEmptySummary(date, "ยังไม่ได้ตั้งค่า HEPA_HOSXP_PROXY_URL จึงยังดึงยอด ILI จาก HOSxP ไม่ได้", "blocked");
  }

  const url = new URL(proxyUrl);
  url.searchParams.set("action", "ili_daily_summary");
  url.searchParams.set("date", date);
  url.searchParams.set("codes", ILI_ICD10_CODES.join(","));

  const token = serverEnv("HEPA_HOSXP_PROXY_TOKEN");

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...(token ? { "X-HEPAGLUE-TOKEN": token } : {}),
      },
      signal: AbortSignal.timeout(15_000),
    });
    const payload = (await response.json().catch(() => null)) as BridgeIliPayload | null;

    if (!response.ok || !payload?.ok) {
      return createEmptySummary(
        date,
        payload?.error || `bridge ยังไม่รองรับ ili_daily_summary หรือเรียกไม่สำเร็จ (${response.status})`,
        "partial",
      );
    }

    const iliVisits = Number(payload.ili_visits || 0);
    const totalVisits = Number(payload.total_visits || 0);
    const iliPercent = totalVisits > 0 ? Number(((iliVisits / totalVisits) * 100).toFixed(2)) : 0;

    return {
      ...createEmptySummary(payload.report_date || date, "ดึงยอด ILI จาก HOSxP bridge สำเร็จ", "ready"),
      ok: true,
      state: "ready",
      iliVisits,
      totalVisits,
      iliPercent: Number(payload.ili_percent ?? iliPercent),
      source: payload.source || "HOSxP_SERVER_BRIDGE",
      mode: "live_bridge",
      checkedAt: payload.checked_at || new Date().toISOString(),
    };
  } catch (error) {
    return createEmptySummary(
      date,
      `เชื่อมต่อ bridge เพื่อดึงยอด ILI ไม่สำเร็จ: ${error instanceof Error ? error.message : "unknown error"}`,
      "blocked",
    );
  }
}
