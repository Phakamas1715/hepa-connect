#!/bin/bash
# Run this on the target server (54.254.201.52) after the main deploy
# Usage on remote:
#   sudo bash /tmp/apply-env-54.sh

set -e

ENV_FILE="/opt/hepa-connect/.env"

cat > /tmp/hepa-54.env << 'REALENV'
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
PUBLIC_BASE_URL=https://hepa-namphong.54.254.201.52.sslip.io

# LINE Messaging API - น้ำพองรักตับ (updated)
LINE_CHANNEL_ID=2010439606
LINE_CHANNEL_NAME=น้ำพองรักตับ
LINE_BOT_BASIC_ID=@290xergg
LINE_CHANNEL_SECRET=59c1cf97a5bd8c4ca0c2b50e95d6924c
LINE_CHANNEL_ACCESS_TOKEN=sXriMkli4n+0/MwFR/YASMq5YMDelepAzavlPtGDP90QRJxmpM4svMJKUpdw5ZADPesUOPPkIwpry0YB0ihtOdUZwkhKy9O0lHL/w2oeyxiVboRRIiam87moAw7v4QHncyfLhPHL9NPXP1pi3DIbSgdB04t89/1O/w1cDnyilFU=
LINE_PUSH_ENABLED=true
LINE_TEST_RECIPIENT_ID=U92af20982e6ef372dc957418d6e8efdb
VITE_LIFF_ID=2010455433-bdhf73Hh
VITE_LIFF_CLINIC_ID=2010455433-qmiL5Gqx

HEPA_AWS_API_KEY=zgLwNkTdL47HKAQ8JY2Hl9oqfnMpdgIZ24L9IDjs

# Copy other secrets from your current local .env:
# NPH_APPOINTMENT_URL, NPH_APPOINTMENT_USERNAME, NPH_APPOINTMENT_PASSWORD
# HEPA_HOSXP_PROXY_URL, HEPA_HOSXP_PROXY_TOKEN
# KUMHOS_BASE_URL, KUMHOS_USERNAME, KUMHOS_PASSWORD, KUMHOS_TEST_HN
# HOSXP_DB_HOST, HOSXP_DB_PORT, HOSXP_DB_NAME, HOSXP_DB_USER, HOSXP_DB_PASSWORD, HOSXP_CONFIG_URL
# GLM_API_KEY, Z_AI_API_KEY, ZAI_API_KEY
# Any MOPH_*
REALENV

sudo mkdir -p /opt/hepa-connect
sudo cp /tmp/hepa-54.env /opt/hepa-connect/.env
sudo chown www-data:www-data /opt/hepa-connect/.env
sudo chmod 600 /opt/hepa-connect/.env

echo "✅ .env written to /opt/hepa-connect/.env"
echo "Restarting service..."
sudo systemctl restart hepa-connect || true

sleep 3
echo "Health check:"
curl -s http://127.0.0.1:3000/health || true

echo ""
echo "=== ลิงก์ที่ต้องตั้งค่าใน LINE Developers Console ==="
echo ""
echo "1. Messaging API > Webhook URL:"
echo "   https://hepa-namphong.54.254.201.52.sslip.io/api/line-webhook"
echo ""
echo "2. LIFF App 'ชมรมรักตับน้ำพอง' (2010455433-bdhf73Hh, Full):"
echo "   Endpoint URL: https://hepa-namphong.54.254.201.52.sslip.io/line/link"
echo ""
echo "3. LIFF App 'คลินิครักตับ' (2010455433-qmiL5Gqx):"
echo "   Endpoint URL: https://hepa-namphong.54.254.201.52.sslip.io/   (แดชบอร์ดหลักหรือหน้า clinic)"
echo ""
echo "4. Bot Add Friend (สำหรับส่งให้ผู้ใช้):"
echo "   https://line.me/R/ti/p/@290xergg"
echo ""
echo "5. Main Web App (สำหรับ Rich Menu action):"
echo "   https://hepa-namphong.54.254.201.52.sslip.io/"
echo "   Patients page: https://hepa-namphong.54.254.201.52.sslip.io/patients"
echo ""
echo "6. Patient LIFF (สำหรับคนไข้สแกน QR):"
echo "   https://liff.line.me/2010455433-bdhf73Hh"
echo ""
echo "7. Clinic LIFF:"
echo "   https://liff.line.me/2010455433-qmiL5Gqx"

sudo mkdir -p /opt/hepa-connect
sudo cp /tmp/hepa-54.env "$ENV_FILE"
sudo chown www-data:www-data "$ENV_FILE"
sudo chmod 600 "$ENV_FILE"

echo "✅ .env written to $ENV_FILE"
echo "Restarting service..."
sudo systemctl restart hepa-connect || true

sleep 2
echo "Health check:"
curl -s http://127.0.0.1:3000/health || true

echo ""
echo "Remember to set Webhook URL in LINE Developers to:"
echo "  https://hepa-namphong.54.254.201.52.sslip.io/api/line-webhook"
