# HEPA-GLUE Engine × hepa-connect Integration Guide

## Overview

This document describes the full integration of the **HEPA-GLUE Engine** (Backend/Agent System) with the **hepa-connect** frontend application. The integration enables real-time patient data synchronization, behavioral AI nudges via LINE, and automated MOPH reporting.

## Current HBV Reporting Issue To Handle

ข้อมูล HBV ของ CUP น้ำพองที่นำเข้า dashboard แสดงให้เห็นว่า HDC และ Dashboard สปสช. ยังไม่ควรถูกใช้แทนกันโดยตรง:

| ตัวชี้วัด           |  จำนวน |
| ------------------- | -----: |
| เป้าหมาย CUP        |  6,556 |
| Dashboard สปสช.     |    392 |
| HDC ตามเอกสารสรุป   | 13,465 |
| HDC ผลรวมรายแถว     | 13,466 |
| HDC โรงพยาบาลน้ำพอง | 13,463 |
| HDC รวม รพ.สต.      |      3 |

ดังนั้น workflow production ควรให้ HEPA ใช้รายชื่อกลางเป็น source สำหรับปฏิบัติงาน รพ.สต. แล้วใช้ HDC/HOSxP เป็นข้อมูล reconcile/ยืนยันผลภายหลัง โดยเฉพาะต้องตรวจว่าผลงานของ รพ.สต. ถูกส่งเข้า HDC ครบหรือไม่ก่อนสรุปรายงานระดับอำเภอ

## Service Area Mapping

ไฟล์ `src/lib/hepa-service-area.ts` คือ master mapping สำหรับไวรัสตับอักเสบ CUP น้ำพอง ประกอบด้วยรหัสพื้นที่, ชื่อหน่วยบริการ, ตำบล และหมู่ที่รับผิดชอบ รวมถึงเขตแยกย่อย `NPGKS`, `KMW` และ `KNK`

ระบบใช้ mapping เดียวกันนี้สำหรับ:

- route `/integration` เพื่อแสดงตารางตรวจสอบ mapping
- route `/patients` เพื่อ resolve หน่วยรับผิดชอบจากตำบล/หมู่บ้านของผู้ป่วย
- dashboard เพื่อสื่อสารจำนวนเขตรับผิดชอบและตรวจ reconcile ก่อนส่งรายงาน

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    hepa-connect Frontend                     │
│  (TanStack Start + React + TypeScript + TailwindCSS)        │
└─────────────────────────────────────────────────────────────┘
                              ↕
                    ┌─────────────────┐
                    │  Supabase API   │
                    │  (PostgreSQL)   │
                    └─────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│            HEPA-GLUE Engine (Backend Services)              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. hepa_glue_agent.py (Local Proxy)                 │  │
│  │    - Connects to HOSxP/JHCIS (192.168.215.x)        │  │
│  │    - Syncs data to Supabase                         │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 2. LINE Bot MCP Server (line_mcp_handler.py)        │  │
│  │    - Sends persona-tailored nudges via LINE         │  │
│  │    - Dispatches Health Cards to อสม.               │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 3. MOPH Reporter (moph_reporter.py)                 │  │
│  │    - Submits reports to ddsdoe, d506, DOE portals   │  │
│  │    - Manages ICD-10 mapping & transaction tracking  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Setup Instructions

### Phase 1: Database Setup

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com) and create a new project
   - Note your `SUPABASE_URL` and `SUPABASE_ANON_KEY`

2. **Run Database Schema**
   - Copy the contents of `full_production_schema.sql` from the HEPA-GLUE Engine package
   - Paste into Supabase SQL Editor and execute
   - This creates tables: `patients_care_gap`, `nudge_logs`, `moph_sync_logs`

3. **Configure Environment Variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your Supabase credentials
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

### Phase 2: Deploy HEPA-GLUE Agent (On-Premise)

1. **On a machine within the hospital network:**

   ```bash
   # Copy hepa_glue_agent.py from HEPA-GLUE package
   python3 hepa_glue_agent.py
   ```

2. **Configure credentials in `hepa_glue_agent.py`:**

   ```python
   HOSXP_LOCAL_CONFIG = {
       'host': '192.168.215.21',
       'port': 3306,
       'user': 'nphosxp',
       'password': 'YOUR_ACTUAL_PASSWORD',
       'database': 'nphosxp'
   }

   SUPABASE_URL = "https://your-project.supabase.co/rest/v1/patients_care_gap"
   API_HEADERS = {
       "apikey": "YOUR_SUPABASE_ANON_KEY",
       "Authorization": "Bearer YOUR_SUPABASE_ANON_KEY",
       "Content-Type": "application/json",
   }
   ```

3. **Run as a service (Linux/systemd):**
   ```bash
   sudo systemctl enable hepa-glue-agent
   sudo systemctl start hepa-glue-agent
   ```

### Phase 3: Frontend Integration

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Start development server:**

   ```bash
   pnpm dev
   ```

3. **Build for production:**
   ```bash
   pnpm build
   pnpm preview
   ```

## Key Features Integrated

### 1. Real-Time Patient Data Fetching

- **File:** `src/lib/supabase.ts`
- **Function:** `fetchPatients()`
- **Usage:** Fetches all patients from `patients_care_gap` table
- **Integration:** Used in `src/routes/patients.tsx` via React Query

### 2. LINE Nudge Dispatch

