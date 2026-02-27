#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/../.."

# 1. Ensure the Data View (Index Pattern) exists
echo "[1/2] Initializing Data View..."
./scripts/full_stack/initialize_kibana.sh

# 2. Import the Visualizations and Dashboard
echo "[2/2] Importing Dashboard and Lenses..."
curl -X POST "http://localhost:5601/api/saved_objects/_import?overwrite=true" \
  -H "kbn-xsrf: true" \
  --form "file=@./scripts/full_stack/genomic_assets.ndjson"

echo -e "\n\n[DONE] Assets imported!"
echo "Navigate to: http://localhost:5601/app/dashboards#/view/genomic-curation-dashboard"
