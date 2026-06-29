# HEPA HOSxP Bridge

ใช้เมื่อเครื่อง local ต่อ MariaDB ของ HOSxP ไม่ได้เพราะ host ไม่ถูก whitelist
แต่ server `172.16.213.55` อยู่ฝั่งเดียวกับ HOSxP และมี KUMHOS API ที่ต่อ DB ได้อยู่แล้ว

## ติดตั้งบน server

1. คัดลอกโฟลเดอร์ `deploy` ไปที่เครื่อง server
2. ดับเบิลคลิก `INSTALL_ON_NAMPHONG_SERVER.bat`
3. ทดสอบ URL:

```text
http://172.16.213.55/kumhos/kumhos_lab_api/hepa_glue_hepatitis_proxy.php?action=status
```

ถ้าสำเร็จจะได้ JSON `ok: true` และตาราง `lab_head`, `lab_order`, `patient` เป็น `true`

## เรียกผล lab hepatitis

```text
http://172.16.213.55/kumhos/kumhos_lab_api/hepa_glue_hepatitis_proxy.php?action=hepatitis_labs&date_from=2026-06-01&date_to=2026-06-20&limit=100
```

ค่าเริ่มต้นจะหา code:

```text
HB001 HC001 HC002 HBsAg HCV_RNA HCV_Ab
```

และค้นชื่อรายการ lab ที่มี `HBsAg`, `Anti-HCV`, `HCV`, หรือ `ไวรัสตับ`

## ตั้งค่าใน HEPA-Connect

`.env` ฝั่ง local ตั้งไว้แล้ว:

```text
HEPA_HOSXP_PROXY_URL=http://172.16.213.55/kumhos/kumhos_lab_api/hepa_glue_hepatitis_proxy.php
```

หลังวางไฟล์บน server ให้เปิด:

```text
http://127.0.0.1:5174/api/hosxp-bridge
http://127.0.0.1:5174/integration
```
