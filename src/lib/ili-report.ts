import { ILI_ICD10_CODES } from "@/lib/ili-constants";
import { serverEnv } from "@/lib/server-env";

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
  mode: "live_bridge" | "smart_query" | "fallback";
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

type SmartQuerySession = {
  baseUrl: string;
  jar: Map<string, string>;
  csrfToken: string;
};

type SmartQueryPayload = {
  success?: boolean;
  message?: string;
  data?: {
    rows?: Array<Record<string, unknown>>;
    columns?: string[];
    total?: number;
  };
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

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function parseSetCookie(headers: Headers) {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  return getSetCookie ? getSetCookie.call(headers) : [headers.get("set-cookie") || ""];
}

function updateCookieJar(jar: Map<string, string>, headers: Headers) {
  for (const value of parseSetCookie(headers)) {
    if (!value) continue;
    for (const part of value.split(/,(?=[^;]+=)/)) {
      const cookie = part.split(";")[0]?.trim();
      const eqAt = cookie.indexOf("=");
      if (eqAt > 0) jar.set(cookie.slice(0, eqAt), cookie.slice(eqAt + 1));
    }
  }
}

function cookieHeader(jar: Map<string, string>) {
  return Array.from(jar.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

async function smartQueryFetch(session: SmartQuerySession, path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  const cookies = cookieHeader(session.jar);
  if (cookies) headers.set("Cookie", cookies);
  if (session.csrfToken) headers.set("X-CSRF-Token", session.csrfToken);

  const response = await fetch(joinUrl(session.baseUrl, path), {
    ...options,
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });
  updateCookieJar(session.jar, response.headers);
  return response;
}

async function loginSmartQuery(): Promise<SmartQuerySession | null> {
  const baseUrl = serverEnv("SMARTQUERY_BASE_URL");
  const username = serverEnv("SMARTQUERY_USERNAME");
  const password = serverEnv("SMARTQUERY_PASSWORD");
  if (!baseUrl || !username || !password) return null;

  const session: SmartQuerySession = { baseUrl, jar: new Map(), csrfToken: "" };
  const loginPage = await smartQueryFetch(session, "login.php");
  const html = await loginPage.text();
  const loginCsrf = html.match(/name="_csrf"\s+value="([^"]+)"/i)?.[1] || "";
  if (!loginCsrf) throw new Error("Smart Query login page did not provide CSRF token");

  await smartQueryFetch(session, "login.php", {
    method: "POST",
    body: new URLSearchParams({ _csrf: loginCsrf, back: "", username, password }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const builder = await smartQueryFetch(session, "apps/smartquery/builder.php");
  const builderHtml = await builder.text();
  const loggedIn = builder.ok && !builderHtml.includes('name="username"') && builderHtml.includes("query_run_preview");
  if (!loggedIn) throw new Error("Smart Query login failed");

  session.csrfToken = builderHtml.match(/meta\s+name="csrf-token"\s+content="([^"]+)"/i)?.[1] || "";
  return session;
}

function smartQueryIliCodes() {
  const codes = new Set<string>();
  for (const code of ILI_ICD10_CODES) {
    codes.add(code);
    codes.add(code.replace(/^([A-Z]\d{2})(\d+)$/, "$1.$2"));
  }
  return Array.from(codes);
}

async function runSmartQueryCount(session: SmartQuerySession, date: string, iliOnly: boolean) {
  const filters: Array<Record<string, unknown>> = [{ field: "vstdate", op: "between", value: [date, date] }];
  if (iliOnly) filters.push({ field: "icd10", op: "in", value: smartQueryIliCodes() });

  const dsl = {
    dataset: "opd_visit",
    output: { type: "summary", metric: "count" },
    select: [],
    filters: { op: "AND", items: filters },
    groupBy: [],
    orderBy: [{ field: "metric", dir: "DESC" }],
    limit: 100,
    offset: 0,
  };

  const response = await smartQueryFetch(session, "api/smartquery/query_run_preview.php", {
    method: "POST",
    body: new URLSearchParams({ dsl_json: JSON.stringify(dsl) }),
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
  });
  const payload = (await response.json().catch(() => null)) as SmartQueryPayload | null;
  if (!response.ok || !payload?.success) throw new Error(payload?.message || `Smart Query failed (${response.status})`);

  return Number(payload.data?.rows?.[0]?.metric || 0);
}

async function getSmartQueryIliSummary(date: string): Promise<IliDailySummary | null> {
  const session = await loginSmartQuery();
  if (!session) return null;

  const [totalVisits, iliVisits] = await Promise.all([
    runSmartQueryCount(session, date, false),
    runSmartQueryCount(session, date, true),
  ]);
  const iliPercent = totalVisits > 0 ? Number(((iliVisits / totalVisits) * 100).toFixed(2)) : 0;

  return {
    ...createEmptySummary(
      date,
      "ดึงยอด ILI ผ่าน Smart Query สำเร็จ (ใช้ ICD-10 หลักจากชุด OPD ระหว่างรอวาง HOSxP bridge)",
      "partial",
    ),
    ok: true,
    iliVisits,
    totalVisits,
    iliPercent,
    source: "NPH_SMART_QUERY_OPD_VISIT",
    mode: "smart_query",
  };
}

async function getBridgeIliSummary(date: string): Promise<IliDailySummary | null> {
  const proxyUrl = serverEnv("HEPA_HOSXP_PROXY_URL");
  if (!proxyUrl) return null;

  const url = new URL(proxyUrl);
  url.searchParams.set("action", "ili_daily_summary");
  url.searchParams.set("date", date);
  url.searchParams.set("codes", ILI_ICD10_CODES.join(","));

  const token = serverEnv("HEPA_HOSXP_PROXY_TOKEN");
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
}

export async function getIliDailySummary(date = yesterdayBangkok()): Promise<IliDailySummary> {
  let bridgeError = "";

  try {
    const bridge = await getBridgeIliSummary(date);
    if (bridge?.state === "ready") return bridge;
    if (bridge) bridgeError = bridge.detail;
  } catch (error) {
    bridgeError = `เชื่อมต่อ bridge เพื่อดึงยอด ILI ไม่สำเร็จ: ${error instanceof Error ? error.message : "unknown error"}`;
  }

  try {
    const smartQuery = await getSmartQueryIliSummary(date);
    if (smartQuery) {
      return {
        ...smartQuery,
        detail: bridgeError ? `${smartQuery.detail}; bridge ยังใช้ไม่ได้: ${bridgeError}` : smartQuery.detail,
      };
    }
  } catch (error) {
    return createEmptySummary(
      date,
      `bridge ยังใช้ไม่ได้${bridgeError ? ` (${bridgeError})` : ""} และ Smart Query ดึงไม่ได้: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
      "blocked",
    );
  }

  return createEmptySummary(
    date,
    bridgeError ||
      "ยังไม่ได้ตั้งค่า HEPA_HOSXP_PROXY_URL หรือ SMARTQUERY_BASE_URL/SMARTQUERY_USERNAME/SMARTQUERY_PASSWORD จึงยังดึงยอด ILI จาก HOSxP ไม่ได้",
    "blocked",
  );
}
