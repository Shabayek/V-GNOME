#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/../.."

echo "--- Starting Elastic Stack Services ---"

# 1. Start Elasticsearch
if pgrep -f "org.elasticsearch.bootstrap.Elasticsearch" > /dev/null; then
    echo "[!] Elasticsearch is already running."
else
    echo "[+] Starting Elasticsearch..."
    # Start in daemon mode (-d)
    if [ -f "./vendor/elasticsearch-8.12.2/bin/elasticsearch" ]; then
        ./vendor/elasticsearch-8.12.2/bin/elasticsearch -d
        echo "    Waiting for Elasticsearch to initialize..."
        # Wait for the port to be active (max 60 seconds)
        for i in {1..12}; do
            if curl -s http://localhost:9200 > /dev/null; then
                echo "[OK] Elasticsearch is up."
                break
            fi
            sleep 5
        done
    else
        echo "❌ Error: Elasticsearch binary not found at ./vendor/elasticsearch-8.12.2/bin/elasticsearch"
        exit 1
    fi
fi

# 2. Start Kibana
if pgrep -f "kibana" | grep -v "grep" > /dev/null; then
    echo "[!] Kibana is already running."
else
    echo "[+] Starting Kibana..."
    # Start in the background
    if [ -f "./vendor/kibana-8.12.2/bin/kibana" ]; then
        nohup ./vendor/kibana-8.12.2/bin/kibana > kibana.log 2>&1 &
        echo "[OK] Kibana started in the background (logging to kibana.log)."
        echo "     Access it at http://localhost:5601 once initialized."
    else
        echo "❌ Error: Kibana binary not found at ./vendor/kibana-8.12.2/bin/kibana"
    fi
fi

echo "---------------------------------------"
