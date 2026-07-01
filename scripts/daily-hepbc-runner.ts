#!/usr/bin/env bun
/**
 * Daily Hep-BC automation runner (PRODUCTION READY)
 * 
 * Production usage (cron on VPS):
 *   0 8 * * * cd /opt/hepa-connect && DRY_RUN=false bun scripts/daily-hepbc-runner.ts
 *
 * - Defaults to REAL MOPH reporting (no dry-run)
 * - Falls back to demo data ONLY if no HOSxP proxy configured
 * - Sends LINE Flex summary when LINE_PUSH_ENABLED=true + token present
 * - Records audit to data/hepa-agent-store.json
 * - Set LINE_DAILY_RECIPIENT_ID to SRRT group ID for production alerts
 */

import { getScreenedPassedResults } from "../src/lib/kumhos-client";
import { autoFillHepBCReport } from "../src/lib/moph-hepbc-reporter";
import { serverEnv } from "../src/lib/server-env";
import { audit, readAgentStore, writeAgentStore } from "../src/lib/hepa-agent-store";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

function isValidLineId(id: string) {
  return /^(U|C|R)[0-9a-fA-F]{20,}$/.test(id);
}

function buildDailyReportFlex(date: string, positives: number, reported: number, details: any[], dryRun: boolean) {
  const statusText = dryRun ? "DRY-RUN (simulated)" : "REAL (sent to MOPH)";
  const summaryLines = (details || []).slice(0, 6).map((d: any) => 
    `${d.type} ${d.category} - ${d.hn} (${d.status})`
  ).join("\n");

  return {
    type: "flex",
    altText: `Daily Hep-BC ${date}: ${positives} positives, ${reported} reported to MOPH`,
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "💉 Daily Hep-BC Runner", weight: "bold", size: "xl", color: "#FFFFFF" }
        ],
        backgroundColor: dryRun ? "#FF9800" : "#1E88E5",
        paddingAll: "16px"
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "รายงานประจำวัน - Hep B/C", weight: "bold", size: "md", color: "#1E88E5" },
          { type: "text", text: `วันที่: ${date}`, size: "sm", margin: "sm" },
          { type: "text", text: `พบ positive: ${positives} ราย`, size: "sm", margin: "xs", weight: "bold" },
          { type: "text", text: `รายงาน MOPH สำเร็จ: ${reported} ราย`, size: "sm", margin: "xs" },
          { type: "separator", margin: "md" },
          { type: "text", text: `สถานะ: ${statusText}`, size: "xs", margin: "md", color: dryRun ? "#E65100" : "#2E7D32" },
          { type: "text", text: `โรงพยาบาล: ${serverEnv("MOPH_HOSPITAL_CODE") || "11000"}`, size: "xs", margin: "sm" },
          { type: "text", text: "น้ำพองรักตับ / HEPA-Connect", size: "xxs", color: "#757575", margin: "xs" }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "ระบบรายงานอัตโนมัติ Hep-BC-DDC", size: "xxs", color: "#757575", align: "center" }
        ],
        paddingAll: "8px"
      }
    }
  };
}

