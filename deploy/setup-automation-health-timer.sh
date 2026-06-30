#!/usr/bin/env bash
# Background health probes for production-automation (every 5 min on VPS).
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/hepa-connect}"
PORT="${PORT:-3000}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/setup-automation-health-timer.sh"
  exit 1
fi

cat > /etc/systemd/system/hepa-automation-health.service <<EOF
[Unit]
Description=Refresh HEPA automation health cache

[Service]
Type=oneshot
ExecStart=/usr/bin/curl -sS -m 45 "http://127.0.0.1:${PORT}/api/production-automation?probe=deep"
EOF

cat > /etc/systemd/system/hepa-automation-health.timer <<EOF
[Unit]
Description=Refresh HEPA automation health every 5 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now hepa-automation-health.timer
echo "Automation health timer active:"
systemctl list-timers hepa-automation-health.timer --no-pager