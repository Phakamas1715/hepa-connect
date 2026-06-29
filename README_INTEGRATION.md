# HEPA-GLUE Engine × hepa-connect: Full Integration

## 📋 Project Overview

This is the fully integrated **HEPA-GLUE Engine** system combining:

1. **Frontend (hepa-connect):** React-based dashboard for patient care gap management
2. **Backend (HEPA-GLUE Engine):** Multi-module AI system for behavioral nudges and MOPH reporting
3. **Database (Supabase):** PostgreSQL-based cloud database for real-time data sync
4. **Local Agent:** Python proxy for secure HOSxP/JHCIS data extraction

## HBV CUP Nam Phong Screening Snapshot

ระบบแยกตัวเลข "รายชื่อกลางสำหรับทำงานหน้างาน" ออกจาก "ผลงาน HDC/สปสช. สำหรับ reconcile รายงาน" เพื่อไม่ให้สรุปรายงานอำเภอผิดจากการกระจุกข้อมูลที่โรงพยาบาล

- เป้าหมายรวม CUP: 6,556 ราย
- ผลงาน Dashboard สปสช.: 392 ราย
- ผลงานรวมจาก HDC ตามเอกสาร: 13,465 ราย
- ผลรวมรายแถว HDC ในชุดข้อมูลนี้: 13,466 ราย
- ผลงาน HDC ที่โรงพยาบาลน้ำพอง: 13,463 ราย
- ผลงาน HDC รวม รพ.สต.: 3 ราย

ข้อสังเกต: HDC กระจุกเกือบทั้งหมดที่โรงพยาบาลน้ำพอง ขณะที่ รพ.สต. มีผลงานเข้า HDC เพียง 3 แห่ง ได้แก่ รพ.สต.น้ำพอง, รพ.สต.บ้านคำบง และ รพ.สต.กุดน้ำใส แห่งละ 1 ราย จึงควรตรวจสอบ mapping หน่วยบริการและการส่งข้อมูล HDC ก่อนใช้เป็นยอดสรุประดับอำเภอ

## Service Area Mapping

ใช้ `src/lib/hepa-service-area.ts` เป็น master mapping สำหรับงานไวรัสตับอักเสบ โดยแยกรหัสพื้นที่ตามตำบลและหมู่บ้านรับผิดชอบ เช่น `NPH`, `NP`, `NPGKS`, `KMW`, `KNK`, `KS` และรหัส รพ.สต. อื่น ๆ ใน CUP น้ำพอง

mapping นี้ถูกใช้ร่วมกันในหน้า Integration, หน้า Patients และ Dashboard เพื่อให้การแยกรายชื่อกลาง, QR scan, care gap และการ reconcile HDC/HOSxP ใช้รหัสพื้นที่ชุดเดียวกัน

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  Frontend (hepa-connect)                     │
│  - Patient Care Gap Dashboard                               │
│  - LINE Nudge Dispatch Interface                            │
│  - MOPH Integration Panel                                   │
│  - Behavioral AI Command Center                             │
└──────────────────────────────────────────────────────────────┘
                              ↕
                    ┌──────────────────┐
                    │  Supabase Cloud  │
                    │  (PostgreSQL)    │
                    └──────────────────┘
                              ↕
┌──────────────────────────────────────────────────────────────┐
│          HEPA-GLUE Engine (Backend Services)                │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Module 1: Local Data Agent (hepa_glue_agent.py)      │ │
│  │ - Runs on-premise in hospital network                 │ │
│  │ - Extracts data from HOSxP/JHCIS                      │ │
│  │ - Syncs to Supabase (Outbound Only)                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Module 2: LINE Bot MCP Server                         │ │
│  │ - Behavioral persona classification                   │ │
│  │ - Persona-tailored nudge generation                   │ │
│  │ - LINE message dispatch to อสม. and patients         │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Module 3: MOPH Reporting Engine                       │ │
│  │ - ICD-10 mapping (B18.1, B18.2)                       │ │
│  │ - Portal submission (ddsdoe, d506, DOE)              │ │
│  │ - Transaction tracking & audit logs                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Module 4: World Model Simulation                      │ │
│  │ - AI-driven kit allocation optimization               │ │
│  │ - Care gap prediction                                 │ │
│  │ - Resource planning (10,000 iterations)               │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 22.13.0+
- pnpm package manager
- Supabase account
- Python 3.9+ (for local agent)