async function pushDailyReport(date: string, positives: number, reported: number, details: any[], dryRun: boolean) {
  const token = serverEnv("LINE_CHANNEL_ACCESS_TOKEN");
  const pushEnabled = serverEnv("LINE_PUSH_ENABLED") === "true";
  const recipient = serverEnv("LINE_DAILY_RECIPIENT_ID") || serverEnv("LINE_TEST_RECIPIENT_ID");

  if (!token || !pushEnabled || !isValidLineId(recipient)) {
    console.log("[Daily Hep-BC] LINE push skipped (token not set / LINE_PUSH_ENABLED=false / invalid recipient)");
    return;
  }

  // Send reliable text summary first (Flex may require bot friendship + rich permissions)
  const textMsg = {
    type: "text",
    text: `Daily Hep-BC Runner\nวันที่: ${date}\nพบ positive: ${positives} ราย\nรายงาน MOPH: ${reported} ราย\nMode: ${dryRun ? "DRY" : "REAL"}\nโรงพยาบาล: ${serverEnv("MOPH_HOSPITAL_CODE") || "11000"}\n(น้ำพองรักตับ - HEPA-Connect)`
  };

  try {
    const res = await fetch(LINE_PUSH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to: recipient, messages: [textMsg] }),
    });

    if (res.ok) {
      console.log("[Daily Hep-BC] ✅ LINE text summary sent");
    } else {
      const txt = await res.text();
      console.error("[Daily Hep-BC] LINE text push failed:", res.status, txt.slice(0, 200));
    }
  } catch (e) {
    console.error("[Daily Hep-BC] LINE push error", e);
  }

  // Bonus: also attempt the nice Flex (may 400 if recipient hasn't added the OA)
  try {
    const flex = buildDailyReportFlex(date, positives, reported, details, dryRun);
    const flexRes = await fetch(LINE_PUSH_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: recipient, messages: [flex] }),
    });
    if (flexRes.ok) console.log("[Daily Hep-BC] ✅ Flex also sent");
  } catch {}
}

async function main() {
  const date = process.argv[2] || new Date(Date.now() - 86400000).toISOString().split("T")[0];
  console.log(`[Daily Hep-BC] Starting for ${date}`);

  const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
  console.log(`[Daily Hep-BC] Mode: ${dryRun ? "DRY RUN (simulation only)" : "PRODUCTION - REAL MOPH reporting"}`);

  let screened: any[] = [];
  try {
    screened = await getScreenedPassedResults(date);
    console.log(`[Daily Hep-BC] Pulled ${screened.length} screened results from HOSxP`);
  } catch (e) {
    console.error("[Daily Hep-BC] HOSxP pull failed", e);
    screened = [];
  }

  if (screened.length === 0) {
    const proxyUrl = serverEnv("HEPA_HOSXP_PROXY_URL");
    if (proxyUrl) {
      console.warn("[Daily Hep-BC] Proxy URL configured but returned 0 results. Proceeding with empty list (no auto-fallback in prod).");
    } else {
      console.log("[Daily Hep-BC] No proxy configured → using PREPARED_PATIENTS (demo mode)");
      const { PREPARED_PATIENTS } = await import("../src/lib/hepa-data");
      screened = PREPARED_PATIENTS;
    }
  }

  const positives = screened.filter((r: any) =>
    r.hbsag === "Positive" || r.rapid_hbv_result === "Positive" ||
    r.hcvAb === "Positive" || r.hcvVL === "Detected" || r.rapid_hcv_result === "Positive"
  );
  console.log(`[Daily Hep-BC] Found ${positives.length} Hep B/C positives`);

  if (positives.length === 0) {
    console.log("[Daily Hep-BC] No positives, done.");
    return;
  }

  const cases = positives.map((r: any) => ({
    hn: r.hn || r.patient_hn || `HOSxP-${r.id || Date.now()}`,
    testDate: r.date || date,
    hbsag: r.hbsag || r.rapid_hbv_result,
    hcvAb: r.hcvAb || r.rapid_hcv_result,
    hcvVL: r.hcvVL,
  }));

  let reported = 0;
  let details: any[] = [];

  try {
    const result = await autoFillHepBCReport(cases as any, undefined, { dryRun });
    reported = result.reported || 0;
    details = result.details || [];
    console.log(`[Daily Hep-BC] ${dryRun ? "DRY-RUN " : "REAL "}Reported ${reported} cases.`);
  } catch (e) {
    console.error("[Daily Hep-BC] Report failed", e);
  }

  // Audit (production traceability)
  try {
    const store = readAgentStore();
    audit(store, {
      actor: "system",
      action: "daily_hepbc_run",
      detail: `date=${date} positives=${positives.length} reported=${reported} dryRun=${dryRun}`,
    });
    writeAgentStore(store);
  } catch (e) {
    console.warn("[Daily Hep-BC] Audit write skipped", e);
  }

  // Send LINE Flex summary (production notification)
  await pushDailyReport(date, positives.length, reported, details, dryRun);

  console.log("[Daily Hep-BC] Completed.");
}

main().catch(console.error);
