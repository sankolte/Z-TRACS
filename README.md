markdown
# Z-TRACS — Tactical Real-Time Asset & Surveillance Grid
Z-TRACS is an enterprise surveillance management platform built for multi-camera video feed monitoring, GIS telemetry visualization, and command center analytics.
---
## 🏗 Architecture Overview
- **Frontend**: React 18, TypeScript, HLS.js, Tailwind CSS
- **Backend API**: FastAPI (Python 3.10+), PostgreSQL, Redis
- **Media Engine**: MediaMTX (RTSP/HLS Stream Relay)
---
## 📋 System Prerequisites
To execute full live streaming and video ingestion services, the following enterprise infrastructure components are required:
1. **Enterprise VMS Gateway License & Access Key**
2. **MediaMTX Ingestion Relay Node**
3. **PostgreSQL Database (`z_tracs_db`)**
4. **Redis Cache Cluster**
---
## 🚀 Getting Started
### 1. Repository Setup
```bash
git clone https://github.com/Gaurav8709/Z-TRACS.git
cd Z-TRACS
2. Frontend Installation
bash
npm install
npm run dev
3. Backend Setup
bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
⚙️ Environment Configuration
Create a .env file in the project root with your infrastructure endpoints:

env
VITE_API_BASE_URL=http://localhost:8000
SENTINEL_ACCESS_KEY=YOUR_ENTERPRISE_KEY_HERE
SENTINEL_RTSP_IP=127.0.0.1
