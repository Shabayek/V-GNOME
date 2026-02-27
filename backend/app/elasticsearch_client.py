# backend/app/elasticsearch_client.py

from elasticsearch import Elasticsearch
from datetime import datetime
import os
import time

# --- Configuration ---
ELASTICSEARCH_HOST = os.getenv("ELASTICSEARCH_HOST", "http://127.0.0.1:9200")
ELASTICSEARCH_INDEX = os.getenv("ELASTICSEARCH_INDEX", "genomic_profiles")

# --- Elasticsearch Client Initialization ---
es_client = Elasticsearch([ELASTICSEARCH_HOST])

# --- Index Mapping Definition ---
ELASTICSEARCH_MAPPING = {
    "mappings": {
        "properties": {
            "genome_id": {"type": "keyword"},
            "name": {"type": "text"},
            "sequence_hash": {"type": "keyword"},
            "upload_date": {"type": "date"},
            "metrics": {"type": "object", "dynamic": True},
            "face_parameters_label": {"type": "object", "enabled": True},
            "face_parameters_signature": {"type": "object", "enabled": True},
            "face_parameters": {"type": "object", "enabled": True}, # Active set
            "cluster_id": {"type": "keyword"},
        }
    }
}

# --- Utility Functions ---

def create_index_if_not_exists():
    """Creates the Elasticsearch index with the defined mapping."""
    if not es_client.indices.exists(index=ELASTICSEARCH_INDEX):
        try:
            es_client.indices.create(index=ELASTICSEARCH_INDEX, body=ELASTICSEARCH_MAPPING)
            print(f"Elasticsearch index '{ELASTICSEARCH_INDEX}' created successfully.")
        except Exception as e:
            print(f"Error creating Elasticsearch index '{ELASTICSEARCH_INDEX}': {e}")

def store_genome_profile(genome_profile: dict):
    """Stores a genome profile document in Elasticsearch."""
    if "sequence_hash" not in genome_profile:
        raise ValueError("Genome profile must contain 'sequence_hash' to be stored.")
    
    if "upload_date" not in genome_profile:
        genome_profile["upload_date"] = datetime.now().isoformat()
    
    doc = {
        "genome_id": genome_profile.get("genome_id", genome_profile["sequence_hash"]),
        "name": genome_profile.get("name", "Unnamed Genome"),
        "sequence_hash": genome_profile["sequence_hash"],
        "upload_date": genome_profile["upload_date"],
        "metrics": {**genome_profile.get("face_data", {}).get("bio_features", {}), **genome_profile.get("metrics", {})},
        "cluster_id": genome_profile.get("cluster_id", "cluster_1") 
    }

    doc["face_parameters_label"] = genome_profile.get("face_parameters_label")
    doc["face_parameters_signature"] = genome_profile.get("face_parameters_signature")
    doc["face_parameters"] = genome_profile.get("face_data", {}).get("face_parameters")

    try:
        es_client.index(index=ELASTICSEARCH_INDEX, id=genome_profile["sequence_hash"], body=doc, refresh=True)
    except Exception as e:
        print(f"Error storing genome profile '{genome_profile['sequence_hash']}': {e}")
        raise

def get_genome_profile(sequence_hash: str):
    try:
        print(f"DEBUG: es_client.get(index='{ELASTICSEARCH_INDEX}', id='{sequence_hash}')")
        response = es_client.get(index=ELASTICSEARCH_INDEX, id=sequence_hash)
        return response["_source"]
    except Exception as e:
        print(f"DEBUG: es_client.get FAILED for {sequence_hash}. Error: {e}")
        return None

def calculate_dual_averages(query: dict):
    """Internal helper to aggregate averages for both S and L parameter sets."""
    params = ["face_width", "face_height", "jaw_shape", "eye_size", "eye_spacing", 
              "mouth_width", "mouth_curve", "antenna_length", "asymmetry_factor",
              "face_shape_type", "eye_color_hue", "skin_tone_hue", "skin_tone_saturation",
              "forehead_pattern", "antenna_type"]
    
    aggs = {}
    for p in params:
        aggs[f"sig_{p}"] = {"avg": {"field": f"face_parameters_signature.{p}"}}
        aggs[f"lab_{p}"] = {"avg": {"field": f"face_parameters_label.{p}"}}

    try:
        response = es_client.search(index=ELASTICSEARCH_INDEX, query=query, size=0, aggs=aggs)
        if response['hits']['total']['value'] == 0: return None
        
        results = {"signature": {}, "label": {}}
        for k, v in response['aggregations'].items():
            val = v.get('value')
            if k.startswith("sig_"):
                results["signature"][k.replace("sig_", "")] = val
            else:
                results["label"][k.replace("lab_", "")] = val
        return results
    except Exception as e:
        print(f"Aggregation error: {e}")
        return None

def get_cluster_prototype_params(cluster_id: str) -> dict | None:
    return calculate_dual_averages({"term": {"cluster_id": cluster_id}})

