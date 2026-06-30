import { getSyncedPositiveResults } from "@/lib/hosxp-sync-store";
import { resolveHosxpProxyUrl } from "@/lib/hosxp-proxy-url";
import { serverEnv } from "@/lib/server-env";

type KumhosRequestOptions = {
  method?: "GET" | "POST";
  body?: URLSearchParams | string;
  headers?: Record<string, string>;
};

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function parseCookies(headers: Headers) {
  const cookies: string[] = [];
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const values = getSetCookie ? getSetCookie.call(headers) : [headers.get("set-cookie") || ""];

  for (const value of values) {
    if (!value) continue;
    const cookie = value.split(";")[0]?.trim();
    if (cookie) cookies.push(cookie);
  }
  return cookies;
}

function updateCookieJar(jar: Map<string, string>, headers: Headers) {
  for (const cookie of parseCookies(headers)) {
    const eqAt = cookie.indexOf("=");
    if (eqAt > 0) jar.set(cookie.slice(0, eqAt), cookie.slice(eqAt + 1));
  }
}

function cookieHeader(jar: Map<string, string>) {
  return Array.from(jar.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

async function kumhosFetch(baseUrl: string, jar: Map<string, string>, path: string, options: KumhosRequestOptions = {}) {
  const headers = new Headers(options.headers || {});
  const cookies = cookieHeader(jar);
  if (cookies) headers.set("Cookie", cookies);

  const response = await fetch(joinUrl(baseUrl, path), {
    method: options.method || "GET",
    headers,
    body: options.body,
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });
  updateCookieJar(jar, response.headers);
  return response;
}

export async function loginKumhos() {
  const baseUrl = serverEnv("KUMHOS_BASE_URL") || "http://172.16.213.55/kumhos/kumhos_lab_api";
  const username = serverEnv("KUMHOS_USERNAME") || "puck";
  const password = serverEnv("KUMHOS_PASSWORD") || "1234";
  const jar = new Map<string, string>();

  const loginPage = await kumhosFetch(baseUrl, jar, "sys/login.php");
  const loginHtml = await loginPage.text();
  const tokenMatch = loginHtml.match(/name="([^"]*csrf[^"]*)"\s+value="([^"]+)"/i);
  const csrfName = tokenMatch?.[1] || "_csrf_token";
  const csrfValue = tokenMatch?.[2] || "";
  if (!csrfValue) throw new Error("KUMHOS login page did not provide CSRF token");

  const body = new URLSearchParams({
    username_txt: username,
    password_txt: password,
    btn_login: "1",
    [csrfName]: csrfValue,
  });

  await kumhosFetch(baseUrl, jar, "sys/login_verify.php", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const dashboard = await kumhosFetch(baseUrl, jar, "index.php");
  const dashboardHtml = await dashboard.text();
  const loggedIn = dashboard.ok && !dashboardHtml.includes("username_txt") && dashboardHtml.includes("Dashboard");
  if (!loggedIn) throw new Error("KUMHOS login failed");

  return { baseUrl, jar, csrfValue };
}

export async function getKumhosHosxpProxyStatus() {
  const session = await loginKumhos();
  const body = new URLSearchParams({
    hn: serverEnv("KUMHOS_TEST_HN") || "0000001",
    order_date: new Date().toISOString().slice(0, 10),
    _csrf_token: session.csrfValue,
  });

  const response = await kumhosFetch(session.baseUrl, session.jar, "fetch_lab_order_from_db.php", {
    method: "POST",
    body,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "X-CSRF-Token": session.csrfValue,
    },
  });
  const payload = (await response.json().catch(() => null)) as null | {
    lab_order?: unknown[];
    codes?: Record<string, string>;
    error?: string;
  };

  if (!response.ok || !payload) {
    throw new Error(`KUMHOS HOSxP proxy failed (${response.status})`);
  }

  return {
    ok: true,
    labOrderCount: Array.isArray(payload.lab_order) ? payload.lab_order.length : 0,
    codes: payload.codes || {},
    error: payload.error || "",
  };
}

export type ScreenedTestResult = {
  hn?: string;
  patient_hn?: string;
  id?: string | number;
  date?: string;
  hbsag?: string;
  rapid_hbv_result?: string;
  hcvAb?: string;
  rapid_hcv_result?: string;
  hcvVL?: string;
};

function mapHepatitisLabRecords(records: Array<Record<string, unknown>>): ScreenedTestResult[] {
  const byHn = new Map<string, ScreenedTestResult>();

  for (const row of records) {
    const hn = String(row.hn ?? row.patient_hn ?? "");
    if (!hn) continue;
    const existing = byHn.get(hn) || { hn, date: String(row.test_date ?? row.report_date ?? row.order_date ?? "") };
    const labName = String(row.lab_name ?? row.lab_items_name_ref ?? "").toLowerCase();
    const result = String(row.lab_result ?? row.lab_order_result ?? "");
    const positive = ["positive", "reactive", "detected", "pos", "+", "พบ", "บวก"].some((n) =>
      result.toLowerCase().includes(n),
    );

    if (labName.includes("hbsag") || String(row.lab_code ?? "").toUpperCase().includes("HB")) {
      existing.hbsag = positive ? "Positive" : "Negative";
      existing.rapid_hbv_result = existing.hbsag;
    }
    if (labName.includes("hcv") || labName.includes("anti-hcv")) {
      existing.hcvAb = positive ? "Positive" : "Negative";
      existing.rapid_hcv_result = existing.hcvAb;
    }
    if (labName.includes("rna") || labName.includes("viral load")) {
      existing.hcvVL = positive ? "Detected" : "Not Detected";
    }

    byHn.set(hn, existing);
  }

  return Array.from(byHn.values());
}

export async function getScreenedPassedResults(date: string): Promise<ScreenedTestResult[]> {
  const proxyUrl = resolveHosxpProxyUrl();
  const token = serverEnv("HEPA_HOSXP_PROXY_TOKEN");

  if (proxyUrl) {
    try {
      const url = new URL(proxyUrl);
      url.searchParams.set("action", "hepatitis_labs");
      url.searchParams.set("date_from", date);
      url.searchParams.set("date_to", date);
      url.searchParams.set("limit", "500");

      const res = await fetch(url, {
        headers: token ? { "X-HEPAGLUE-TOKEN": token } : {},
        signal: AbortSignal.timeout(8_000),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; records?: Array<Record<string, unknown>> };
      if (res.ok && data.ok && Array.isArray(data.records)) {
        return mapHepatitisLabRecords(data.records);
      }
    } catch {
      // Fall back to hospital push cache below.
    }
  }

  const synced = getSyncedPositiveResults(date);
  if (synced.length > 0) return synced;

  return [];
}
