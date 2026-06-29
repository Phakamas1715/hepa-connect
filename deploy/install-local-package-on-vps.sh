#!/usr/bin/env bash
set -euo pipefail

ZIP_PATH="${ZIP_PATH:-/tmp/hepa-namphong-vps-lightsail-deploy.zip}"
WORK_DIR="${WORK_DIR:-/tmp/hepa-namphong-deploy}"
PUBLIC_IP="${PUBLIC_IP:-}"
DOMAIN="${DOMAIN:-}"

if [[ ! -f "$ZIP_PATH" ]]; then
  echo "ZIP not found: $ZIP_PATH"
  exit 1
fi

sudo apt-get update
sudo apt-get install -y unzip
rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"
unzip -o "$ZIP_PATH" -d "$WORK_DIR"
cd "$WORK_DIR"

if [[ -n "$DOMAIN" ]]; then
  sudo DOMAIN="$DOMAIN" bash deploy/install-lightsail-vps.sh
elif [[ -n "$PUBLIC_IP" ]]; then
  sudo PUBLIC_IP="$PUBLIC_IP" bash deploy/install-lightsail-vps.sh
else
  sudo bash deploy/install-lightsail-vps.sh
fi
