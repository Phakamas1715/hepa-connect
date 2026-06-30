#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${HEPA_AGENTWORLD_DATA_DIR:-$ROOT/data/agent-world-bench}"

echo "ดาวน์โหลด Qwen/AgentWorldBench → $TARGET"
mkdir -p "$TARGET"

if command -v hf >/dev/null 2>&1; then
  hf download Qwen/AgentWorldBench \
    --repo-type dataset \
    --local-dir "$TARGET" \
    --include "*.jsonl"
else
  echo "ต้องติดตั้ง Hugging Face CLI ก่อน: pip install -U huggingface_hub" >&2
  exit 1
fi

echo "เสร็จแล้ว — $(find "$TARGET" -maxdepth 1 -name '*_test.jsonl' | wc -l | tr -d ' ') ไฟล์โดเมน"