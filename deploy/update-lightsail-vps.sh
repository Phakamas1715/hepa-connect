#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/hepa-connect}"

echo "== Updating HEPA Connect at $APP_DIR =="
cd "$APP_DIR"
git pull --ff-only
pnpm install --frozen-lockfile
NODE_OPTIONS=--max-old-space-size=4096 pnpm build
sudo systemctl restart hepa-connect
sudo systemctl --no-pager --full status hepa-connect || true
curl -fsS "http://127.0.0.1:${PORT:-3000}/api/production-automation" || true
echo
