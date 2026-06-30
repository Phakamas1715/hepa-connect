#!/usr/bin/env bash
# Deploy HEPA Connect to the hepa-namphong AWS Lightsail VPS.
#
# This script is intentionally aligned with the currently running production setup:
# - VPS: hepa-namphong / 54.254.201.52 / Ubuntu Lightsail
# - App: /opt/hepa-connect
# - Service user: www-data
# - Deploy style: upload the current git HEAD as source, preserve .env and runtime data
#
# Usage:
#   bash deploy/deploy-vps-now.sh
#   HOST=54.254.201.52 bash deploy/deploy-vps-now.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

INSTANCE="${LIGHTSAIL_INSTANCE:-hepa-namphong}"
REGION="${AWS_REGION:-ap-southeast-1}"
HOST="${VPS_HOST:-54.254.201.52}"
USER="${VPS_USER:-ubuntu}"
APP_DIR="${APP_DIR:-/opt/hepa-connect}"
KEY_FILE="${SSH_KEY_FILE:-/tmp/hepa-namphong-default-raw.pem}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://hepa-namphong.${HOST}.sslip.io}"

echo "== HEPA Connect -> AWS Lightsail production =="
echo "commit: $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo "target: ${USER}@${HOST} (${INSTANCE}, ${REGION})"
echo "url: ${PUBLIC_BASE_URL}"

if ! aws lightsail get-instance --instance-name "$INSTANCE" --region "$REGION" >/dev/null 2>&1; then
  echo "ERROR: AWS credentials not found or cannot access Lightsail instance ${INSTANCE}." >&2
  echo "Run: aws configure, or login with an IAM/Lightsail-capable profile." >&2
  exit 1
fi

cleanup() {
  rm -f "$KEY_FILE" "${KEY_FILE}.pub" 2>/dev/null || true
}
trap cleanup EXIT

echo "== Checking Lightsail instance =="
aws lightsail get-instance \
  --instance-name "$INSTANCE" \
  --region "$REGION" \
  --query 'instance.{name:name,ip:publicIpAddress,state:state.name,sshKeyName:sshKeyName}' \
  --output table

echo "== Downloading Lightsail default SSH key =="
umask 077
aws lightsail download-default-key-pair \
  --region "$REGION" \
  --output json |
  jq -r '.privateKeyBase64' > "$KEY_FILE"
chmod 600 "$KEY_FILE"

echo "== Testing SSH and current service =="
ssh -i "$KEY_FILE" -o BatchMode=yes -o IdentitiesOnly=yes -o ConnectTimeout=10 \
  "${USER}@${HOST}" \
  'echo "connected: $(hostname)"; sudo systemctl is-active hepa-connect || true'

echo "== Uploading current git HEAD and deploying on VPS =="
git archive --format=tar HEAD -- . \
  ':(exclude)data/hepa-agent-store.json' \
  ':(exclude).env.local' \
  ':(exclude).env.production' |
  ssh -i "$KEY_FILE" -o BatchMode=yes -o IdentitiesOnly=yes "${USER}@${HOST}" \
    "set -euo pipefail
     sudo tar -xf - -C '$APP_DIR' --no-same-owner
     sudo chown -R www-data:www-data '$APP_DIR'
     cd '$APP_DIR'
     sudo pnpm install --frozen-lockfile
     NODE_OPTIONS=--max-old-space-size=1536 sudo pnpm build
     sudo systemctl restart hepa-connect
     sleep 2
     sudo systemctl --no-pager --full status hepa-connect | sed -n '1,14p'"

echo "== Public checks =="
for path in / /patients /agent /line/staff /api/line-webhook; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' "${PUBLIC_BASE_URL}${path}" || echo 000)"
  echo "  ${path} -> ${code}"
  if [[ "$code" != "200" ]]; then
    echo "ERROR: ${path} returned ${code}" >&2
    exit 1
  fi
done

echo "== Recent service errors =="
ssh -i "$KEY_FILE" -o BatchMode=yes -o IdentitiesOnly=yes "${USER}@${HOST}" \
  "sudo journalctl -u hepa-connect --since '5 minutes ago' --no-pager |
   grep -Ei 'error|failed|exception|traceback' |
   tail -n 20 || true"

echo ""
echo "Deploy finished: ${PUBLIC_BASE_URL}"
