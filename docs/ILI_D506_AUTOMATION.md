# ILI D506 automation

ระบบนี้เตรียมยอดสำหรับหน้า D506 Syndromic ILI:

https://ddsdoe.ddc.moph.go.th/syndromic/syndromicreport/ili

หน้าเว็บดังกล่าว redirect ไปหน้า login ของ MOPH Account Center จึงยังไม่ควรส่งข้อมูลจริงแบบเดา form field เอง ระบบฝั่ง HEPA Connect จะทำงานแบบปลอดภัยดังนี้:

1. ดึงยอดของเมื่อวานจาก HOSxP bridge
2. คำนวณจำนวน ILI จาก ICD-10 ที่กำหนด
3. คำนวณผู้รับบริการทั้งหมดของวันเดียวกัน
4. เตรียม payload สำหรับกรอก D506
5. ทำงานตามรอบวันจันทร์และอังคาร

## หน้าใช้งาน

เปิด:

```text
http://127.0.0.1:5174/ili-report
```

API:

```text
GET  /api/ili-report
POST /api/ili-report
```

## ICD-10 ILI

ระบบ normalize จุดออกก่อนเทียบ เช่น `J02.9` จะเทียบเป็น `J029`

```text
J00,J029,J069,J09,J10,J11,J120,J121,J122,J123,J128,J129,J13,J14,J15,J160,J168,J170,J171,J180,J181,J182,J188,J189,J851,A481,J205,J210,B974,U071,U072,U073
```

## ติดตั้ง HOSxP bridge

นำไฟล์นี้ไปวางทับบน server โรงพยาบาล:

```text
deploy/hepa_glue_hepatitis_proxy.php
```

path ที่เคยใช้:

```text
C:\laragon\www\kumhos\kumhos_lab_api\hepa_glue_hepatitis_proxy.php
```

action ใหม่:

```text
?action=ili_daily_summary&date=2026-06-19
```

## ตั้ง Task Scheduler บน Windows

ให้รัน local app ก่อน แล้วติดตั้ง task:

```bat
scripts\install-ili-report-task.bat
```

ค่าเริ่มต้นจะทำงานทุกวันจันทร์และอังคาร เวลา 08:30 แล้วเรียก:

```text
POST http://127.0.0.1:5174/api/ili-report
```

ทดสอบบังคับรันทันที:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\ili-report-runner.ps1 -Force
```

## เงื่อนไขส่งจริง

ถ้าต้องการให้ส่งเข้า D506 จริงแบบไม่ต้องเปิดเว็บ ต้องมีอย่างใดอย่างหนึ่ง:

- API endpoint ที่ D506/MOPH รองรับอย่างเป็นทางการ
- MOPH reporter endpoint ภายในที่ login/session ถูกต้อง
- browser automation ที่ผู้ใช้ login แล้ว และยืนยันก่อน submit

เมื่อได้ endpoint ให้ตั้ง:

```env
MOPH_REPORTER_ENDPOINT=https://your-reporter-endpoint
MOPH_USERNAME=...
MOPH_PASSWORD=...
```
