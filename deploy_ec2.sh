#!/usr/bin/env bash
# ==============================================================================
# Z-TRACS Automated EC2 Deployment & Process Manager Script
# ==============================================================================
set -e

echo "🚀 [1/5] Updating system packages & installing Node.js / PM2..."
sudo apt update -y
sudo apt install -y python3-pip python3-venv git curl
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi

if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi

echo "🐍 [2/5] Setting up Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

echo "📦 [3/5] Installing Python dependencies..."
pip install --upgrade pip
pip install fastapi uvicorn boto3 psycopg2-binary pydantic python-dotenv requests sqlalchemy python-multipart asyncpg

echo "🛑 [4/5] Stopping previous PM2 instances if running..."
pm2 delete all || true

echo "⚡ [5/5] Starting FastAPI Backend & 3 AI Ingestion Daemons..."
# Start FastAPI backend (correct root venv path with --app-dir)
pm2 start "venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --app-dir backend" --name "z-tracs-api"

# Start the 3 Continuous Background Daemons
pm2 start "venv/bin/python update_json.py" --name "daemon-anpr"
pm2 start "venv/bin/python update_frs.py" --name "daemon-frs"
pm2 start "venv/bin/python update_forensics.py" --name "daemon-forensics"

# Save PM2 state for automatic reboot persistence
pm2 save

echo ""
echo "=============================================================================="
echo "🎉 Z-TRACS BACKEND & DAEMONS ARE RUNNING SUCCESSFULLY ON EC2!"
echo "=============================================================================="
pm2 status
