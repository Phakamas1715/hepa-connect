#!/bin/bash
# Run on the production server after deploy.
# This helper never writes real secrets. Keep production values in /opt/hepa-connect/.env.

set -euo pipefail

APP_DIR="/opt/hepa-connect"
ENV_FILE="$APP_DIR/.env"
EXAMPLE_FILE="$APP_DIR/deploy/env.production.example"

sudo mkdir -p "$APP_DIR"

if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$EXAMPLE_FILE" ]; then
    sudo cp "$EXAMPLE_FILE" "$ENV_FILE"
  else
    sudo touch "$ENV_FILE"
  fi
  echo "Created $ENV_FILE from a template. Add production secrets before going live."
else
  echo "Keeping existing $ENV_FILE."
fi

sudo chown www-data:www-data "$ENV_FILE"
sudo chmod 600 "$ENV_FILE"

echo "Restarting hepa-connect..."
sudo systemctl restart hepa-connect

sleep 3
echo "Health check:"
curl -sS http://127.0.0.1:3000/health || true

cat <<'EOF'

Production URLs:
  Main app:       https://54.254.201.52/
  Webhook URL:    https://54.254.201.52/api/line-webhook
  Patient LIFF:   https://liff.line.me/2010455433-bdhf73Hh
  Clinic LIFF:    https://liff.line.me/2010455433-qmiL5Gqx
  Add friend:     https://line.me/R/ti/p/@290xergg

LINE Developers settings:
  Messaging API Webhook URL:
    https://54.254.201.52/api/line-webhook
  LIFF endpoint for patient scan:
    https://54.254.201.52/line/link
EOF