def list_clusters():
    try:
        response = es_client.search(index=ELASTICSEARCH_INDEX, size=0, aggs={"unique_clusters": {"terms": {"field": "cluster_id", "size": 100}}})
        return [b['key'] for b in response['aggregations']['unique_clusters']['buckets']]
    except: return []

def rename_cluster(old_id: str, new_id: str):
    try:
        print(f"ES: renaming {old_id} -> {new_id}")
        res = es_client.update_by_query(
            index=ELASTICSEARCH_INDEX, 
            body={
                "script": {
                    "source": "ctx._source.cluster_id = params.new_id", 
                    "params": {"new_id": new_id}
                }, 
                "query": {"match": {"cluster_id": {"query": old_id, "operator": "and"}}}
            }, 
            wait_for_completion=True, 
            refresh=True
        )
        print(f"ES result: {res}")
        return True
    except Exception as e:
        print(f"ES rename ERROR: {e}")
        return False

def delete_cluster(cluster_id: str):
    try:
        es_client.delete_by_query(
            index=ELASTICSEARCH_INDEX, 
            body={"query": {"match": {"cluster_id": {"query": cluster_id, "operator": "and"}}}}, 
            wait_for_completion=True, 
            refresh=True
        )
        return True
    except: return False

def delete_genome(sequence_hash: str):
    try:
        es_client.delete(index=ELASTICSEARCH_INDEX, id=sequence_hash, refresh=True)
        return True
    except: return False

def update_genome_cluster(sequence_hash: str, new_cluster_id: str):
    try:
        es_client.update(index=ELASTICSEARCH_INDEX, id=sequence_hash, body={"doc": {"cluster_id": new_cluster_id}}, refresh=True)
        return True
    except: return False

def find_closest_cluster(metrics: dict) -> tuple[str, float]:
    clusters = list_clusters()
    if not clusters: return "cluster_1", 1.0
    
    new_gc = metrics.get('gc_content', 0.5)
    new_cpg = metrics.get('cpg_odds', 0.5)
    new_ent = metrics.get('signature_entropy', 0.5)
    new_rob = metrics.get('coding_robustness', 0.0)
    new_skw = metrics.get('gc_skew', 0.5)
    new_hyd = metrics.get('hydrophobic_ratio', 0.5)
    new_pur = metrics.get('purine_ratio', 0.5)
    
    best_cluster = clusters[0]
    min_dist = float('inf')
    
    for cid in clusters:
        proto = get_cluster_prototype_params(cid)
        if proto and 'signature' in proto:
            # We now use 7 Biometric Dimensions for absolute taxonomic resolution:
            # 1. face_width      = gc_content
            # 2. face_height     = cpg_odds (scaled)
            # 3. eye_size        = signature_entropy
            # 4. armor_plating   = coding_robustness
            # 5. jaw_shape       = gc_skew
            # 6. glow_intensity  = hydrophobic_ratio
            # 7. mouth_width     = purine_ratio (The new 7th anchor)
            
            p = proto['signature']
            # Use safety defaults if a specific prototype field is missing
            proto_gc  = p.get('face_width', 0.5)
            proto_cpg = (p.get('face_height', 0.5) * 2.0) - 0.5
            proto_ent = p.get('eye_size', 0.5)
            proto_rob = p.get('armor_plating', 0.0)
            proto_skw = p.get('jaw_shape', 0.5)
            proto_hyd = p.get('glow_intensity', 0.5)
            proto_pur = p.get('mouth_width', 0.5)
            
            # Euclidean distance in 7D Biometric Space
            dist = (
                (new_gc - proto_gc)**2 + 
                (new_cpg - proto_cpg)**2 + 
                (new_ent - proto_ent)**2 +
                (new_rob - proto_rob)**2 +
                (new_skw - proto_skw)**2 +
                (new_hyd - proto_hyd)**2 +
                (new_pur - proto_pur)**2
            )**0.5
            
            if dist < min_dist:
                    min_dist = dist
                    best_cluster = cid
                    
    # Normalize score: a distance of 0.0 is 100% match, a distance of 1.0+ is low match
    similarity_score = max(0.0, 1.0 - min_dist)
    return best_cluster, similarity_score

def get_cluster_genomes(cluster_id: str):
    try:
        response = es_client.search(index=ELASTICSEARCH_INDEX, query={"term": {"cluster_id": cluster_id}}, size=100)
        return [hit["_source"] for hit in response["hits"]["hits"]]
    except: return []

def get_genus_prototype_params(genus: str) -> dict | None:
    return calculate_dual_averages({"prefix": {"cluster_id": {"value": genus}}})

def delete_genus(genus: str):
    try:
        es_client.delete_by_query(index=ELASTICSEARCH_INDEX, body={"query": {"prefix": {"cluster_id": {"value": genus}}}}, wait_for_completion=True, refresh=True)
        return True
    except: return False

def initialize_elasticsearch():
    max_retries = 5; retry_delay_seconds = 5
    for i in range(max_retries):
        try:
            if es_client.ping():
                create_index_if_not_exists()
                return True
        except: pass
        time.sleep(retry_delay_seconds)
    return False
