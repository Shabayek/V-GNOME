#!/bin/bash

echo "🎨 Deploying V-GNOME Canvas Workpad via API..."

# Define the payload in a single variable to avoid shell escaping issues
WORKPAD_JSON='{"attributes":{"name":"V-GNOME: Genomic Intelligence Terminal","width":1200,"height":800,"page":0,"pages":[{"id":"page-1","name":"Mission Control","style":{"background":"#0F172A"},"elements":[{"id":"el-1","name":"header","type":"element","position":{"top":40,"left":40,"height":100,"width":1000,"angle":0,"parent":null},"expression":"markdown \"# V-GNOME\\n### BIOMETRIC GENOMIC CURATION AGENT\" | render css=\".canvasRenderEl h1 { color: #38BDF8; font-family: sans-serif; }\""},{"id":"el-2","name":"genomes_metric","type":"element","position":{"top":160,"left":40,"height":150,"width":300,"angle":0,"parent":null},"expression":"essql query=\"SELECT count(*) as total FROM \\\"genomic_profiles\\\"\" | math \"total\" | metric label=\"Genomes Indexed\" | render"},{"id":"el-3","name":"species_metric","type":"element","position":{"top":160,"left":360,"height":150,"width":300,"angle":0,"parent":null},"expression":"essql query=\"SELECT count(DISTINCT cluster_id) as total FROM \\\"genomic_profiles\\\"\" | math \"total\" | metric label=\"Unique Species\" | render"}],"groups":[]}],"colors":["#38BDF8","#2DD4BF"],"assets":{},"variables":[],"groups":[],"css":""}}'

# Perform the API call using a properly formatted curl command
curl -X POST "http://localhost:5601/api/saved_objects/canvas-workpad/vgnome-hackathon-api?overwrite=true" \
  -H "kbn-xsrf: true" \
  -H "Content-Type: application/json" \
  -d "$WORKPAD_JSON"

echo -e "\n\n✅ Canvas Workpad Deployed!"
echo "Open it here: http://localhost:5601/app/canvas#/workpad/vgnome-hackathon-api"
