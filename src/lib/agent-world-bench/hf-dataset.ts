import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { serverEnv } from "@/lib/server-env";

export type HfBenchRecord = {
  task: string;
  id: number | string;
  turn_idx: number;
  total_turns: number;
  current_prompt: string;
  system_str: string;
};

export type HfDomainStats = {
  domain: string;
  file: string;
  samples: number;
  loaded: boolean;
};

export type HfDatasetInfo = {
  repo: "Qwen/AgentWorldBench";
  loaded: boolean;
  path: string;
  totalSamples: number;
  domains: HfDomainStats[];
  hepaFocus: string[];
  previews: Array<{
    domain: string;
    id: string | number;
    turn: string;
    instruction: string;
  }>;
  s3: {
    configured: boolean;
    endpoint: string | null;
    bucket: string | null;
  };
};

const HEPA_FOCUS_DOMAINS = ["mcp", "web", "terminal"];

function datasetDir() {
  const configured = serverEnv("HEPA_AGENTWORLD_DATA_DIR");
  if (configured) return resolve(configured);
  return resolve(process.cwd(), "data/agent-world-bench");
}

function countJsonlLines(filePath: string) {
  if (!existsSync(filePath)) return 0;
  const content = readFileSync(filePath, "utf8");
  if (!content.trim()) return 0;
  return content.split("\n").filter((line) => line.trim()).length;
}

function readJsonlPreview(filePath: string, limit: number): HfBenchRecord[] {
  if (!existsSync(filePath)) return [];
  const lines = readFileSync(filePath, "utf8").split("\n").filter((line) => line.trim());
  const records: HfBenchRecord[] = [];
  for (const line of lines.slice(0, limit)) {
    try {
      records.push(JSON.parse(line) as HfBenchRecord);
    } catch {
      // skip malformed lines
    }
  }
  return records;
}

function extractInstruction(record: HfBenchRecord) {
  const prompt = record.current_prompt || "";
  const match =
    prompt.match(/\*\*Task Instruction:\*\*\s*([\s\S]*?)(\n\n\*\*|$)/) ||
    prompt.match(/\*\*Instruction:\*\*\s*([\s\S]*?)(\n\n\*\*|$)/) ||
    prompt.match(/\*\*Goal:\*\*\s*([\s\S]*?)(\n\n\*\*|$)/);
  if (match?.[1]) return match[1].trim().slice(0, 220);
  return prompt.replace(/\s+/g, " ").trim().slice(0, 220);
}

export function getAgentWorldBenchDatasetInfo(): HfDatasetInfo {
  const path = datasetDir();
  const files = existsSync(path)
    ? readdirSync(path).filter((name) => name.endsWith("_test.jsonl"))
    : [];

  const domains: HfDomainStats[] = files.map((file) => {
    const domain = file.replace("_test.jsonl", "");
    return {
      domain,
      file,
      samples: countJsonlLines(resolve(path, file)),
      loaded: existsSync(resolve(path, file)),
    };
  });

  const totalSamples = domains.reduce((sum, item) => sum + item.samples, 0);
  const previews: HfDatasetInfo["previews"] = [];

  for (const domain of HEPA_FOCUS_DOMAINS) {
    const file = resolve(path, `${domain}_test.jsonl`);
    for (const record of readJsonlPreview(file, 1)) {
      previews.push({
        domain,
        id: record.id,
        turn: `${record.turn_idx}/${record.total_turns}`,
        instruction: extractInstruction(record),
      });
    }
  }

  const endpoint = serverEnv("HF_S3_ENDPOINT") || serverEnv("HF_S3_ENDPOINT_URL") || null;
  const bucket = serverEnv("HF_S3_BUCKET") || null;
  const hasKey = !!(serverEnv("HF_AWS_ACCESS_KEY_ID") || serverEnv("AWS_ACCESS_KEY_ID"));

  return {
    repo: "Qwen/AgentWorldBench",
    loaded: totalSamples > 0,
    path,
    totalSamples,
    domains: domains.sort((a, b) => b.samples - a.samples),
    hepaFocus: HEPA_FOCUS_DOMAINS,
    previews,
    s3: {
      configured: !!(endpoint && bucket && hasKey),
      endpoint,
      bucket,
    },
  };
}