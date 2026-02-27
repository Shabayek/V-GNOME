# backend/app/main.py
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import shutil
import os
import zipfile
import tempfile
import hashlib
from contextlib import asynccontextmanager
from Bio import Entrez, SeqIO
import io

from .face_generator import (
    genome_to_face_complete, 
    blend_face_parameters, 
    generate_svg_face, 
    FaceParameters,
    map_genome_to_face
)
from .genomic_metrics import compute_all_metrics
from .genomic_agent import generate_curation_rationale, get_agent_trace
from .elasticsearch_client import (
    initialize_elasticsearch, 
    store_genome_profile, 
    get_genome_profile,
    get_cluster_prototype_params,
    list_clusters,
    rename_cluster,
    delete_cluster,
    delete_genome,
    update_genome_cluster,
    get_cluster_genomes,
    find_closest_cluster,
    es_client,
    ELASTICSEARCH_INDEX,
    get_genus_prototype_params,
    delete_genus
)

# NCBI Configuration
Entrez.email = "dummy@vgnome.edu"

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Starting up application and initializing Elasticsearch...")
    if initialize_elasticsearch():
        print("Elasticsearch initialized successfully.")
    else:
        print("Elasticsearch initialization failed.")
    yield
    print("Shutting down application.")

app = FastAPI(lifespan=lifespan)

origins = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class GenomeSequence(BaseModel):
    sequence: str
    target_cluster: str = None
    mode: str = "signature"

class ClusterRename(BaseModel):
    old_id: str
    new_id: str

class ClusterReassign(BaseModel):
    target_cluster: str

class NCBIGenome(BaseModel):
    accession: str
    target_cluster: str = None

class NCBIBatch(BaseModel):
    accessions: list[str]
    target_cluster: str = None

class LocalPathBatch(BaseModel):
    path: str
    target_cluster: str = None
    mode: str = "signature"

def extract_info_from_header(header: str):
    content = header.strip()[1:] # remove '>'
    parts = content.split()
    if not parts: return "Unknown", "Unknown", "Unknown"
    accession = parts[0]
    if len(parts) >= 3:
        species = f"{parts[1]} {parts[2]}"
        full_desc = " ".join(parts[1:])
    elif len(parts) == 2:
        species = parts[1]; full_desc = parts[1]
    else:
        species = "Unclassified"; full_desc = accession
    return accession, species, full_desc

