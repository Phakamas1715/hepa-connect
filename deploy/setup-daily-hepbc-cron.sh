#!/usr/bin/env bash
# Install daily Hep-BC runner on VPS (systemd timer + optional cron fallback).
# Run on the server as root:
#   sudo bash deploy/setup-daily-hepbc-cron.sh
#
# Schedule: 08:00 Asia/Bangkok every day (reports yesterday's screened positives).
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/hepa-connect}"
APP_USER="${APP_USER:-www-data}"
CRON_HOUR="${CRON_HOUR:-8}"
INSTALL_BUN="${INSTALL_BUN:-1}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/setup-daily-hepbc-cron.sh"
  exit 1
fi

if [[ ! -d "$APP_DIR" ]]; then
  echo "APP_DIR not found: $APP_DIR"
  exit 1
fi

mkdir -p "$APP_DIR/logs"
chown "$APP_USER:$APP_USER" "$APP_DIR/logs"

resolve_runner() {
  if command -v bun >/dev/null 2>&1; then
    echo "$(command -v bun)"
    return
  fi
  if [[ -x /root/.bun/bin/bun ]]; then
    echo "/root/.bun/bin/bun"
    return
  fi
  if [[ -x /usr/local/bin/bun ]]; then
    echo "/usr/local/bin/bun"
    return
  fi
  echo ""
}

BUN_BIN="$(resolve_runner)"

if [[ -z "$BUN_BIN" && "$INSTALL_BUN" == "1" ]]; then
  echo "Installing bun for TypeScript runner..."
  curl -fsSL https://bun.sh/install | bash
  if [[ -x /root/.bun/bin/bun ]]; then
    ln -sf /root/.bun/bin/bun /usr/local/bin/bun
    BUN_BIN="/usr/local/bin/bun"
  fi
fi

if [[ -z "$BUN_BIN" ]]; then
  echo "bun not found. Install manually or set INSTALL_BUN=1"
  exit 1
fi

echo "Using runner: $BUN_BIN"

# systemd oneshot + timer (preferred)
cat > /etc/systemd/system/hepa-daily-hepbc.service <<EOF
[Unit]
Description=HEPA Connect daily Hep-BC report runner
After=network-online.target hepa-connect.service
Wants=network-online.target

[Service]
Type=oneshot
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=-${APP_DIR}/.env
Environment=DRY_RUN=false
Environment=TZ=Asia/Bangkok
ExecStart=${BUN_BIN} ${APP_DIR}/scripts/daily-hepbc-runner.ts
StandardOutput=append:${APP_DIR}/logs/daily-hepbc.log
StandardError=append:${APP_DIR}/logs/daily-hepbc.log}
EOF

cat > /etc/systemd/system/hepa-daily-hepbc.timer <<EOF
[Unit]
Description=Run HEPA daily Hep-BC report at ${CRON_HOUR}:00 Asia/Bangkok

[Timer]
OnCalendar=*-*-* ${CRON_HOUR}:00:00
Persistent=true
Timezone=Asia/Bangkok

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now hepa-daily-hepbc.timer

# cron fallback (idempotent marker)
CRON_LINE="0 ${CRON_HOUR} * * * cd ${APP_DIR} && DRY_RUN=false TZ=Asia/Bangkok ${BUN_BIN} scripts/daily-hepbc-runner.ts >> ${APP_DIR}/logs/daily-hepbc.log 2>&1"
CRON_FILE="/etc/cron.d/hepa-daily-hepbc"
if [[ ! -f "$CRON_FILE" ]]; then
  cat > "$CRON_FILE" <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
${CRON_LINE}
EOF
  chmod 644 "$CRON_FILE"
  echo "Installed cron fallback at $CRON_FILE"
else
  echo "Cron file already exists: $CRON_FILE (skipped)"
fi

echo ""
echo "== Daily Hep-BC scheduler ready =="
systemctl list-timers hepa-daily-hepbc.timer --no-pager || true
echo ""
echo "Manual test:"
echo "  sudo systemctl start hepa-daily-hepbc.service"
echo "  tail -f ${APP_DIR}/logs/daily-hepbc.log"
echo ""
echo "Ensure .env has:"
echo "  LINE_PUSH_ENABLED=true"
echo "  LINE_DAILY_RECIPIENT_ID=<SRRT-group-or-staff-id>"
echo "  HEPA_HOSXP_PROXY_URL=..."