# HEPA-GLUE x Hermes Agent

เอกสารนี้สรุปสถานะการต่อ Hermes Agent เข้ากับโปรเจกต์ HEPA-GLUE x hepa-connect บนเครื่องนี้

## สถานะปัจจุบัน

- Upstream ที่ใช้: https://github.com/NousResearch/hermes-agent
- Hermes Agent core CLI ตรวจจาก `HERMES_CLI_PATH`, คำสั่ง `hermes` ใน PATH, หรือ Windows native path `%LOCALAPPDATA%\hermes`
- คำสั่ง `hermes version`, `hermes status`, `hermes model`, `hermes setup` ใช้ตรวจและตั้งค่า agent
- ยังไม่ได้ตั้งค่า model/provider หรือ API key สำหรับให้ Hermes คิด/ตอบแบบ agent จริง ถ้ายังไม่มี `NOUS_API_KEY`, `OPENROUTER_API_KEY`, `OPENAI_API_KEY` หรือกลุ่ม `GLM/ZAI`
- installer ติดปัญหาไดรฟ์ C: เต็ม ทำให้ browser/TUI npm dependencies ยังไม่สมบูรณ์
- HEPA-Connect local app ยังรันที่ `http://127.0.0.1:5174/`
- HOSxP MariaDB direct ยังเชื่อมไม่ได้ เพราะ server ปฏิเสธ host เครื่องนี้
- Smart Query และ KUMHOS Lab API เข้าถึงได้บางส่วน แต่ยังไม่พบ feed lab hepatitis ที่ใช้ production ได้ตรง

## ติดตั้ง Hermes Agent จาก NousResearch

macOS / Linux / WSL:

```bash
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
hermes setup
hermes model
```

Windows PowerShell:

```powershell
iex (irm https://hermes-agent.nousresearch.com/install.ps1)
hermes setup
hermes model
```

ถ้า `hepa-connect` หา CLI ไม่เจอ ให้ตั้งค่า path เอง:

```bash
HERMES_CLI_PATH=/absolute/path/to/hermes
```

หรือบน Windows:

```powershell
HERMES_CLI_PATH=%LOCALAPPDATA%\hermes\hermes-agent\venv\Scripts\hermes.exe
```

## คำสั่งที่เพิ่มในโปรเจกต์

ตรวจ Hermes:

```powershell
npm run hermes:status
```

ถาม Hermes โดยใช้ context ของ HEPA-GLUE:

```powershell
npm run hermes:ask -- "ช่วยตรวจแผนเชื่อม HOSxP lab feed สำหรับ HBsAg และ Anti-HCV"
```

หมายเหตุ: คำสั่ง `hermes:ask` จะใช้ได้เต็มเมื่อ Hermes มี model/provider แล้ว เช่น Nous Portal, OpenAI, OpenRouter หรือ provider อื่นที่ตั้งค่าใน `hermes model`/`hermes auth`

Environment ที่ `hepa-connect` ใช้ตรวจความพร้อม:

```bash
NOUS_API_KEY=
OPENROUTER_API_KEY=
OPENAI_API_KEY=
GLM_API_KEY=
ZAI_API_KEY=
Z_AI_API_KEY=
```

## วิธีรวมกับระบบนี้

เส้นทางที่ปลอดภัยที่สุดคือให้ HEPA-Connect เรียก agent ผ่าน local command หรือ local service เฉพาะงานที่ไม่ส่งข้อมูลผู้ป่วยจริงออกไปนอกระบบ

งานที่ Hermes ช่วยได้ทันทีหลังตั้งค่า model:

- ตรวจแผนเชื่อมระบบและสรุปปัญหา integration
- วิเคราะห์ log/error ของ sync job
- ช่วยสร้าง SQL หรือ API contract สำหรับ lab hepatitis feed
- ช่วยร่างข้อความติดตามผู้ป่วยแบบไม่ใส่ PHI
- ช่วยตรวจ mapping ระหว่าง care gap, LINE follow-up และ MOPH reporting

งานที่ยังไม่ควรให้ Hermes ทำอัตโนมัติจนกว่าจะมี production control:

- ส่งข้อมูลผู้ป่วยจริงออกนอกระบบ
- ส่ง MOPH production report จริง
- ส่ง LINE message จริงให้ผู้ป่วย/อสม.
- query MariaDB production โดยตรงจากเครื่องนี้

## เงื่อนไขก่อน automation ครบลูป

1. ต้องมี endpoint หรือ dataset สำหรับ `HBsAg`, `Anti-HCV`, `HCV RNA` จาก HOSxP/lab system
2. ต้องเปิดสิทธิ์ MariaDB ให้ host ที่เหมาะสม หรือวาง HEPA-GLUE Engine บน server ฝั่งเดียวกับฐานข้อมูล
3. ต้องตั้งค่า LINE channel token และ MOPH credential ใน environment ของ server
4. ต้องตั้งค่า Hermes provider/auth ให้เรียก model ได้
5. ต้องทำ data minimization: ส่งเฉพาะข้อมูลที่จำเป็น และหลีกเลี่ยง PHI ใน prompt

## สรุป

Hermes รวมกับโปรเจกต์นี้ได้ในฐานะ agent/automation helper แต่ตอนนี้ยังเป็นสถานะ partial เพราะขาด model auth, lab hepatitis feed, production credentials และสิทธิ์ฐานข้อมูล HOSxP
