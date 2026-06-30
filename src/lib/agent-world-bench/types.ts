export type BenchDomain = "mcp" | "web" | "terminal";

export type BenchAssertion = {
  path: string;
  equals?: unknown;
  oneOf?: unknown[];
  exists?: boolean;
  type?: "string" | "number" | "boolean" | "array" | "object";
};

export type BenchAction = {
  method: "GET" | "POST";
  path: string;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  expectedStatus?: number;
};

export type HepaBenchScenario = {
  task: BenchDomain;
  id: string;
  title: string;
  instruction: string;
  systemStr: string;
  action: BenchAction;
  assertions: BenchAssertion[];
};

export type BenchDimensionScore = {
  format: number;
  factuality: number;
  consistency: number;
  realism: number;
  quality: number;
};

export type BenchScenarioResult = {
  scenario: HepaBenchScenario;
  passed: boolean;
  scores: BenchDimensionScore;
  averageScore: number;
  httpStatus: number;
  latencyMs: number;
  observation: string;
  failures: string[];
};

export type BenchRunSummary = {
  source: "Qwen/AgentWorldBench (HEPA adapter)";
  ranAt: string;
  baseUrl: string;
  total: number;
  passed: number;
  failed: number;
  averageScore: number;
  byDomain: Record<BenchDomain, { total: number; passed: number; averageScore: number }>;
  results: BenchScenarioResult[];
};