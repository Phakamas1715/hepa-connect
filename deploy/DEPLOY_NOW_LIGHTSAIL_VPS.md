# hepa-namphong: VPS / AWS Lightsail Deploy

ใช้ชุดนี้สำหรับเอา HEPA-GLUE x hepa-connect ขึ้น production บน VPS หรือ AWS Lightsail พร้อม agent/bridge

## 1. เตรียม VPS/Lightsail

- Ubuntu 22.04 หรือ 24.04
- เปิด firewall ขาเข้า `80` และ `443`
- ถ้าจะใช้ LINE webhook ต้องมี HTTPS
- ถ้าจะดึง HOSxP ใน LAN โรงพยาบาล ให้ใช้หนึ่งในสองทางนี้:
  - วาง `deploy/hepa_glue_hepatitis_proxy.php` บน server `172.16.213.55`
  - หรือทำ tunnel/VPN จาก server ในโรงพยาบาลออกมาหา VPS

## 2. ติดตั้งบน VPS

### วิธีเร็วจาก Windows ไป Lightsail/VPS

บนเครื่อง Windows ที่มีไฟล์ zip:

```powershell
powershell -ExecutionPolicy Bypass -File deploy\deploy-from-windows.ps1 -Host 1.2.3.4 -User ubuntu -PublicIp 1.2.3.4
```

ถ้าใช้ไฟล์ key `.pem`:

```powershell
powershell -ExecutionPolicy Bypass -File deploy\deploy-from-windows.ps1 -Host 1.2.3.4 -User ubuntu -PublicIp 1.2.3.4 -KeyPath C:\path\lightsail.pem
```

สคริปต์นี้จะอัปโหลด `hepa-namphong-vps-lightsail-deploy.zip`, แตกไฟล์บน server, ติดตั้ง Node/Nginx/systemd, build ระบบ และตั้ง domain ชั่วคราวจาก IP ให้อัตโนมัติ

### วิธีรันบน VPS โดยตรง

```bash
sudo bash deploy/install-lightsail-vps.sh
```

ชื่อ deployment ที่ตั้งให้: `hepa-namphong`

โดเมน production ที่ตั้งให้: `hepa.namphonghospital.go.th`

ถ้าโดเมนนี้ยังขึ้น error ว่า resolve ไม่ได้ ให้ใช้โดเมนชั่วคราวจาก public IP ก่อน เช่น IP `1.2.3.4` จะใช้:

```text
hepa-namphong.1.2.3.4.sslip.io
```

ติดตั้งแบบไม่ต้องรอ DNS:

```bash
sudo PUBLIC_IP=1.2.3.4 bash deploy/install-lightsail-vps.sh
```

หรือถ้ามีโดเมนจริงและ DNS ชี้แล้ว:

```bash
sudo DOMAIN=hepa.namphonghospital.go.th bash deploy/install-lightsail-vps.sh
```

## 3. ตั้งค่า secret จริง

```bash
sudo nano /opt/hepa-connect/.env
sudo systemctl restart hepa-connect
```

ค่าที่ต้องใส่จริง:

- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_PUSH_ENABLED=true`
- `Z_AI_API_KEY`
- `HEPA_HOSXP_PROXY_URL`
- `HEPA_HOSXP_PROXY_TOKEN`
- `KUMHOS_PASSWORD`
- `HEPA_AWS_API_GATEWAY_URL` ถ้าใช้ AWS API Gateway
- `HEPA_AWS_API_KEY` ถ้าใช้ API key gate

## 4. เปิด HTTPS

ตัวอย่างใช้ Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d hepa.namphonghospital.go.th
```

ถ้าใช้โดเมนชั่วคราวจาก IP:

```bash
sudo certbot --nginx -d hepa-namphong.1.2.3.4.sslip.io
```

## 5. ตั้งค่า LINE

ใน LINE Developers:

- Webhook URL: `https://hepa.namphonghospital.go.th/api/line-webhook`
- LIFF Endpoint URL: `https://hepa.namphonghospital.go.th/line/link`

ถ้าใช้โดเมนชั่วคราว ให้เปลี่ยนเป็น:

- Webhook URL: `https://hepa-namphong.1.2.3.4.sslip.io/api/line-webhook`
- LIFF Endpoint URL: `https://hepa-namphong.1.2.3.4.sslip.io/line/link`

ถ้ายังไม่มี route webhook แบบรับข้อความเข้า ให้ใช้ระบบ push/nudge และ LINE linking ผ่าน `/line/link` ก่อน

## 6. ตรวจ production

บน VPS:

```bash
curl http://127.0.0.1:3000/api/production-automation
```

บนเครื่อง Windows:

```powershell
powershell -ExecutionPolicy Bypass -File deploy\health-check.ps1 -BaseUrl https://hepa.namphonghospital.go.th
```

ผ่านจริงเมื่อ `/api/production-automation` ได้ `canRunProduction: true`

## 7. อัปเดตระบบครั้งต่อไป

```bash
cd /opt/hepa-connect
sudo bash deploy/update-lightsail-vps.sh
```

## สถานะที่ต้องรู้

- ตัวเว็บและ API deploy ได้ทันที
- LINE push ใช้ได้เมื่อใส่ token และเปิด `LINE_PUSH_ENABLED=true`
- HOSxP/MySQL ใน LAN จะเชื่อมจาก cloud โดยตรงไม่ได้ ต้องผ่าน bridge/tunnel/agent
- AWS API Gateway จะตรวจสำเร็จหลังใส่ `HEPA_AWS_API_GATEWAY_URL`
