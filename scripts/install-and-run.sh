#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PORT="${PORT:-3000}"

echo "== HEPA-Connect: ติดตั้งและรัน =="

if [[ ! -d node_modules ]]; then
  echo "→ ติดตั้ง dependencies..."
  if command -v pnpm >/dev/null 2>&1; then
    pnpm install
  else
    npm install
  fi
fi

if [[ ! -d data/agent-world-bench ]] || ! compgen -G "data/agent-world-bench/*_test.jsonl" >/dev/null; then
  echo "→ ดาวน์โหลด AgentWorldBench..."
  bash scripts/download-agent-world-bench.sh
fi

echo "→ build..."
if command -v pnpm >/dev/null 2>&1; then
  pnpm build 2>/dev/null || npx vite build
else
  npx vite build
fi

if lsof -ti:"$PORT" >/dev/null 2>&1; then
  echo "→ ปิด process เดิมบนพอร์ต $PORT"
  lsof -ti:"$PORT" | xargs kill -9 2>/dev/null || true
  sleep 1
fi

echo "→ เริ่มเซิร์ฟเวอร์ที่ http://127.0.0.1:$PORT"
node server.mjs &
SERVER_PID=$!
sleep 2

if curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null; then
  echo "✓ health OK"
else
  echo "✗ health ไม่ตอบ" >&2
  exit 1
fi

if command -v bun >/dev/null 2>&1; then
  echo "→ รัน AgentWorldBench..."
  bun scripts/agent-world-bench.ts "http://127.0.0.1:$PORT" || true
fi

echo ""
echo "พร้อมใช้งาน:"
echo "  แดชบอร์ด     http://127.0.0.1:$PORT/"
echo "  ทดสอบ Agent  http://127.0.0.1:$PORT/agent-bench"
echo "  จัดการ Agent http://127.0.0.1:$PORT/agent"
echo "  PID $SERVER_PID (หยุดด้วย: kill $SERVER_PID)"