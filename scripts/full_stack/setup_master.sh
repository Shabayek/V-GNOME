#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/../.."

echo "🚀 Starting V-GNOME Full Stack Setup..."

# 1. Start Elasticsearch & Kibana
echo "[1/4] Starting Services..."
./scripts/full_stack/run_search_and_kibana.sh

# 2. Seed Initial Data (Crucial for Lens to see fields)
echo "[2/4] Indexing seed genomic data..."
if [ -d "./venv" ]; then
    source ./venv/bin/activate
elif [ -d "./Elastic" ]; then
    source ./Elastic/bin/activate
fi
# Updated path to seed script
python ./scripts/full_stack/seed_genomic_data.py

# 3. Wait for Kibana to be fully ready
echo "[3/4] Waiting for Kibana API to stabilize (this can take 60s)..."
until curl -s http://localhost:5601/api/status | grep -q "available"; do
  echo -n "."
  sleep 5
done
echo -e "\n[OK] Kibana is online."

# 4. Import all Assets (Data View + Dashboard)
echo "[4/4] Importing Kibana Dashboards..."
./scripts/full_stack/import_kibana_assets.sh

echo "--------------------------------------------------"
echo "✅ SETUP COMPLETE"
echo "1. Backend: http://localhost:8000"
echo "2. Kibana:  http://localhost:5601"
echo "3. Dashboard: http://localhost:5601/app/dashboards#/view/genomic-curation-dashboard"
echo "--------------------------------------------------"
