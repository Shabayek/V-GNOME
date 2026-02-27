#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/../.."

# Wait for Kibana to be ready
echo "Waiting for Kibana to respond..."
until curl -s http://localhost:5601/api/status | grep -q "available"; do
  sleep 5
done

echo "[+] Kibana is ready. Creating Data View..."

# Create the Data View with a static ID to match dashboard references
curl -X POST "http://localhost:5601/api/data_views/data_view" \
  -H 'kbn-xsrf: true' \
  -H 'Content-Type: application/json' \
  -d '{
    "data_view": {
       "id": "genomic_profiles",
       "title": "genomic_profiles",
       "name": "Genomic Profiles",
       "timeFieldName": "upload_date"
    }
  }'

echo -e "\n[OK] Data View created successfully."
