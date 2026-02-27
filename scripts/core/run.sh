#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/../.."

# 1. Ensure Elasticsearch is running
./scripts/core/run_elasticsearch_only.sh
if [ $? -ne 0 ]; then
    echo "❌ Failed to start or verify Elasticsearch. Exiting."
    exit 1
fi

# 2. Virtual Environment Setup
if [ -d "./venv" ]; then
    echo "Activating virtual environment at ./venv..."
    source "./venv/bin/activate"
elif [ -d "./Elastic" ]; then
    echo "Activating virtual environment at ./Elastic..."
    source "./Elastic/bin/activate"
else
    echo "Warning: No virtual environment found at ./venv or ./Elastic."
    echo "Attempting to continue using system python..."
fi

# 3. Install/Update Dependencies
echo "Checking backend dependencies..."
pip install -r backend/requirements.txt

# 4. Start FastAPI Application
echo "Starting FastAPI application (V-GNOME Backend)..."
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
