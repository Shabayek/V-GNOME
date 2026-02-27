# backend/reprocess_robust.py
import sys
import os
import hashlib
import zipfile
import tempfile
import shutil

# Add parent dir to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.app.elasticsearch_client import es_client, ELASTICSEARCH_INDEX
from backend.app.face_generator import map_genome_to_face
from backend.app.genomic_metrics import compute_all_metrics

# Directories to search for original sequences
SEARCH_DIRS = [
    "/home/shabayek/Documents/Personal/Bio/Reference Genomes/All Genome/",
    "data/"
]

def process_file_content(content):
    lines = content.splitlines()
    sequence = "".join([l.strip() for l in lines[1:] if l.strip() and not l.startswith('>')]).upper().replace('N', '')
    if sequence:
        h = hashlib.sha256(sequence.encode()).hexdigest()
        return h, sequence
    return None, None

def find_sequences():
    """Crawls folders AND ZIPs and returns a map of {hash: sequence}."""
    seq_map = {}
    print("Crawling folders and ZIPs for original sequences...")
    for sdir in SEARCH_DIRS:
        if not os.path.exists(sdir): continue
        for root, _, files in os.walk(sdir):
            for f in files:
                fpath = os.path.join(root, f)
                if f.lower().endswith(('.fasta', '.fa', '.fna', '.fastq', '.fq')):
                    try:
                        with open(fpath, 'r') as file:
                            h, s = process_file_content(file.read())
                            if h: seq_map[h] = s
                    except: pass
                elif f.lower().endswith('.zip'):
                    try:
                        with zipfile.ZipFile(fpath, 'r') as z:
                            for zname in z.namelist():
                                if zname.lower().endswith(('.fasta', '.fa', '.fna', '.fastq', '.fq')):
                                    h, s = process_file_content(z.read(zname).decode('utf-8'))
                                    if h: seq_map[h] = s
                    except: pass
    print(f"Total unique sequences recovered: {len(seq_map)}")
    return seq_map

def reprocess_all():
    print("Starting DUAL IDENTITY reprocessing...")
    seq_map = find_sequences()
    
    response = es_client.search(index=ELASTICSEARCH_INDEX, query={"match_all": {}}, size=5000)
    hits = response['hits']['hits']
    
    updated = 0
    for hit in hits:
        source = hit['_source']
        h = source['sequence_hash']
        cid = source.get('cluster_id', 'Unknown')
        
        # 1. Label-based parameters can always be updated using existing stored metrics
        metrics = source.get('metrics', {})
        p_label = map_genome_to_face(h, metrics, cid, mode="label")
        
        doc_update = {
            "face_parameters_label": p_label.__dict__,
            "face_parameters": p_label.__dict__ # Set active to label by default for consistency
        }

        # 2. Signature-based parameters require the DNA sequence
        if h in seq_map:
            seq = seq_map[h]
            # Full re-calc of metrics to ensure intrinsic signature vectors exist
            full_metrics = compute_all_metrics(seq)
            p_sig = map_genome_to_face(h, full_metrics, cid, mode="signature")
            doc_update["face_parameters_signature"] = p_sig.__dict__
            doc_update["metrics"] = full_metrics
        
        es_client.update(index=ELASTICSEARCH_INDEX, id=h, body={"doc": doc_update})
        updated += 1
        if updated % 100 == 0: print(f"Progress: {updated}/{len(hits)}")

    es_client.indices.refresh(index=ELASTICSEARCH_INDEX)
    print(f"Migration complete. Updated {updated} records with dual identities.")

if __name__ == "__main__":
    reprocess_all()
