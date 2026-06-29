# ติดตั้ง hepa-namphong จาก Windows ไป VPS/Lightsail

ต้องรู้ 2 ค่า:

- Public IP ของ VPS/Lightsail
- username SSH ส่วนใหญ่ AWS Lightsail Ubuntu คือ `ubuntu`

## ถ้า SSH ไม่ต้องใช้ key

```powershell
powershell -ExecutionPolicy Bypass -File C:\Users\Lenovo\Downloads\hepa-glue-complete-integration\hepa-connect\deploy\deploy-from-windows.ps1 -Host PUBLIC_IP -User ubuntu -PublicIp PUBLIC_IP
```

## ถ้าใช้ key .pem

```powershell
powershell -ExecutionPolicy Bypass -File C:\Users\Lenovo\Downloads\hepa-glue-complete-integration\hepa-connect\deploy\deploy-from-windows.ps1 -Host PUBLIC_IP -User ubuntu -PublicIp PUBLIC_IP -KeyPath C:\path\lightsail.pem
```

หลังติดตั้งเสร็จ ระบบจะแสดง:

- App URL
- Health URL
- Production readiness URL
- LINE Webhook URL
- LIFF Endpoint URL

LINE Webhook จะอยู่รูปแบบนี้:

```text
https://hepa-namphong.PUBLIC_IP.sslip.io/api/line-webhook
```