def process_genome_sequence(sequence: str, target_cluster_id: str = None, mode: str = "signature"):
    if not sequence or not isinstance(sequence, str):
        raise ValueError("Invalid genome sequence format.")
    
    # 1. Robust FASTA stripping
    # If pasted text contains a '>' header anywhere, we split and take the sequence part
    if '>' in sequence:
        # Split by '>' and take the last part if multiple headers are present
        # Or take the part after the first newline if it starts with '>'
        parts = sequence.split('>', 1)
        if len(parts) > 1:
            sub_parts = parts[1].split('\n', 1)
            if len(sub_parts) > 1:
                sequence = sub_parts[1]
            else:
                # If no newline, user might have pasted '>HeaderATCG...'
                # We'll try to find where the header ends (often spaces or mixed case)
                # But safer to just fail and ask for a newline
                raise ValueError("Incomplete FASTA format. Please ensure there is a newline after the '>' header line.")

    # 2. Complete whitespace and non-DNA character removal
    # We strip spaces, tabs, and all line break variants (\n, \r)
    clean_input = "".join(sequence.split()).upper()
    
    # Filter only valid DNA characters (A, T, C, G, N)
    valid_chars = set("ATCGN")
    if not all(c in valid_chars for c in clean_input):
        invalid = "".join(set(c for c in clean_input if c not in valid_chars))
        raise ValueError(f"Invalid genomic data. Found illegal characters: {invalid}")
        
    clean_sequence = clean_input.replace('N', '')
    if not clean_sequence: raise ValueError("Resulting DNA sequence is empty after cleaning.")

    metrics = compute_all_metrics(clean_sequence)
    suggested_cluster, similarity_score = find_closest_cluster(metrics)
    cluster_id = target_cluster_id if target_cluster_id else suggested_cluster

    sequence_hash = hashlib.sha256(clean_sequence.encode()).hexdigest()
    params_signature = map_genome_to_face(sequence_hash, metrics, cluster_id, mode="signature")
    params_label = map_genome_to_face(sequence_hash, metrics, cluster_id, mode="label")

    prototype_data = get_cluster_prototype_params(cluster_id)
    if prototype_data:
        p_sig_proto = FaceParameters().from_dict(prototype_data['signature'])
        params_signature = blend_face_parameters(params_signature, p_sig_proto, similarity_score)
        p_lab_proto = FaceParameters().from_dict(prototype_data['label'])
        params_label = blend_face_parameters(params_label, p_lab_proto, similarity_score)

    active_blended = params_signature if mode == "signature" else params_label
    face_data = {
        'genome_hash': sequence_hash,
        'face_parameters': active_blended.__dict__,
        'bio_features': metrics
    }

    trace = []
    trace.append(get_agent_trace("DATA_INGEST", "BioPython Processor", f"Analyzed {len(clean_sequence)} bp sequence."))
    trace.append(get_agent_trace("METRIC_COMPUTATION", "GenomicMetrics Tool", "Calculated GC, CpG, and RSCU signatures."))
    trace.append(get_agent_trace("MEMORY_RETRIEVAL", "Elasticsearch Search", "Searching for existing species prototypes..."))
    trace.append(get_agent_trace("CLASSIFICATION", "Euclidean Classifier", f"Distance to {cluster_id}: {(1.0 - similarity_score):.4f}"))
    trace.append(get_agent_trace("PHENOTYPE_MAPPING", "3D Generator Tool", "Mapped genomic signatures to physical traits."))

    rationale = generate_curation_rationale(metrics, cluster_id, 1.0 - similarity_score)

    results = {
        "face_data": {
            **face_data,
            "face_parameters_signature": params_signature.__dict__,
            "face_parameters_label": params_label.__dict__
        }, 
        "metrics": metrics, 
        "suggested_cluster": suggested_cluster,
        "current_cluster": cluster_id,
        "mode": mode,
        "agent_trace": trace,
        "agent_rationale": rationale
    }
    
    try:
        genome_profile_for_es = {
            "name": f"Genome_{face_data['genome_hash'][:8]}",
            "sequence_hash": face_data["genome_hash"],
            "face_data": face_data,
            "face_parameters_signature": params_signature.__dict__,
            "face_parameters_label": params_label.__dict__,
            "metrics": metrics,
            "cluster_id": cluster_id
        }
        store_genome_profile(genome_profile_for_es)
    except Exception as e: print(f"Failed to store: {e}")
    return results

@app.post("/generate-face/")
async def generate_face(genome: GenomeSequence):
    try: return process_genome_sequence(genome.sequence, genome.target_cluster, genome.mode)
    except ValueError as e: raise HTTPException(status_code=400, detail=str(e))

@app.post("/fetch-ncbi/")
async def fetch_ncbi(data: NCBIGenome):
    try:
        handle = Entrez.efetch(db="nucleotide", id=data.accession, rettype="fasta", retmode="text")
        fasta_str = handle.read()
        handle.close()
        if not fasta_str: raise HTTPException(status_code=404, detail="NCBI Accession not found")
        
        first_line = fasta_str.splitlines()[0]
        acc, species, full_desc = extract_info_from_header(first_line)
        sequence = "".join(fasta_str.splitlines()[1:])
        
        target = data.target_cluster if data.target_cluster else species
        res = process_genome_sequence(sequence, target)
        
        es_client.update(
            index=ELASTICSEARCH_INDEX, id=res["face_data"]["genome_hash"],
            body={"doc": {"name": f"{acc} - {full_desc}"}}, refresh=True
        )
        return res
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload-genome-file/")
async def upload_genome_file(file: UploadFile = File(...), target_cluster: str = Form(None)):
    try:
        # Use tempfile to avoid directory permission/existence issues
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            shutil.copyfileobj(file.file, tmp)
            temp_file_path = tmp.name

        display_name = file.filename
        suggested_cluster = target_cluster
        
        try:
            with open(temp_file_path, "r", encoding="utf-8", errors="ignore") as f:
                first_line = f.readline()
                if first_line.startswith('>'):
                    accession, species, full_desc = extract_info_from_header(first_line)
                    display_name = f"{accession} - {full_desc}"
                    if not suggested_cluster: suggested_cluster = species
                
                f.seek(0)
                # Filter out header and join lines
                lines = f.readlines()
                sequence = "".join([line.strip() for line in lines if line.strip() and not line.startswith('>')])
        finally:
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)

        if not sequence: 
            raise HTTPException(status_code=400, detail="No valid genomic sequence found in file.")
            
        res = process_genome_sequence(sequence, suggested_cluster)
        
        # Update name in ES memory
        es_client.update(
            index=ELASTICSEARCH_INDEX, 
            id=res["face_data"]["genome_hash"], 
            body={"doc": {"name": display_name}}, 
            refresh=True
        )
        return res
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"UPLOAD ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload processing failed: {str(e)}")

