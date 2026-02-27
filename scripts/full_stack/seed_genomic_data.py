import os
import sys
import hashlib
from Bio import SeqIO

# Add project root to path (V-GNOME_Submission/)
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
sys.path.append(ROOT_DIR)

from backend.app.elasticsearch_client import store_genome_profile, initialize_elasticsearch
from backend.app.genomic_metrics import compute_all_metrics
from backend.app.face_generator import map_genome_to_face

# Directory containing the genomic data
DATA_DIR = os.path.join(ROOT_DIR, "data")

# Files to index
SEED_FILES = [
    os.path.join(DATA_DIR, "Sagalactiae_16S_rRNA_gene.fna"),
    os.path.join(DATA_DIR, "A909_CP000114.1 Streptococcus agalactiae A909, complete genome.fna"),
    os.path.join(DATA_DIR, "2603VR_Streptococcus agalactiae - GCF_000007265.1_ASM726v1_genomic.fna"),
    os.path.join(DATA_DIR, "NEM316_Streptococcus agalactiae - GCF_000196055.1_ASM19605v1_genomic.fna"),
    os.path.join(DATA_DIR, "Sagalactiae_23S_rRNAgene.fna"),
    os.path.join(DATA_DIR, "gene.fna"),
    os.path.join(DATA_DIR, "Sagalactiae_5S_rRNA_gene.fna")
]

def seed_data():
    print("🚀 Starting Seed Data Process...")
    
    if not initialize_elasticsearch():
        print("❌ Error: Could not connect to Elasticsearch.")
        return

    indexed_count = 0
    
    for fpath in SEED_FILES:
        if not os.path.exists(fpath):
            # Silence warning for missing optional seed files
            continue
            
        print(f"📄 Processing: {os.path.basename(fpath)}...")
        
        try:
            for record in SeqIO.parse(fpath, "fasta"):
                # Basic cleaning
                sequence = str(record.seq).upper().replace('N', '')
                if not sequence: continue
                
                # 1. Compute Metrics
                metrics = compute_all_metrics(sequence)
                
                # 2. Identify Cluster (Species) from header
                header = record.description
                parts = header.split()
                cluster_id = "Unclassified"
                if len(parts) >= 3:
                    cluster_id = f"{parts[1]} {parts[2]}"
                
                sequence_hash = hashlib.sha256(sequence.encode()).hexdigest()
                
                # 3. Generate Face Parameters
                params_sig = map_genome_to_face(sequence_hash, metrics, cluster_id, mode="signature")
                params_lab = map_genome_to_face(sequence_hash, metrics, cluster_id, mode="label")
                
                # 4. Store in Elasticsearch
                genome_profile = {
                    "name": header,
                    "sequence_hash": sequence_hash,
                    "metrics": metrics,
                    "cluster_id": cluster_id,
                    "face_parameters_signature": params_sig.__dict__,
                    "face_parameters_label": params_lab.__dict__,
                    "face_data": {
                        "genome_hash": sequence_hash,
                        "face_parameters": params_sig.__dict__,
                        "bio_features": metrics
                    }
                }
                
                store_genome_profile(genome_profile)
                indexed_count += 1
                print(f"   ✅ Indexed: {header[:50]}... [{cluster_id}]")
                
        except Exception as e:
            print(f"   ❌ Error processing {fpath}: {e}")

    print(f"\n✨ Seed process complete! Indexed {indexed_count} genomic records.")

if __name__ == "__main__":
    seed_data()
