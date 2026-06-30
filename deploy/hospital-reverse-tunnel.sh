#!/usr/bin/env bash
# รันบนเครื่องในโรงพยาบาล (ที่เข้า 172.16.213.55 ได้) เพื่อให้ VPS บน cloud เรียก HOSxP proxy ได้
#
# แนวคิด: SSH reverse tunnel จากโรงพยาบาล → Lightsail VPS
#   hospital:172.16.213.55:80  →  VPS:127.0.0.1:18755
#
# Usage (บนเครื่องโรงพยาบาล):
#   VPS_HOST=54.254.201.52 VPS_USER=ubuntu SSH_KEY=~/lightsail.pem \
#     HOSPITAL_UPSTREAM=http://172.16.213.55 \
#     bash deploy/hospital-reverse-tunnel.sh install-service
#
# บน VPS หลัง tunnel ทำงาน ตั้งใน /opt/hepa-connect/.env:
#   HEPA_HOSXP_PROXY_PUBLIC_URL=http://127.0.0.1:18755/kumhos/kumhos_lab_api/hepa_glue_hepatitis_proxy.php
#
set -euo pipefail

VPS_HOST="${VPS_HOST:-54.254.201.52}"
VPS_USER="${VPS_USER:-ubuntu}"
SSH_KEY="${SSH_KEY:-}"
LOCAL_TUNNEL_PORT="${LOCAL_TUNNEL_PORT:-18755}"
HOSPITAL_UPSTREAM="${HOSPITAL_UPSTREAM:-http://172.16.213.55}"
REMOTE_BIND="127.0.0.1:${LOCAL_TUNNEL_PORT}"
SERVICE_NAME="${SERVICE_NAME:-hepa-hospital-tunnel}"

ssh_base() {
  local args=(-o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes -o StrictHostKeyChecking=accept-new)
  if [[ -n "$SSH_KEY" ]]; then
    args+=(-i "$SSH_KEY")
  fi
  ssh "${args[@]}" "${VPS_USER}@${VPS_HOST}" "$@"
}

case "${1:-run}" in
  run)
    echo "Starting reverse tunnel ${HOSPITAL_UPSTREAM} -> VPS ${REMOTE_BIND}"
    echo "Press Ctrl+C to stop. For production use: $0 install-service"
    UPSTREAM="${HOSPITAL_UPSTREAM#*://}"
    [[ "$UPSTREAM" == *:* ]] || UPSTREAM="${UPSTREAM}:80"
    autossh -M 0 -N \
      ${SSH_KEY:+-i "$SSH_KEY"} \
      -o ServerAliveInterval=30 \
      -o ServerAliveCountMax=3 \
      -o ExitOnForwardFailure=yes \
      -R "${REMOTE_BIND}:${UPSTREAM}" \
      "${VPS_USER}@${VPS_HOST}"
    ;;
  install-service)
    if ! command -v autossh >/dev/null 2>&1; then
      echo "Install autossh first (apt install autossh / brew install autossh)"
      exit 1
    fi
    UPSTREAM_HOST_PORT="${HOSPITAL_UPSTREAM#*://}"
    UNIT="/etc/systemd/system/${SERVICE_NAME}.service"
    sudo tee "$UNIT" >/dev/null <<EOF
[Unit]
Description=HEPA hospital reverse SSH tunnel to VPS
After=network-online.target

[Service]
Environment=AUTOSSH_GATETIME=0
ExecStart=/usr/bin/autossh -M 0 -N \\
  ${SSH_KEY:+-i ${SSH_KEY} }\\
  -o ServerAliveInterval=30 \\
  -o ServerAliveCountMax=3 \\
  -o ExitOnForwardFailure=yes \\
  -R ${REMOTE_BIND}:${UPSTREAM_HOST_PORT} \\
  ${VPS_USER}@${VPS_HOST}
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
    sudo systemctl daemon-reload
    sudo systemctl enable --now "${SERVICE_NAME}"
    echo "Tunnel service started. On VPS set:"
    echo "  HEPA_HOSXP_PROXY_PUBLIC_URL=http://127.0.0.1:${LOCAL_TUNNEL_PORT}/kumhos/kumhos_lab_api/hepa_glue_hepatitis_proxy.php"
    ;;
  verify)
    echo "== From VPS =="
    ssh_base "curl -s -m 5 http://127.0.0.1:${LOCAL_TUNNEL_PORT}/kumhos/kumhos_lab_api/hepa_glue_hepatitis_proxy.php?action=status | head -c 300; echo"
    ;;
  *)
    echo "Usage: $0 [run|install-service|verify]"
    exit 1
    ;;
esac