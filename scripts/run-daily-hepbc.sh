#!/usr/bin/env bash
# Daily Hep-BC entrypoint for VPS cron/systemd.
# Prefers bun runner (LINE summary + audit); falls back to agent API if deps missing.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/hepa-connect}"
BUN_BIN="${BUN_BIN:-/opt/bun/bin/bun}"
PORT="${PORT:-3000}"
MODE="${RUNNER_MODE:-auto}"

cd "$APP_DIR"

run_api() {
  echo "[Daily Hep-BC] Triggering via /api/agent-orchestrator"
  curl -sS -X POST "http://127.0.0.1:${PORT}/api/agent-orchestrator" \
    -H "Content-Type: application/json" \
    -d '{"action":"run_daily_hepbc"}'
  echo
}

run_bun() {
  echo "[Daily Hep-BC] Running bun scripts/daily-hepbc-runner.ts"
  "$BUN_BIN" "$APP_DIR/scripts/daily-hepbc-runner.ts"
}

if [[ "$MODE" == "api" ]]; then
  run_api
  exit 0
fi

if [[ "$MODE" == "bun" ]]; then
  run_bun
  exit 0
fi

if [[ -x "$BUN_BIN" && -f "$APP_DIR/scripts/daily-hepbc-runner.ts" ]]; then
  if "$BUN_BIN" -e "import('puppeteer')" >/dev/null 2>&1; then
    run_bun
    exit 0
  fi
  echo "[Daily Hep-BC] puppeteer not available — falling back to API runner"
fi

run_api