import { HEPA_AGENT_WORLD_SCENARIOS } from "@/lib/agent-world-bench/scenarios";
import { serverEnv } from "@/lib/server-env";
import type {
  BenchAssertion,
  BenchDimensionScore,
  BenchDomain,
  BenchRunSummary,
  BenchScenarioResult,
  HepaBenchScenario,
} from "@/lib/agent-world-bench/types";

function getByPath(value: unknown, path: string) {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current == null || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

function checkAssertion(value: unknown, assertion: BenchAssertion) {
  if (assertion.exists) return value !== undefined;

  if (assertion.type) {
    if (assertion.type === "array") return Array.isArray(value);
    if (value === undefined || value === null) return false;
    return typeof value === assertion.type;
  }

  if (assertion.oneOf) return assertion.oneOf.some((item) => item === value);
  if ("equals" in assertion) return value === assertion.equals;
  return true;
}

function scoreScenario(
  scenario: HepaBenchScenario,
  httpStatus: number,
  payload: unknown,
  observation: string,
) {
  const failures: string[] = [];
  let passedAssertions = 0;

  for (const assertion of scenario.assertions) {
    const value = getByPath(payload, assertion.path);
    if (checkAssertion(value, assertion)) {
      passedAssertions += 1;
      continue;
    }
    failures.push(`assertion ล้มเหลวที่ ${assertion.path}`);
  }

  const assertionRatio =
    scenario.assertions.length === 0 ? 1 : passedAssertions / scenario.assertions.length;

  const format =
    typeof payload === "object" && payload !== null && !Array.isArray(payload) ? 1 : assertionRatio > 0 ? 0.5 : 0;

  const factuality = assertionRatio;
  const consistency =
    scenario.action.expectedStatus === undefined || httpStatus === scenario.action.expectedStatus ? 1 : 0;
  const realism = httpStatus < 500 ? 1 : 0;
  const quality =
    typeof getByPath(payload, "message") === "string" ||
    typeof getByPath(payload, "nextAction") === "string" ||
    typeof getByPath(payload, "detail") === "string" ||
    observation.length > 0
      ? 1
      : 0.7;

  const scores: BenchDimensionScore = {
    format: Number(format.toFixed(2)),
    factuality: Number(factuality.toFixed(2)),
    consistency: Number(consistency.toFixed(2)),
    realism: Number(realism.toFixed(2)),
    quality: Number(quality.toFixed(2)),
  };

  const averageScore =
    (scores.format + scores.factuality + scores.consistency + scores.realism + scores.quality) / 5;

  return {
    failures,
    scores,
    averageScore: Number(averageScore.toFixed(3)),
    passed: failures.length === 0 && consistency === 1,
  };
}

function authHeadersForScenario(scenario: HepaBenchScenario) {
  if (!scenario.action.path.includes("/api/hosxp-sync")) return {};
  const token =
    serverEnv("HEPA_HOSXP_SYNC_TOKEN") ||
    serverEnv("HEPA_HOSXP_PROXY_TOKEN") ||
    serverEnv("HEPA_AWS_API_KEY");
  return token ? { "X-HEPAGLUE-TOKEN": token } : {};
}

async function executeScenario(baseUrl: string, scenario: HepaBenchScenario) {
  const started = Date.now();
  const url = new URL(scenario.action.path, baseUrl);
  const init: RequestInit = {
    method: scenario.action.method,
    headers: {
      Accept: "application/json",
      ...authHeadersForScenario(scenario),
      ...(scenario.action.headers || {}),
    },
  };

  if (scenario.action.body) {
    init.headers = {
      ...init.headers,
      "Content-Type": "application/json",
    };
    init.body = JSON.stringify(scenario.action.body);
  }

  const response = await fetch(url, init);
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }

  const observation =
    typeof payload === "object" && payload !== null
      ? JSON.stringify(payload, null, 2).slice(0, 1200)
      : String(payload).slice(0, 1200);

  const scored = scoreScenario(scenario, response.status, payload, observation);

  return {
    scenario,
    httpStatus: response.status,
    latencyMs: Date.now() - started,
    observation,
    ...scored,
  } satisfies BenchScenarioResult;
}

function summarize(results: BenchScenarioResult[], baseUrl: string): BenchRunSummary {
  const byDomain: BenchRunSummary["byDomain"] = {
    mcp: { total: 0, passed: 0, averageScore: 0 },
    web: { total: 0, passed: 0, averageScore: 0 },
    terminal: { total: 0, passed: 0, averageScore: 0 },
  };

  for (const result of results) {
    const domain = result.scenario.task;
    byDomain[domain].total += 1;
    if (result.passed) byDomain[domain].passed += 1;
    byDomain[domain].averageScore += result.averageScore;
  }

  for (const domain of Object.keys(byDomain) as BenchDomain[]) {
    const bucket = byDomain[domain];
    bucket.averageScore =
      bucket.total === 0 ? 0 : Number((bucket.averageScore / bucket.total).toFixed(3));
  }

  const passed = results.filter((item) => item.passed).length;
  const averageScore =
    results.length === 0
      ? 0
      : Number(
          (results.reduce((sum, item) => sum + item.averageScore, 0) / results.length).toFixed(3),
        );

  return {
    source: "Qwen/AgentWorldBench (HEPA adapter)",
    ranAt: new Date().toISOString(),
    baseUrl,
    total: results.length,
    passed,
    failed: results.length - passed,
    averageScore,
    byDomain,
    results,
  };
}

export async function runAgentWorldBench(baseUrl: string) {
  const normalized = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const results: BenchScenarioResult[] = [];

  for (const scenario of HEPA_AGENT_WORLD_SCENARIOS) {
    results.push(await executeScenario(normalized, scenario));
  }

  return summarize(results, normalized);
}

export function listAgentWorldBenchScenarios() {
  return HEPA_AGENT_WORLD_SCENARIOS.map((scenario) => ({
    task: scenario.task,
    id: scenario.id,
    title: scenario.title,
    instruction: scenario.instruction,
  }));
}