### Installation

1. **Clone and setup frontend:**

   ```bash
   cd hepa-connect
   pnpm install
   ```

2. **Configure environment:**

   ```bash
   cp .env.example .env.local
   # Edit .env.local with your Supabase credentials
   ```

3. **Create Supabase database:**
   - Go to Supabase Dashboard
   - Create new project
   - Run SQL from `full_production_schema.sql`

4. **Deploy local agent (on-premise):**

   ```bash
   # On a machine in the hospital network
   python3 hepa_glue_agent.py
   ```

5. **Start development server:**

   ```bash
   pnpm dev
   ```

6. **Build for production:**
   ```bash
   pnpm build
   ```

## 📁 Project Structure

```
hepa-connect/
├── src/
│   ├── components/
│   │   ├── line-agent-nudge.tsx       # LINE nudge UI component
│   │   ├── app-sidebar.tsx             # Navigation sidebar
│   │   └── ui/                         # Radix UI components
│   ├── lib/
│   │   ├── supabase.ts                 # Supabase client & queries
│   │   ├── hepa-data.ts                # Data types & personas
│   │   └── utils.ts                    # Utility functions
│   ├── routes/
│   │   ├── index.tsx                   # Dashboard home
│   │   ├── patients.tsx                # Patient care gap list
│   │   ├── integration.tsx             # MOPH integration panel
│   │   └── api/
│   │       ├── send-nudge.ts           # LINE nudge API endpoint
│   │       └── submit-moph-report.ts   # MOPH report API endpoint
│   ├── router.tsx                      # TanStack Router config
│   └── styles.css                      # Global styles
├── .env.example                         # Environment template
├── INTEGRATION_GUIDE.md                 # Detailed integration docs
└── README_INTEGRATION.md                # This file
```

## 🔧 Configuration

### Environment Variables

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# LINE Bot Configuration
VITE_LINE_BOT_CHANNEL_ID=your-line-channel-id
VITE_LINE_BOT_CHANNEL_SECRET=your-line-channel-secret

# MOPH Portal Configuration
VITE_MOPH_USERNAME=your-moph-username
VITE_MOPH_PASSWORD=your-moph-password
```

### Local Agent Configuration

Edit `hepa_glue_agent.py`:

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

## 📊 Key Features

### 1. Patient Care Gap Dashboard

- Real-time patient list with lab results
- Behavioral persona classification
- Care gap identification
- Search and filter capabilities

### 2. LINE Behavioral Nudges

- Persona-tailored messaging (The Fearful, The Forgetful, The Denier, The Engaged, The Striver)
- Automatic dispatch to อสม. and patients
- Rich Flex card messaging
- Delivery tracking

### 3. MOPH Portal Integration

- Automated report submission
- ICD-10 code mapping
- Multi-portal support (ddsdoe, d506, DOE)
- Transaction ID tracking
- Audit logging

### 4. World Model Simulation

- AI-driven kit allocation
- Care cascade prediction
- Resource optimization
- 10,000 iteration simulations

## 🔌 API Endpoints

### POST /api/send-nudge

Sends a LINE nudge to a patient.

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
  "message": "LINE nudge sent successfully"
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
    "hbsag": "Positive"
  },
  "portalType": "ddsdoe"
}
```

**Response:**

```json
{
  "status": "success",
  "transactionId": "TXN-1718704800000"
}
```

## 📈 Database Schema

### patients_care_gap

