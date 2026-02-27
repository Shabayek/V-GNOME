from openai import OpenAI
from .elasticsearch_client import es_client, ELASTICSEARCH_INDEX

def run_genomic_rag(query: str, api_key: str):
    """
    Implements a Hybrid RAG pattern for the V-GNOME database.
    Combines keyword search with a representative sample of the DB to allow 
    the LLM to answer complex/comparative questions.
    """
    client = OpenAI(api_key=api_key)

    # 1. TEXT SEARCH (Specifics)
    # Only search text/keyword fields to prevent numeric parsing errors
    text_results = es_client.search(
        index=ELASTICSEARCH_INDEX,
        query={
            "multi_match": {
                "query": query,
                "fields": ["name", "cluster_id"],
                "type": "best_fields",
                "fuzziness": "AUTO"
            }
        },
        size=10
    )

    # 2. GLOBAL SAMPLE (Representative data for LLM to crunch)
    # We pull a sample of genomes sorted by GC content to give the LLM a cross-section of the DB
    sample_results = es_client.search(
        index=ELASTICSEARCH_INDEX,
        query={"match_all": {}},
        sort=[{"metrics.gc_content": {"order": "desc"}}],
        size=20
    )

    # 3. MERGE HITS
    # Combine results and deduplicate by sequence_hash
    seen_hashes = set()
    combined_hits = []
    
    for hit in (text_results["hits"]["hits"] + sample_results["hits"]["hits"]):
        h = hit["_source"]["sequence_hash"]
        if h not in seen_hashes:
            combined_hits.append(hit)
            seen_hashes.add(h)

    # 4. CONTEXT CONSTRUCTION
    context_parts = []
    for hit in combined_hits:
        s = hit["_source"]
        m = s.get("metrics", {})
        context_parts.append(
            f"Genome: {s['name']}\n"
            f"Cluster: {s['cluster_id']}\n"
            f"Key Metrics: GC={m.get('gc_content')}, CpG={m.get('cpg_odds')}, Robustness={m.get('coding_robustness')}\n"
            f"---"
        )
    
    context = "\n".join(context_parts)

    # 5. LLM PROMPT
    system_prompt = f"""
    You are the V-GNOME AI Assistant, a specialist in genomic curation and biometric mapping.
    
    Below is a cross-section of data from our Elasticsearch database. 
    Use this context to answer the user's question. 
    If the user asks for 'highest' or 'lowest' values, look at the provided samples. 
    If the context doesn't have the specific answer, explain that based on the provided sample, you can make a partial observation.

    CONTEXT FROM DATABASE:
    {context}
    """

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": query}
            ]
        )
        return {
            "answer": response.choices[0].message.content,
            "sources": list(set([hit["_source"]["name"] for hit in combined_hits]))
        }
    except Exception as e:
        if "insufficient_quota" in str(e):
            return {
                "answer": "❌ OPENAI ERROR: Your API key has exceeded its quota or has no credits left. Please check your billing at platform.openai.com.",
                "sources": []
            }
        raise e
