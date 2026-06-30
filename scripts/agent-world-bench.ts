#!/usr/bin/env bun
/**
 * รัน AgentWorldBench adapter จาก CLI
 * ใช้: bun scripts/agent-world-bench.ts [baseUrl]
 */
import { runAgentWorldBench } from "../src/lib/agent-world-bench/runner";

const baseUrl = process.argv[2] || process.env.HEPA_BENCH_BASE_URL || "http://127.0.0.1:3000";

async function main() {
  console.log(`AgentWorldBench (HEPA) → ${baseUrl}`);
  const summary = await runAgentWorldBench(baseUrl);

  console.log(`\nผ่าน ${summary.passed}/${summary.total} · คะแนนรวม ${(summary.averageScore * 100).toFixed(1)}%`);
  for (const result of summary.results) {
    const mark = result.passed ? "✓" : "✗";
    console.log(
      `${mark} [${result.scenario.task}] ${result.scenario.title} — ${(result.averageScore * 100).toFixed(1)}% (${result.latencyMs}ms)`,
    );
    if (result.failures.length) console.log(`   ${result.failures.join("; ")}`);
  }

  process.exit(summary.failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});