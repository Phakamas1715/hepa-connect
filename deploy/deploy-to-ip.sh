#!/bin/bash
#
# Deploy HEPA-Connect upgrade (with monitoring & debug system) to a target IP
# Usage:
#   ./deploy/deploy-to-ip.sh 54.254.201.52 /path/to/your-key.pem [ubuntu]
#
set -euo pipefail

TARGET_IP="${1:-}"
KEY_PATH="${2:-}"
SSH_USER="${3:-ubuntu}"

if [[ -z "$TARGET_IP" || -z "$KEY_PATH" ]]; then
  echo "Usage: $0 <IP> <path-to-ssh-key.pem> [ssh-user]"
  echo "Example: $0 54.254.201.52 ~/Downloads/my-key.pem"
  echo ""
  echo "Looking for possible SSH keys on this Mac..."
  find ~ /Users/megamac/Downloads -name "*.pem" -type f 2>/dev/null | while read f; do if head -c 30 "$f" 2>/dev/null | grep -q "PRIVATE KEY"; then echo "  Possible key: $f"; fi; done || true
  exit 1
fi

if [[ ! -f "$KEY_PATH" ]]; then
  echo "Key not found: $KEY_PATH"
  echo "Tip: put your Lightsail/EC2 .pem key in ~/Downloads/lightsail.pem or pass the full path."
  exit 1
fi

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "== Building upgrade with monitoring (logger, /health, /api/ops-monitoring) =="
pnpm install --frozen-lockfile 2>/dev/null || true
pnpm build

PACKAGE="/tmp/hepa-upgrade-to-${TARGET_IP}.tar.gz"
echo "== Creating deploy package: $PACKAGE =="
rm -f "$PACKAGE"
tar --exclude='./node_modules' \
    --exclude='./.git' \
    --exclude='./.env' \
    --exclude='./data' \
    --exclude='./logs' \
    -czf "$PACKAGE" .

SSH_OPTS=(-i "$KEY_PATH" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15)

echo "== Uploading package to ${SSH_USER}@${TARGET_IP} =="
scp "${SSH_OPTS[@]}" "$PACKAGE" "${SSH_USER}@${TARGET_IP}:/tmp/hepa-upgrade.tar.gz"

echo "== Running installation on remote (this may take a few minutes) =="
ssh "${SSH_OPTS[@]}" "${SSH_USER}@${TARGET_IP}" '
  set -e
  echo "[remote] Installing dependencies..."
  sudo apt-get update -qq
  sudo apt-get install -y -qq unzip tar nginx

  echo "[remote] Extracting..."
  sudo rm -rf /tmp/hepa-deploy
  sudo mkdir -p /tmp/hepa-deploy
  sudo tar -xzf /tmp/hepa-upgrade.tar.gz -C /tmp/hepa-deploy

  cd /tmp/hepa-deploy

  echo "[remote] Running full install with PUBLIC_IP='"$TARGET_IP"' ..."
  sudo PUBLIC_IP="'"$TARGET_IP"'" USE_LOCAL_PACKAGE=1 bash deploy/install-lightsail-vps.sh

  echo "[remote] Restarting service..."
  sudo systemctl restart hepa-connect || sudo systemctl start hepa-connect

  echo "[remote] Checking health..."
  sleep 3
  curl -s http://127.0.0.1:3000/health || true
'

echo ""
echo "== Deployment finished =="
echo "Try these URLs:"
echo "  http://${TARGET_IP}/"
echo "  http://${TARGET_IP}/health"
echo "  http://${TARGET_IP}/api/ops-monitoring"
echo "  http://${TARGET_IP}/api/production-automation"
echo ""
echo "If you get 502 or nginx issues, check:"
echo "  ssh -i $KEY_PATH ${SSH_USER}@${TARGET_IP} 'sudo systemctl status hepa-connect; sudo nginx -t; sudo journalctl -u hepa-connect -n 30'"
echo ""
echo "To view logs:"
echo "  ssh -i $KEY_PATH ${SSH_USER}@${TARGET_IP} 'sudo journalctl -u hepa-connect -f'"
