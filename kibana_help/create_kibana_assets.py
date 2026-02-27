import requests
import json
import time

KIBANA_URL = "http://localhost:5601"
HEADERS = {
    "kbn-xsrf": "true",
    "Content-Type": "application/json"
}

def create_lens(id, title, description, state):
    print(f"[+] Creating Lens: {title}")
    url = f"{KIBANA_URL}/api/saved_objects/lens/{id}?overwrite=true"
    payload = {
        "attributes": {
            "title": title,
            "description": description,
            "state": state
        }
    }
    response = requests.post(url, headers=HEADERS, json=payload)
    if response.status_code in [200, 201]:
        print(f"    [OK] Lens '{title}' created.")
        return response.json()['id']
    else:
        print(f"    [ERROR] Failed to create Lens: {response.text}")
        return None

def create_dashboard(id, title, panels):
    print(f"[+] Creating Dashboard: {title}")
    url = f"{KIBANA_URL}/api/saved_objects/dashboard/{id}?overwrite=true"
    
    # Format panels for the dashboard
    formatted_panels = []
    for i, panel_id in enumerate(panels):
        formatted_panels.append({
            "version": "8.12.2",
            "type": "lens",
            "gridData": {"x": (i % 2) * 24, "y": (i // 2) * 15, "w": 24, "h": 15, "i": str(i)},
            "panelIndex": str(i),
            "embeddableConfig": {},
            "savedObjectId": panel_id
        })

    payload = {
        "attributes": {
            "title": title,
            "description": "Genomic Biometrics and Agent Insights",
            "panelsJSON": json.dumps(formatted_panels),
            "optionsJSON": json.dumps({"useMargins": True, "hidePanelTitles": False}),
            "timeRestore": True,
            "timeTo": "now",
            "timeFrom": "now-15m"
        }
    }
    response = requests.post(url, headers=HEADERS, json=payload)
    if response.status_code in [200, 201]:
        print(f"    [OK] Dashboard '{title}' created.")
    else:
        print(f"    [ERROR] Failed to create Dashboard: {response.text}")

def run_setup():
    # 1. Evolutionary Heatmap (Scatter Plot)
    heatmap_state = {
        "datasourceStates": {
            "indexpattern": {
                "layers": {
                    "layer_1": {
                        "columnId": "c1",
                        "indexPatternId": "genomic_profiles"
                    }
                }
            }
        },
        "visualization": {
            "layers": [
                {
                    "layerId": "layer_1",
                    "visDataType": "xyChart",
                    "geometry": "points",
                    "xAccessor": "metrics.gc_content",
                    "yAccessor": "metrics.cpg_odds",
                    "colorAccessor": "cluster_id"
                }
            ],
            "title": "Evolutionary Heatmap (GC vs CpG)"
        }
    }
    
    # 2. Species Robustness (Bar Chart)
    robustness_state = {
        "datasourceStates": {
            "indexpattern": {
                "layers": {
                    "layer_1": {
                        "columnId": "c1",
                        "indexPatternId": "genomic_profiles"
                    }
                }
            }
        },
        "visualization": {
            "layers": [
                {
                    "layerId": "layer_1",
                    "visDataType": "xyChart",
                    "geometry": "bars",
                    "xAccessor": "cluster_id",
                    "yAccessor": "metrics.coding_robustness"
                }
            ],
            "title": "Average Coding Robustness by Species"
        }
    }

    # Note: Simplified states for example purposes. 
    # In a real environment, Lens states are very verbose.
    # We will use the 'import' method for the full assets as it's more reliable.
    print("--- Kibana Asset Automation ---")
    print("For complex 8.12.2 Lens objects, using the Import API with NDJSON is the professional standard.")
    
run_setup()
