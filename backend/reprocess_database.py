# backend/reprocess_database.py
import sys
import os

# Add the parent directory to sys.path so we can import backend.app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.app.elasticsearch_client import es_client, ELASTICSEARCH_INDEX, store_genome_profile
from backend.app.face_generator import map_genome_to_face

def reprocess_all():
    print(f"Starting database-wide reprocessing for index: {ELASTICSEARCH_INDEX}")
    
    # 1. Fetch all documents
    # Using a scroll or search with large size since it's a local research DB
    response = es_client.search(
        index=ELASTICSEARCH_INDEX,
        query={"match_all": {}},
        size=5000 
    )
    
    hits = response['hits']['hits']
    total = len(hits)
    print(f"Found {total} genomes to re-process.")

    updated_count = 0
    for hit in hits:
        source = hit['_source']
        sequence_hash = source['sequence_hash']
        cluster_id = source.get('cluster_id', 'Unknown')
        
        # Original metrics were stored in the document
        metrics = source.get('metrics', {})
        
        # Re-calculate parameters using the NEW logic
        try:
            new_face_params = map_genome_to_face(sequence_hash, metrics, cluster_id)
            
            # Update only the face_parameters part of the document
            es_client.update(
                index=ELASTICSEARCH_INDEX,
                id=sequence_hash,
                body={"doc": {"face_parameters": new_face_params.__dict__}},
                refresh=False # We will refresh at the very end
            )
            updated_count += 1
            if updated_count % 50 == 0:
                print(f"Progress: {updated_count}/{total}...")
        except Exception as e:
            print(f"Error processing {sequence_hash}: {e}")

    # Final refresh to make changes visible
    es_client.indices.refresh(index=ELASTICSEARCH_INDEX)
    print(f"Finished! Updated {updated_count} genome profiles with new hierarchical mapping.")

if __name__ == "__main__":
    reprocess_all()