Main table for patient data and care status.

**Key Fields:**

- `hn` (Primary Key): Hospital Number
- `name`: Patient Name
- `testDate`: Date of Lab Test
- `hbsag`, `hcvAb`, `hcvVL`: Lab Results
- `persona`: Behavioral Classification
- `care_status`: Care Linkage Status
- `moph_sync_status`: MOPH Report Status

### nudge_logs

Tracks all LINE nudge dispatches.

**Key Fields:**

- `hn`: Patient HN (FK)
- `persona`: Persona Used
- `sent_at`: Dispatch Timestamp
- `status`: Delivery Status

### moph_sync_logs

Tracks all MOPH report submissions.

**Key Fields:**

- `hn`: Patient HN (FK)
- `portal_type`: Portal Type
- `transaction_id`: MOPH Transaction ID
- `sync_at`: Submission Timestamp

## 🧪 Testing

### Development Mode

```bash
pnpm dev
# Navigate to http://localhost:5173
```

### Build & Preview

```bash
pnpm build
pnpm preview
```

### Linting

```bash
pnpm lint
```

### Formatting

```bash
pnpm format
```

## 🚢 Deployment

### Docker Deployment

```bash
# Build image
docker build -t hepa-connect:latest .

# Run container
docker run -p 3000:3000 \
  -e VITE_SUPABASE_URL=... \
  -e VITE_SUPABASE_ANON_KEY=... \
  hepa-connect:latest
```

### Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel deploy

# Set environment variables
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
```

### Traditional Server Deployment

```bash
# Build
pnpm build

# Copy dist/ to your server
scp -r dist/* user@server:/var/www/hepa-connect/

# Configure nginx/apache to serve dist/
```

## 🔐 Security Considerations

1. **Credentials Management:**
   - Never commit `.env.local` to version control
   - Use environment variable management (Vercel, GitHub Secrets, etc.)
   - Rotate MOPH credentials regularly

2. **Data Privacy:**
   - Supabase Row Level Security (RLS) enabled
   - Patient data encrypted in transit (HTTPS)
   - Audit logs for all MOPH submissions

3. **Network Security:**
   - Local agent uses outbound-only connections
   - No inbound ports exposed from hospital network
   - CORS configured for trusted domains only

## 📚 Documentation

- **INTEGRATION_GUIDE.md:** Detailed integration instructions
- **HEPA-GLUE Engine README:** Backend system documentation
- **Supabase Docs:** https://supabase.com/docs
- **TanStack Start Docs:** https://tanstack.com/start

## 🐛 Troubleshooting

### Issue: "Loading patients data from Supabase..." stuck

**Solution:** Verify `.env.local` has correct Supabase credentials

### Issue: LINE nudge fails

**Solution:** Check `/api/send-nudge` endpoint and LINE Bot MCP Server status

### Issue: MOPH report submission fails

**Solution:** Verify MOPH credentials and portal connectivity

### Issue: Local agent not syncing data

**Solution:** Check HOSxP connection and Supabase API key in `hepa_glue_agent.py`

## 📞 Support

For issues or questions:

1. Check the INTEGRATION_GUIDE.md
2. Review error logs in browser console
3. Check server logs: `hepa_agent.log`
4. Contact the development team

## 📄 License

This project is part of the HEPA-GLUE Engine initiative for Hepatitis B & C elimination in Thailand.

## ✅ Checklist for Go-Live

- [ ] Supabase project created and configured
- [ ] Database schema deployed
- [ ] Environment variables set in production
- [ ] Local agent running on-premise
- [ ] LINE Bot MCP Server configured
- [ ] MOPH credentials verified
- [ ] Frontend deployed to production
- [ ] SSL/TLS certificates configured
- [ ] Backup and disaster recovery plan in place
- [ ] User training completed

---

**Version:** 1.0.0-production
**Last Updated:** June 18, 2026
**Maintained By:** HEPA-GLUE Development Team