- **Component:** `src/components/line-agent-nudge.tsx`
- **API Endpoint:** `/api/send-nudge` (POST)
- **Payload:**
  ```json
  {
    "recipientId": "HN-12345",
    "persona": "The Fearful",
    "messageType": "LINE_NUDGE"
  }
  ```
- **Response:** Dispatches 2 messages (to อสม. and patient)

### 3. MOPH Report Submission

- **Component:** `src/routes/integration.tsx`
- **API Endpoint:** `/api/submit-moph-report` (POST)
- **Payload:**
  ```json
  {
    "patientData": { ... },
    "portalType": "ddsdoe"
  }
  ```
- **Response:** Transaction ID and sync status

### 4. Behavioral AI Classification

- **File:** `src/lib/hepa-data.ts`
- **Personas:** The Fearful, The Forgetful, The Denier, The Engaged, The Striver
- **Nudges:** Persona-specific SMS and call scripts

## API Endpoints

### POST /api/send-nudge

Sends a LINE nudge to a patient via อสม.

**Request:**

```json
{
  "recipientId": "NPH-66-0142",
  "persona": "The Fearful",
  "messageType": "LINE_NUDGE"
}
```

**Response:**

```json
{
  "status": "success",
  "message": "LINE nudge sent successfully",
  "recipientId": "NPH-66-0142",
  "persona": "The Fearful",
  "messageType": "LINE_NUDGE"
}
```

### POST /api/submit-moph-report

Submits patient data to MOPH portals.

**Request:**

```json
{
  "patientData": {
    "hn": "NPH-66-0142",
    "name": "นายสมชาย ทองดี",
    "hbsag": "Positive",
    "hcvAb": "Positive"
  },
  "portalType": "ddsdoe"
}
```

**Response:**

```json
{
  "status": "success",
  "message": "MOPH report submitted successfully",
  "transactionId": "TXN-1718704800000",
  "patientData": { ... },
  "portalType": "ddsdoe"
}
```

## Database Schema

### patients_care_gap

Main table for storing patient data and care status.

| Field            | Type         | Description                                               |
| ---------------- | ------------ | --------------------------------------------------------- |
| hn               | VARCHAR(20)  | Hospital Number (Primary Key)                             |
| name             | VARCHAR(255) | Patient Name                                              |
| cid              | VARCHAR(13)  | Citizen ID                                                |
| birth_date       | DATE         | Date of Birth                                             |
| testDate         | DATE         | Test Date                                                 |
| subdistrict      | VARCHAR(100) | Subdistrict                                               |
| village          | VARCHAR(10)  | Village Number                                            |
| hbsag            | VARCHAR(50)  | HBsAg Result                                              |
| hcvAb            | VARCHAR(50)  | HCV Antibody Result                                       |
| hcvVL            | VARCHAR(100) | HCV Viral Load                                            |
| persona          | VARCHAR(50)  | Behavioral Persona                                        |
| care_status      | VARCHAR(50)  | Care Status (Pending, Confirmed, In Treatment, Completed) |
| moph_sync_status | VARCHAR(50)  | MOPH Sync Status                                          |
| reported         | BOOLEAN      | Whether reported to MOPH                                  |
| created_at       | TIMESTAMP    | Creation Timestamp                                        |
| updated_at       | TIMESTAMP    | Last Update Timestamp                                     |

### nudge_logs

Tracks all nudge dispatches.

| Field        | Type         | Description     |
| ------------ | ------------ | --------------- |
| id           | BIGSERIAL    | Primary Key     |
| hn           | VARCHAR(20)  | Patient HN (FK) |
| persona      | VARCHAR(50)  | Persona Used    |
| message_type | VARCHAR(100) | Type of Message |
| sent_at      | TIMESTAMP    | Send Timestamp  |
| status       | VARCHAR(50)  | Delivery Status |

### moph_sync_logs

Tracks all MOPH report submissions.

| Field          | Type         | Description                     |
| -------------- | ------------ | ------------------------------- |
| id             | BIGSERIAL    | Primary Key                     |
| hn             | VARCHAR(20)  | Patient HN (FK)                 |
| portal_type    | VARCHAR(50)  | Portal Type (ddsdoe, d506, doe) |
| icd10_code     | VARCHAR(10)  | ICD-10 Code                     |
| transaction_id | VARCHAR(100) | MOPH Transaction ID             |
| sync_at        | TIMESTAMP    | Sync Timestamp                  |
| status         | VARCHAR(50)  | Sync Status                     |

## Troubleshooting

### Issue: "Loading patients data from Supabase..." stuck

**Solution:** Check that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correctly set in `.env.local`

### Issue: LINE nudge fails to send

**Solution:** Verify that `/api/send-nudge` endpoint is reachable and the LINE Bot MCP Server is running

### Issue: MOPH report submission fails

**Solution:** Check MOPH credentials in `src/lib/hepa-data.ts` and ensure portal connectivity

## Deployment

### Docker Deployment

```bash
docker build -t hepa-connect .
docker run -p 3000:3000 -e VITE_SUPABASE_URL=... -e VITE_SUPABASE_ANON_KEY=... hepa-connect
```

### Vercel Deployment

```bash
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel deploy
```

## Support

For issues or questions, please refer to:

- HEPA-GLUE Engine documentation
- Supabase documentation: https://supabase.com/docs
- TanStack Start documentation: https://tanstack.com/start

---

**Last Updated:** June 18, 2026
**Version:** 1.0.0-production
