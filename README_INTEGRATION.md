# HEPA-GLUE Engine x hepa-connect

ระบบสำหรับงานกำจัดไวรัสตับอักเสบ B/C อำเภอน้ำพอง โดยใช้ **รายชื่อเป้าหมายกลาง** เป็นแหล่งข้อมูลหลัก แล้วให้ รพ.สต. สแกน/เลือกจากรายชื่อเพื่อส่งผลคัดกรองเข้า HEPA โดยตรง

## Current Workflow

1. เตรียมรายชื่อเป้าหมายกลาง
   - HN, CID, ชื่อ, วันเกิด, ตำบล, หมู่บ้าน
   - mapping รพ.สต. รับผิดชอบ
   - สร้าง QR/link เฉพาะรายหรือเฉพาะหน่วย

2. รพ.สต. สแกนหรือเลือกจากรายชื่อ
   - ไม่ต้องค้นจาก JHCIS ตอนออกคัดกรอง
   - ลดการพิมพ์ HN/CID ซ้ำ
   - ลดความเสี่ยงผิดคน

3. ส่งผลคัดกรองเข้า HEPA โดยตรง
   - HBsAg
   - Anti-HCV
   - วันที่ตรวจ
   - ผู้บันทึก/หน่วยบริการ

4. HEPA วิเคราะห์ Care Gap
   - ผลบวกที่ยังไม่ confirm
   - ยังไม่ผูก LINE
   - ยังไม่พบแพทย์
   - ยังไม่เริ่มรักษา

5. LINE Closed Loop
   - ผูก LINE userId กับ HN ผ่าน LIFF
   - ส่งนัด/เตือน/ติดตามผู้ป่วย
   - ส่งงานต่อ อสม. หรือเจ้าหน้าที่

6. HOSxP/Lab ใช้เป็นข้อมูลยืนยัน
   - HCV RNA
   - lab confirm
   - สถานะพบแพทย์/รักษา
   - ไม่ใช่ source หลักของรายชื่อคัดกรอง

7. Dashboard และรายงาน
   - ยอดเป้าหมาย/คัดกรอง/ผลบวก/care gap แยกตาม รพ.สต.
   - เตรียมข้อมูล MOPH/ILI แบบตรวจสอบก่อนส่ง

## Production URL

- Web: http://54.254.201.52
- Health: http://54.254.201.52/health
- Integration: http://54.254.201.52/integration
- Architecture: http://54.254.201.52/architecture
- Patients: http://54.254.201.52/patients

หมายเหตุ: LINE webhook/LIFF production ต้องใช้ HTTPS ผ่านโดเมนจริง ไม่ใช้ Dynamic DNS ที่ถูกบล็อก

## Key Modules

- `src/routes/patients.tsx` - ทะเบียน Care Gap และ QR ผูก LINE
- `src/routes/agent.tsx` - LINE invite, identity mapping, nudge queue
- `src/routes/integration.tsx` - สถานะระบบและ production gate
- `src/routes/architecture.tsx` - Data flow รายชื่อเป้าหมาย + QR scan
- `src/routes/api/connection-status.ts` - API ตรวจสถานะระบบ
- `src/routes/api/production-automation.ts` - production readiness gate
- `src/routes/api/send-nudge.ts` - ส่ง LINE push จริง
- `src/routes/api/line-webhook.ts` - webhook endpoint
- `src/lib/hepa-service-area.ts` - mapping หน่วยบริการน้ำพอง
- `src/lib/hepa-data.ts` - KPI, รพ.สต., persona, care gap helper

## Environment

ห้าม commit `.env` จริงขึ้น GitHub ให้ใช้ไฟล์ template:

- `.env.example`
- `deploy/env.production.example`

ไฟล์จริงบน VPS:

```bash
/opt/hepa-connect/.env
```

## Deploy

บน VPS/Lightsail:

```bash
cd /opt/hepa-connect
git pull
pnpm install --frozen-lockfile
NODE_OPTIONS=--max-old-space-size=1536 pnpm build
sudo chown www-data:www-data .env
sudo chmod 640 .env
sudo systemctl restart hepa-connect
```

## What IT Still Needs To Support

ไม่ต้องให้ IT ดึงข้อมูลคัดกรองจาก JHCIS เป็นหลักแล้ว แต่ยังต้องใช้ IT สำหรับ:

- โดเมนจริง + HTTPS สำหรับ LINE webhook/LIFF
- ทางเชื่อม HOSxP/Lab สำหรับผลยืนยันหลังคัดกรอง
- read-only bridge/API ภายในโรงพยาบาล หากต้องปิด loop ด้วย lab confirm

## Go-Live Checklist

- [ ] รายชื่อเป้าหมายกลางพร้อม mapping รพ.สต.
- [ ] หน้า/QR ให้ รพ.สต. สแกนและบันทึกผล rapid test
- [ ] LINE token เปิดส่งจริง
- [ ] LIFF endpoint ใช้ HTTPS domain จริง
- [ ] HOSxP/Lab bridge สำหรับ confirm result
- [ ] Dashboard ตรวจยอดราย รพ.สต.
- [ ] ทดสอบส่ง LINE 1 เคสก่อนส่งกลุ่มใหญ่