from fastapi.responses import HTMLResponse, StreamingResponse
import json
import asyncio

# ... (other imports)

@app.post("/upload-batch-zip/")
async def upload_batch_zip(file: UploadFile = File(...), target_cluster: str = Form(None)):
    async def generate_zip_progress():
        temp_zip_path = f"temp_{file.filename}"
        temp_dir = tempfile.mkdtemp()
        try:
            with open(temp_zip_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            with zipfile.ZipFile(temp_zip_path, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)
                
            for root, _, files in os.walk(temp_dir):
                for filename in files:
                    if filename.lower().endswith(('.fasta', '.fa', '.fna', '.fastq', '.fq')):
                        file_path = os.path.join(root, filename)
                        try:
                            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                                first_line = f.readline()
                                suggested_cluster = target_cluster
                                display_name = filename
                                if first_line.startswith('>'):
                                    acc, spec, desc = extract_info_from_header(first_line)
                                    if not suggested_cluster: suggested_cluster = spec
                                    display_name = f"{acc} - {desc}"
                                
                                f.seek(0)
                                lines = f.readlines()
                                seq_part = "".join([line.strip() for line in lines if line.strip() and not line.startswith('>')])
                                
                                if seq_part:
                                    res = process_genome_sequence(seq_part, suggested_cluster)
                                    es_client.update(index=ELASTICSEARCH_INDEX, id=res["face_data"]["genome_hash"], body={"doc": {"name": display_name}}, refresh=True)
                                    yield json.dumps({"filename": filename, "name": display_name, "status": "success"}) + "\n"
                                else:
                                    yield json.dumps({"filename": filename, "status": "error", "message": "No sequence data"}) + "\n"
                        except Exception as fe:
                            yield json.dumps({"filename": filename, "status": "error", "message": str(fe)}) + "\n"
                        await asyncio.sleep(0.01) # Small yield to event loop
        finally:
            if os.path.exists(temp_zip_path): os.remove(temp_zip_path)
            shutil.rmtree(temp_dir, ignore_errors=True)

    return StreamingResponse(generate_zip_progress(), media_type="application/x-ndjson")

@app.post("/upload-batch-path/")
async def upload_batch_path(data: LocalPathBatch):
    if not os.path.exists(data.path): raise HTTPException(status_code=400, detail="Path does not exist.")
    
    async def generate_path_progress():
        for root, dirs, files in os.walk(data.path):
            for filename in files:
                if filename.lower().endswith(('.fasta', '.fa', '.fna', '.fastq', '.fq')):
                    file_path = os.path.join(root, filename)
                    try:
                        display_name = filename
                        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                            first_line = f.readline()
                            suggested_cluster = data.target_cluster
                            sequence = ""
                            if first_line.startswith('>'):
                                accession, species, full_desc = extract_info_from_header(first_line)
                                display_name = f"{accession} - {full_desc}"
                                if not suggested_cluster: suggested_cluster = species
                                sequence = "".join([line.strip() for line in f.readlines() if line.strip() and not line.startswith('>')])
                            else:
                                f.seek(0)
                                sequence = "".join([line.strip() for line in f.readlines() if line.strip()])
                        
                        if sequence:
                            res = process_genome_sequence(sequence, suggested_cluster)
                            es_client.update(index=ELASTICSEARCH_INDEX, id=res["face_data"]["genome_hash"], body={"doc": {"name": display_name}}, refresh=True)
                            yield json.dumps({"filename": filename, "name": display_name, "status": "success"}) + "\n"
                    except Exception as e: 
                        yield json.dumps({"filename": filename, "status": "error", "message": str(e)}) + "\n"
                    await asyncio.sleep(0.01)

    return StreamingResponse(generate_path_progress(), media_type="application/x-ndjson")

@app.post("/fetch-ncbi-batch/")
async def fetch_ncbi_batch(data: NCBIBatch):
    async def generate_ncbi_progress():
        for acc in data.accessions:
            try:
                handle = Entrez.efetch(db="nucleotide", id=acc, rettype="fasta", retmode="text")
                fasta_str = handle.read()
                handle.close()
                
                if fasta_str:
                    first_line = fasta_str.splitlines()[0]
                    actual_acc, species, full_desc = extract_info_from_header(first_line)
                    sequence = "".join(fasta_str.splitlines()[1:])
                    
                    target = data.target_cluster if data.target_cluster else species
                    res = process_genome_sequence(sequence, target)
                    
                    display_name = f"{actual_acc} - {full_desc}"
                    es_client.update(
                        index=ELASTICSEARCH_INDEX, id=res["face_data"]["genome_hash"],
                        body={"doc": {"name": display_name}}, refresh=True
                    )
                    yield json.dumps({"filename": acc, "name": display_name, "status": "success"}) + "\n"
                else:
                    yield json.dumps({"filename": acc, "status": "error", "message": "Not found"}) + "\n"
            except Exception as e:
                yield json.dumps({"filename": acc, "status": "error", "message": str(e)}) + "\n"
            await asyncio.sleep(0.01)

    return StreamingResponse(generate_ncbi_progress(), media_type="application/x-ndjson")

@app.get("/clusters/")
async def get_clusters(): return list_clusters()

@app.post("/clusters/rename")
async def rename_cluster_endpoint(data: ClusterRename):
    print(f"Renaming cluster from '{data.old_id}' to '{data.new_id}'")
    if rename_cluster(data.old_id, data.new_id): 
        print("Rename successful")
        return {"status": "success"}
    print("Rename failed in ES client")
    raise HTTPException(status_code=500, detail="Failed to rename cluster")

@app.get("/ls/")
async def list_directory_contents(path: str = "/"):
    if not os.path.exists(path): path = os.path.expanduser("~")
    try:
        dirs = sorted([item for item in os.listdir(path) if os.path.isdir(os.path.join(path, item))])
        return {"current_path": os.path.abspath(path), "parent_path": os.path.abspath(os.path.join(path, "..")), "directories": dirs}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.get("/clusters/{cluster_id}/genomes")
async def get_cluster_genomes_endpoint(cluster_id: str): return get_cluster_genomes(cluster_id)

@app.get("/genome/{sequence_hash}/classification-candidates")
async def get_classification_candidates(sequence_hash: str):
    print(f"Fetching candidates for: {sequence_hash}")
    profile = get_genome_profile(sequence_hash)
    if not profile: 
        print(f"Genome {sequence_hash} NOT FOUND in ES")
        raise HTTPException(status_code=404, detail="Genome not found")
    
    metrics = profile.get("metrics", {})
    new_gc = metrics.get('gc_content', 0.5)
    new_cpg = metrics.get('cpg_odds', 0.5)
    new_ent = metrics.get('signature_entropy', 0.5)
    new_rob = metrics.get('coding_robustness', 0.0)
    new_skw = metrics.get('gc_skew', 0.5)
    new_hyd = metrics.get('hydrophobic_ratio', 0.5)
    new_pur = metrics.get('purine_ratio', 0.5)
    
    clusters = list_clusters()
    candidates = []
    
    current_cluster = profile.get("cluster_id")

    for cid in clusters:
        # Filter out system clusters, but ALWAYS KEEP the current cluster for comparison
        is_system = cid.lower() == "unclassified" or cid.lower() == "unknown" or cid.startswith("cluster_")
        if is_system and cid != current_cluster:
            continue
            
        proto = get_cluster_prototype_params(cid)
        if proto and 'signature' in proto:
            p = proto['signature']
            # 7D distance calculation with safety defaults
            proto_gc  = p.get('face_width', 0.5)
            proto_cpg = (p.get('face_height', 0.5) * 2.0) - 0.5
            proto_ent = p.get('eye_size', 0.5)
            proto_rob = p.get('armor_plating', 0.0)
            proto_skw = p.get('jaw_shape', 0.5)
            proto_hyd = p.get('glow_intensity', 0.5)
            proto_pur = p.get('mouth_width', 0.5)
            
            dist = (
                (new_gc - proto_gc)**2 + 
                (new_cpg - proto_cpg)**2 + 
                (new_ent - proto_ent)**2 +
                (new_rob - proto_rob)**2 +
                (new_skw - proto_skw)**2 +
                (new_hyd - proto_hyd)**2 +
                (new_pur - proto_pur)**2
            )**0.5
            
            candidates.append({
                "cluster_id": cid,
                "distance": dist,
                "coords": [proto_gc, proto_cpg, proto_ent],
                "is_current": cid == current_cluster
            })
    
    candidates.sort(key=lambda x: x["distance"])
    print(f"Found {len(candidates)} candidates")
    
    return {
        "target": {
            "hash": sequence_hash,
            "coords": [new_gc, new_cpg, new_ent],
            "name": profile.get("name")
        },
        "candidates": candidates[:5],
        "recommended": candidates[0]["cluster_id"] if candidates else "New Species"
    }

@app.get("/genome/{sequence_hash}")
async def get_genome(sequence_hash: str):
    print(f"Fetching generic profile for: {sequence_hash}")
    profile = get_genome_profile(sequence_hash)
    if profile: return profile
    raise HTTPException(status_code=404, detail="Genome not found")

@app.post("/genome/{sequence_hash}/reassign")
async def reassign_genome(sequence_hash: str, data: ClusterReassign):
    profile = get_genome_profile(sequence_hash)
    if not profile: raise HTTPException(status_code=404, detail="Genome not found")
    
    old_species = profile.get("cluster_id", "Unknown")
    old_name = profile.get("name", "Unnamed")
    
    # Only append if not already appended to avoid infinite string growth
    new_name = old_name
    suffix = f"_classified_{old_species}"
    if suffix not in old_name:
        new_name = f"{old_name}{suffix}"
    
    try:
        es_client.update(
            index=ELASTICSEARCH_INDEX, id=sequence_hash,
            body={"doc": {"cluster_id": data.target_cluster, "name": new_name}},
            refresh=True
        )
        return {"status": "success", "new_name": new_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/genus/{genus_name}/prototype")
async def get_genus_prototype(genus_name: str):
    params = get_genus_prototype_params(genus_name)
    if params: return params
    raise HTTPException(status_code=404, detail="Genus not found")

@app.delete("/genus/{genus_name}")
async def delete_genus_endpoint(genus_name: str):
    if delete_genus(genus_name): return {"status": "success"}
    raise HTTPException(status_code=500, detail="Failed to delete genus")

@app.delete("/clusters/{cluster_id}")
async def delete_cluster_endpoint(cluster_id: str):
    if delete_cluster(cluster_id): return {"status": "success"}
    raise HTTPException(status_code=500, detail="Failed to delete cluster")

@app.delete("/genome/{sequence_hash}")
async def delete_genome_endpoint(sequence_hash: str):
    if delete_genome(sequence_hash): return {"status": "success"}
    raise HTTPException(status_code=500, detail="Failed to delete genome")

@app.get("/all-metrics/")
async def get_all_metrics():
    """Returns essential metrics for all documents for 3D plot."""
    try:
        # Sort by upload_date ascending so the newest are at the end of the list
        response = es_client.search(
            index=ELASTICSEARCH_INDEX, 
            query={"match_all": {}}, 
            size=10000, 
            sort=[{"upload_date": {"order": "asc"}}],
            _source=["sequence_hash", "name", "cluster_id", "metrics.gc_content", "metrics.gc_skew", "metrics.coding_robustness"]
        )
        
        cleaned_hits = []
        for hit in response["hits"]["hits"]:
            source = hit["_source"]
            m = source.get("metrics", {})
            # Ensure all coordinate metrics have at least a default float value
            source["metrics"] = {
                "gc_content": m.get("gc_content", 0.5),
                "gc_skew": m.get("gc_skew", 0.5),
                "coding_robustness": m.get("coding_robustness", 0.0)
            }
            cleaned_hits.append(source)
            
        return cleaned_hits
    except Exception as e: 
        print(f"Error in all-metrics: {e}")
        return []

class AgentCommand(BaseModel):
    query: str

class ChatCommand(BaseModel):
    query: str
    api_key: str

class RawQueryCommand(BaseModel):
    query: str

@app.post("/agent/query")
async def execute_raw_query(command: RawQueryCommand):
    """Executes a raw ES|QL query from the UI."""
    try:
        res = es_client.esql.query(query=command.query)
        return {
            "columns": [col['name'] for col in res['columns']],
            "rows": res['values']
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/agent/chat")
async def agent_chat(command: ChatCommand):
    from .genomic_rag import run_genomic_rag
    try:
        return run_genomic_rag(command.query, command.api_key)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/agent/anomalies")
async def get_anomalies(limit: int = 10):
    """Executes ES|QL to find genomic drift anomalies."""
    query = f"""
    FROM genomic_profiles
    | STATS 
        min_gc = MIN(metrics.gc_content), 
        max_gc = MAX(metrics.gc_content), 
        avg_gc = AVG(metrics.gc_content),
        count = COUNT(*)
      BY cluster_id
    | EVAL drift = max_gc - min_gc
    | SORT drift DESC
    | LIMIT {limit}
    """
    try:
        res = es_client.esql.query(query=query)
        columns = [col['name'] for col in res['columns']]
        rows = res['values'][:limit]
        return {"columns": columns, "rows": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/agent/sanity-check")
async def get_sanity_check(variance_threshold: float = 0.05, min_count: int = 3, limit: int = 10):
    """Finds species clusters that are too diverse using manual variance calculation."""
    # Variance = E[X^2] - (E[X])^2
    query = f"""
    FROM genomic_profiles
    | EVAL gc_sq = metrics.gc_content * metrics.gc_content
    | STATS 
        avg_gc = AVG(metrics.gc_content),
        avg_gc_sq = AVG(gc_sq),
        count = COUNT(*) 
      BY cluster_id
    | EVAL variance = avg_gc_sq - (avg_gc * avg_gc)
    | SORT variance DESC
    | LIMIT {limit}
    """
    try:
        res = es_client.esql.query(query=query)
        return {"columns": [c['name'] for c in res['columns']], "rows": res['values']}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/agent/stability-rank")
async def get_stability_rank(gc_weight: float = 0.7, limit: int = 10):
    """Ranks species by environmental stability (GC + Robustness)."""
    robust_weight = 1.0 - gc_weight
    query = f"""
    FROM genomic_profiles
    | EVAL stability_index = (metrics.gc_content * {gc_weight}) + (metrics.coding_robustness * {robust_weight})
    | STATS avg_stability = AVG(stability_index), genome_count = COUNT(*) BY cluster_id
    | SORT avg_stability DESC
    | LIMIT {limit}
    """
    try:
        res = es_client.esql.query(query=query)
        return {"columns": [c['name'] for c in res['columns']], "rows": res['values']}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/agent/bottleneck-detect")
async def get_bottleneck_detect(entropy_threshold: float = 0.9, limit: int = 10):
    """Detects species with unusually low information density (Population Bottlenecks)."""
    query = f"""
    FROM genomic_profiles
    | STATS avg_entropy = AVG(metrics.signature_entropy) BY cluster_id
    | WHERE avg_entropy <= {entropy_threshold}
    | SORT avg_entropy ASC
    | LIMIT {limit}
    """
    try:
        res = es_client.esql.query(query=query)
        return {"columns": [c['name'] for c in res['columns']], "rows": res['values']}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/agent/interact")
async def agent_interact(command: AgentCommand):
    from .agent_interact import process_agent_command
    return await process_agent_command(command.query)

@app.get("/", response_class=HTMLResponse)
async def read_root():
    return """<html><head><title>V-GNOME API</title></head><body><h1>Welcome to V-GNOME API</h1><p>Use the /docs endpoint to see the API documentation.</p></body></html>"""
