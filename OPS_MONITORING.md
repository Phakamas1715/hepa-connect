# HEPA-Connect: ระบบตรวจสอบและดีบั๊ก (Observability)

## จุดประสงค์
- ตรวจสอบสถานะระบบเร็ว (liveness + readiness)
- ดีบั๊กปัญหา LINE nudge / webhook
- ดู audit events จาก agent
- ดู readiness gates ก่อนส่ง production

## Endpoints หลัก (ใช้สำหรับ monitoring)

| Endpoint                  | Purpose                              | ตัวอย่างการใช้                  |
|---------------------------|--------------------------------------|---------------------------------|
| `GET /health`             | Liveness + basic dependency checks   | Load balancer, systemd, uptime  |
| `GET /api/ops-monitoring` | Operator debug: config, counts, recent audit (masked) | Staff / devops  |
| `GET /api/production-automation` | Full readiness gates (LINE, HOSxP, MOPH, worker...) | ก่อนรันงานจริง |
| `GET /api/line-webhook`   | Webhook health                       | LINE Developers test            |

## การเรียกตรวจสอบจากเครื่องจริง (VPS)

```bash
curl -s http://127.0.0.1:3000/health | jq
curl -s http://127.0.0.1:3000/api/ops-monitoring | jq '.storeSummary, .config'
curl -s http://127.0.0.1:3000/api/production-automation | jq '.readiness, .gates[]'
```

## Logging

- ใช้ structured JSON log (ใน production)
- ทุก request มี `requestId`
- Log สำคัญจาก LINE: webhook รับ, nudge ส่งสำเร็จ/ล้มเหลว

### ดู log บน VPS

**ด้วย journald (แนะนำ)**
```bash
sudo journalctl -u hepa-connect -f --since "1 hour ago"
sudo journalctl -u hepa-connect -n 200 | jq -c 'select(.level)'   # ถ้า log เป็น JSON
```

**ไฟล์ log (จาก PM2)**
```bash
tail -f /opt/hepa-connect/logs/out.log /opt/hepa-connect/logs/err.log
```

### ตั้ง logrotate (แนะนำ)

สร้าง `/etc/logrotate.d/hepa-connect`:
```
/opt/hepa-connect/logs/*.log {
    daily
    rotate 14
    compress
    missingok
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload hepa-connect || true
    endscript
}
```

## Architecture ที่แนะนำ (สรุป)

**ปัจจุบัน**
- TanStack Start + custom server.mjs
- PM2 / systemd
- File-based agent store + audit (data/hepa-agent-store.json)
- Readiness gates อยู่ใน production-automation
- Console log พื้นฐาน

**แนะนำ (ที่ทำในรอบนี้ + ขั้นตอนต่อ)**
1. **Structured logging** (JSON + requestId) — ทำแล้ว
2. **Health + Ops endpoints** — ทำแล้ว (`/health`, `/api/ops-monitoring`)
3. **Instrument LINE paths** สำคัญ — ทำแล้ว
4. **PM2 + systemd logging** ดีขึ้น — ปรับแล้ว
5. **Audit เก็บได้นานขึ้น**:
   - ระยะสั้น: ใช้ไฟล์ (จำกัด 200)
   - ระยะกลาง: ส่ง audit สำคัญไป Supabase table แยก (immutable)
6. **Worker แยก** (อนาคต): ย้าย cron / queue ส่ง LINE ไป process แยก เพื่อไม่ให้เว็บช้า
7. **Metrics** (ถ้าต้องการ): เพิ่ม `/metrics` แบบ Prometheus ง่าย ๆ
8. **Error tracking**: เริ่มด้วยดีขึ้นจาก logger ก่อน ต่อด้วย self-hosted Sentry ถ้าจำเป็น

## วิธี Deploy การเปลี่ยนแปลง monitoring

1. บนเครื่อง dev:
   ```bash
   pnpm install
   pnpm build
   ```

2. ส่งโฟลเดอร์ `dist/`, `server.mjs`, `package.json`, `ecosystem.config.cjs` + `logs/` dir ไป VPS (ใช้สคริปต์ deploy เดิม หรือ rsync)

3. บน VPS:
   ```bash
   sudo systemctl restart hepa-connect
   # หรือถ้าใช้ PM2
   pm2 reload hepa-connect --update-env
   ```

4. ตรวจ:
   ```bash
   curl https://hepa.namphonghospital.go.th/health
   curl https://hepa.namphonghospital.go.th/api/ops-monitoring
   ```

## หมายเหตุความปลอดภัย
- `/api/ops-monitoring` เปิดเผยข้อมูลสำคัญ (แม้ masked) — อย่าเปิด public โดยไม่มี auth / IP whitelist / nginx basic auth
- HN และ LINE userId ถูก mask ใน log และ endpoint นี้

---
ปรับปรุง: 2026-06-29 (พร้อม deploy ระบบตรวจสอบ + ดีบั๊ก)
