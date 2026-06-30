#!/usr/bin/env bash
# One-shot: เปิด automation เต็มรูปแบบบน VPS
# sudo bash deploy/setup-vps-full-automation.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/hepa-connect}"
PORT="${PORT:-3000}"
PUBLIC_BASE="${PUBLIC_BASE_URL:-https://hepa-namphong.54.254.201.52.sslip.io}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run: sudo bash deploy/setup-vps-full-automation.sh"
  exit 1
fi

ENV="$APP_DIR/.env"
touch "$ENV"

set_kv() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ENV" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV"
  else
    echo "${key}=${val}" >> "$ENV"
  fi
}

if ! grep -q '^HEPA_HOSXP_PROXY_TOKEN=' "$ENV" 2>/dev/null || grep -q 'change-this' "$ENV"; then
  TOKEN="$(openssl rand -hex 24)"
  set_kv HEPA_HOSXP_PROXY_TOKEN "$TOKEN"
  set_kv HEPA_HOSXP_SYNC_TOKEN "$TOKEN"
  echo "Generated HEPA_HOSXP_PROXY_TOKEN / SYNC_TOKEN"
else
  TOKEN="$(grep '^HEPA_HOSXP_PROXY_TOKEN=' "$ENV" | cut -d= -f2-)"
  set_kv HEPA_HOSXP_SYNC_TOKEN "$TOKEN"
fi

set_kv NODE_ENV production
set_kv LINE_PUSH_ENABLED true
set_kv HEPA_BACKGROUND_WORKER_ENABLED true
set_kv HEPA_TARGET_REGISTRY_CONFIRMED true
set_kv HEPA_AUTOMATION_BOOTSTRAP_SYNC true
set_kv PUBLIC_BASE_URL "$PUBLIC_BASE"
set_kv NPH_APPOINTMENT_URL "http://192.168.215.18/nphappointment/apps/appointment/index.php"
set_kv NPH_APPOINTMENT_USERNAME "puck"
set_kv NPH_APPOINTMENT_PASSWORD "1234"

chown www-data:www-data "$ENV"
chmod 600 "$ENV"

echo "== Timers =="
bash "$APP_DIR/deploy/setup-daily-hepbc-cron.sh" || true
bash "$APP_DIR/deploy/setup-automation-health-timer.sh" || true

systemctl restart hepa-connect
sleep 4

echo "== Bootstrap sync cache =="
curl -sS -m 30 -X POST "$PUBLIC_BASE/api/hosxp-sync" \
  -H "Content-Type: application/json" \
  -H "X-HEPAGLUE-TOKEN: $TOKEN" \
  -d '{"action":"bootstrap_prepared"}' || \
curl -sS -m 30 -X POST "http://127.0.0.1:${PORT}/api/hosxp-sync" \
  -H "Content-Type: application/json" \
  -H "X-HEPAGLUE-TOKEN: $TOKEN" \
  -d '{"action":"bootstrap_prepared"}'
echo

echo "== Production automation =="
curl -sS -m 45 "http://127.0.0.1:${PORT}/api/production-automation?probe=deep" | head -c 1200
echo

echo ""
echo "== Hospital push package =="
HOSPITAL_DIR="$APP_DIR/deploy/hospital-push-package"
mkdir -p "$HOSPITAL_DIR"
cp "$APP_DIR/deploy/hospital-push-to-vps.php" "$HOSPITAL_DIR/"
cp "$APP_DIR/deploy/INSTALL_HOSPITAL_PUSH.bat" "$HOSPITAL_DIR/" 2>/dev/null || true
cat > "$HOSPITAL_DIR/hepa-push.env" <<EOF
HEPA_VPS_SYNC_URL=${PUBLIC_BASE}/api/hosxp-sync
HEPA_VPS_SYNC_TOKEN=${TOKEN}
HEPA_LOCAL_BRIDGE_URL=http://127.0.0.1/kumhos/kumhos_lab_api/hepa_glue_hepatitis_proxy.php
HEPAGLUE_PROXY_TOKEN=${TOKEN}
EOF
echo "Created $HOSPITAL_DIR/hepa-push.env (copy folder to Laragon server)"
echo "TOKEN for hospital: ${TOKEN}"