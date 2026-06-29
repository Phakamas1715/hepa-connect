#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/hepa-connect}"
REPO_URL="${REPO_URL:-https://github.com/Phakamas1715/hepa-connect.git}"
APP_USER="${APP_USER:-www-data}"
PROJECT_NAME="${PROJECT_NAME:-hepa-namphong}"
PUBLIC_IP="${PUBLIC_IP:-}"
DOMAIN="${DOMAIN:-hepa.namphonghospital.go.th}"
PORT="${PORT:-3000}"
USE_LOCAL_PACKAGE="${USE_LOCAL_PACKAGE:-0}"
SOURCE_DIR="$(pwd)"

if [[ -n "$PUBLIC_IP" && "$DOMAIN" == "hepa.namphonghospital.go.th" ]]; then
  DOMAIN="hepa-namphong.${PUBLIC_IP}.sslip.io"
fi

echo "== HEPA Connect deploy to VPS/Lightsail =="
echo "APP_DIR=$APP_DIR"
echo "REPO_URL=$REPO_URL"
echo "PROJECT_NAME=$PROJECT_NAME"
echo "DOMAIN=$DOMAIN"
if [[ -n "$PUBLIC_IP" ]]; then
  echo "PUBLIC_IP=$PUBLIC_IP"
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Please run with sudo: sudo bash deploy/install-lightsail-vps.sh"
  exit 1
fi

apt-get update
apt-get install -y ca-certificates curl git nginx

if [[ ! -f /swapfile ]]; then
  echo "Creating 2GB swapfile for small VPS build stability..."
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  if ! grep -q '^/swapfile ' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
  fi
fi

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

corepack enable

mkdir -p "$APP_DIR"
if [[ "$USE_LOCAL_PACKAGE" == "1" ]]; then
  echo "Installing from local package: $SOURCE_DIR"
  rm -rf "$APP_DIR"
  mkdir -p "$APP_DIR"
  tar --exclude='./node_modules' --exclude='./dist' --exclude='./.env' --exclude='./data/hepa-agent-store.json' -cf - . | tar -xf - -C "$APP_DIR"
elif [[ ! -d "$APP_DIR/.git" ]]; then
  rm -rf "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" pull --ff-only
fi

cd "$APP_DIR"

if [[ ! -f .env ]]; then
  cp deploy/env.production.example .env
  echo "Created $APP_DIR/.env from deploy/env.production.example"
  echo "Edit real secrets before public use: sudo nano $APP_DIR/.env"
fi

pnpm install --frozen-lockfile
NODE_OPTIONS=--max-old-space-size=1536 pnpm build

install -m 0644 deploy/hepa-connect.service /etc/systemd/system/hepa-connect.service
sed -i "s|WorkingDirectory=/opt/hepa-connect|WorkingDirectory=$APP_DIR|g" /etc/systemd/system/hepa-connect.service
sed -i "s|Environment=PORT=3000|Environment=PORT=$PORT|g" /etc/systemd/system/hepa-connect.service
sed -i "s|EnvironmentFile=-/opt/hepa-connect/.env|EnvironmentFile=-$APP_DIR/.env|g" /etc/systemd/system/hepa-connect.service
sed -i "s|ExecStart=/usr/bin/node /opt/hepa-connect/server.mjs|ExecStart=$(command -v node) $APP_DIR/server.mjs|g" /etc/systemd/system/hepa-connect.service

chown -R "$APP_USER:$APP_USER" "$APP_DIR"
systemctl daemon-reload
systemctl enable --now hepa-connect

install -m 0644 deploy/nginx-hepa-connect.conf /etc/nginx/sites-available/hepa-connect
sed -i "s|server_name hepa.namphonghospital.go.th;|server_name $DOMAIN;|g" /etc/nginx/sites-available/hepa-connect
sed -i "s|proxy_pass http://127.0.0.1:3000;|proxy_pass http://127.0.0.1:$PORT;|g" /etc/nginx/sites-available/hepa-connect
ln -sf /etc/nginx/sites-available/hepa-connect /etc/nginx/sites-enabled/hepa-connect
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "== Service status =="
systemctl --no-pager --full status hepa-connect || true

echo "== Local health =="
curl -fsS "http://127.0.0.1:$PORT/api/production-automation" || true
echo
echo "Deploy finished. Point DNS to this server, then enable SSL with certbot or your reverse proxy."
echo "Temporary DNS option: DOMAIN=hepa-namphong.<PUBLIC_IP>.sslip.io"
