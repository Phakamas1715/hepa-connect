#!/usr/bin/env bash
# Deploy latest build to hepa-namphong Lightsail VPS (54.254.201.52)
# Requires: aws CLI with Lightsail access (run `aws login` or configure IAM first)
#
# Usage:
#   bash deploy/deploy-vps-now.sh
#   SKIP_BUILD=1 bash deploy/deploy-vps-now.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

INSTANCE="${LIGHTSAIL_INSTANCE:-hepa-namphong}"
REGION="${AWS_REGION:-ap-southeast-1}"
HOST="${VPS_HOST:-54.254.201.52}"
USER="${VPS_USER:-ubuntu}"
APP_DIR="${APP_DIR:-/opt/hepa-connect}"
KEY_FILE="${SSH_KEY_FILE:-/tmp/hepa-lightsail-ssh.pem}"
PACKAGE="${DEPLOY_PACKAGE:-/tmp/hepa-vps-deploy.tar.gz}"

echo "== HEPA Connect → VPS production =="
echo "commit: $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo "target: ${USER}@${HOST} (${INSTANCE}, ${REGION})"

if ! aws sts get-caller-identity --region "$REGION" >/dev/null 2>&1; then
  echo "ERROR: AWS credentials not found." >&2
  echo "Run: aws login" >&2
  echo "  or: aws configure (IAM user with Lightsail access)" >&2
  exit 1
fi

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  echo "== Building =="
  NODE_OPTIONS=--max-old-space-size=4096 pnpm build
fi

if [[ ! -d dist ]]; then
  echo "ERROR: dist/ missing — run pnpm build first" >&2
  exit 1
fi

echo "== Fetching Lightsail SSH key =="
aws lightsail get-instance-access-details \
  --instance-name "$INSTANCE" \
  --region "$REGION" \
  --output json > /tmp/lightsail-access.json

python3 - "$KEY_FILE" <<'PY'
import json, os, sys
key_file = sys.argv[1]
d = json.load(open("/tmp/lightsail-access.json"))["accessDetails"]
for path, content in [
    (key_file, d["privateKey"]),
    (key_file + "-cert.pub", d["certKey"] + "\n"),
]:
    open(path, "w").write(content)
    os.chmod(path, 0o600)
PY

echo "== Packaging dist =="
rm -f "$PACKAGE"
tar -czf "$PACKAGE" dist

echo "== Uploading to VPS =="
scp -i "$KEY_FILE" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new \
  "$PACKAGE" "${USER}@${HOST}:/tmp/hepa-vps-deploy.tar.gz"

echo "== Applying on VPS =="
ssh -i "$KEY_FILE" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new \
  "${USER}@${HOST}" bash -s <<REMOTE
set -euo pipefail
APP="$APP_DIR"
sudo tar -xzf /tmp/hepa-vps-deploy.tar.gz -C "\$APP"
sudo chown -R www-data:www-data "\$APP/dist"
sudo systemctl restart hepa-connect
sleep 3
echo "service: \$(sudo systemctl is-active hepa-connect)"
curl -fsS "http://127.0.0.1:3000/health" | head -c 200; echo
curl -fsS "http://127.0.0.1:3000/api/care-gap-queue" | head -c 300; echo
REMOTE

echo ""
echo "== Production checks =="
for path in /health "/api/care-gap-queue"; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" "https://hepa-namphong.${HOST}.sslip.io${path}" || echo "000")
  echo "  ${path} → ${code}"
done

echo ""
echo "Deploy finished: https://hepa-namphong.${HOST}.sslip.io"
rm -f "$KEY_FILE" "${KEY_FILE}-cert.pub" /tmp/lightsail-access.json 2>/dev/null || true