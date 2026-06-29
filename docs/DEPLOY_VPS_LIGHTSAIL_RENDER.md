# Deploy HEPA-GLUE x hepa-connect

เอกสารนี้ใช้สำหรับ deploy ระบบ HEPA ขึ้น VPS, AWS Lightsail หรือ Render โดยยึด workflow ล่าสุด:

**รายชื่อเป้าหมายกลาง + รพ.สต. สแกน + ส่งผลคัดกรองเข้า HEPA โดยตรง**

HOSxP/Lab ใช้เป็นแหล่งยืนยันผลหลังคัดกรอง ไม่ใช่ source หลักของรายชื่อคัดกรอง

## Current Production

- VPS IP: `54.254.201.52`
- Web: `http://54.254.201.52`
- Health: `http://54.254.201.52/health`
- Service path: `/opt/hepa-connect`
- Service name: `hepa-connect`
- Runtime user: `www-data`

## Deploy On AWS Lightsail / Ubuntu VPS

```bash
sudo apt update
sudo apt install -y nginx git curl unzip
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable

sudo mkdir -p /opt/hepa-connect
sudo chown -R $USER:$USER /opt/hepa-connect
git clone https://github.com/Phakamas1715/hepa-connect.git /opt/hepa-connect
cd /opt/hepa-connect

pnpm install --frozen-lockfile
NODE_OPTIONS=--max-old-space-size=1536 pnpm build
```

สร้าง `.env` บน server เท่านั้น:

```bash
cp deploy/env.production.example .env
nano .env
sudo chown www-data:www-data .env
sudo chmod 640 .env
```

ติดตั้ง service:

```bash
sudo cp deploy/hepa-connect.service /etc/systemd/system/hepa-connect.service
sudo systemctl daemon-reload
sudo systemctl enable --now hepa-connect
sudo systemctl status hepa-connect
```

ตั้ง Nginx:

```bash
sudo cp deploy/nginx-hepa-connect.conf /etc/nginx/sites-available/hepa-connect
sudo ln -sf /etc/nginx/sites-available/hepa-connect /etc/nginx/sites-enabled/hepa-connect
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## Update Existing VPS

```bash
cd /opt/hepa-connect
git pull
pnpm install --frozen-lockfile
NODE_OPTIONS=--max-old-space-size=1536 pnpm build
sudo chown www-data:www-data .env
sudo chmod 640 .env
sudo systemctl restart hepa-connect
```

ตรวจ:

```bash
curl http://127.0.0.1:3000/health
curl http://54.254.201.52/health
curl http://54.254.201.52/api/connection-status
```

## Environment Variables

ใช้ template:

```bash
deploy/env.production.example
```

ค่าจริงต้องอยู่ใน:

```bash
/opt/hepa-connect/.env
```

อย่า push `.env` จริงขึ้น GitHub

## LINE Webhook And LIFF

LINE production ต้องใช้ HTTPS domain จริง

ตัวอย่างเมื่อมีโดเมน:

```text
Webhook URL:
https://hepa.namphonghospital.go.th/api/line-webhook

LIFF Endpoint URL:
https://hepa.namphonghospital.go.th/line/link
```

ถ้ายังไม่มีโดเมน ใช้ `http://54.254.201.52` ดูระบบได้ แต่ยังไม่พอสำหรับ webhook/LIFF production

## HOSxP / Lab

Cloud/VPS มองไม่เห็น IP ภายในโรงพยาบาลโดยตรง เช่น:

- `172.16.213.55`
- `192.168.215.21`

ดังนั้นระบบคัดกรองจริงให้เริ่มจาก:

1. รายชื่อเป้าหมายกลางใน HEPA
2. รพ.สต. สแกนหรือเลือกจากรายชื่อ
3. ส่งผล rapid test เข้า HEPA โดยตรง

HOSxP/Lab bridge ใช้ภายหลังสำหรับ:

- HBsAg confirm
- Anti-HCV confirm
- HCV RNA
- สถานะพบแพทย์/รักษา

## Render Option

Render เหมาะกับ public web และ LINE webhook เพราะมี HTTPS ให้ง่าย แต่ยังเข้า IP LAN โรงพยาบาลไม่ได้โดยตรง

ใช้ Render เมื่อ:

- ต้องการ public dashboard เร็ว
- ต้องการ HTTPS webhook
- ไม่ต้อง query HOSxP/Lab ภายในโดยตรง

ถ้าต้อง query lab ภายใน ให้มี hospital bridge/tunnel เพิ่ม

## Production Checklist

- [ ] Web เปิดได้
- [ ] `/health` ตอบ JSON
- [ ] CSS/JS โหลด 200
- [ ] `.env` owner เป็น `www-data:www-data`
- [ ] LINE token ตรวจผ่าน
- [ ] LINE push test ผ่าน
- [ ] รายชื่อเป้าหมายกลางพร้อม
- [ ] รพ.สต. สแกน/เลือกจากรายชื่อได้
- [ ] HOSxP/Lab bridge พร้อมเฉพาะผลยืนยัน
- [ ] HTTPS domain จริงพร้อมก่อนเปิด LINE webhook/LIFF production
