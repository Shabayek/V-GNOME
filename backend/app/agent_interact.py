# backend/app/agent_interact.py
import re
from .elasticsearch_client import es_client, ELASTICSEARCH_INDEX, list_clusters, delete_cluster

async def process_agent_command(query: str):
    """
    Simulates an AI Agent reasoning over tools.
    """
    query = query.lower().strip()
    
    # Tool 1: NCBI Fetcher
    ncbi_match = re.search(r"fetch\s+([a-z0-9_.]+)", query)
    if ncbi_match:
        accession = ncbi_match.group(1).upper()
        return {
            "type": "action",
            "agent_thought": f"User requested data retrieval for {accession}. I will activate the NCBI Tool.",
            "tool": "NCBI_FETCHER",
            "params": {"accession": accession}
        }

    # Tool 2: Comparison Logic
    if "compare" in query:
        return {
            "type": "action",
            "agent_thought": "I will retrieve the last two processed genomes from memory and initiate a comparative morph analysis.",
            "tool": "GENOME_COMPARATOR",
            "params": {"limit": 2}
        }

    # Tool 3: Cleanup / Delete Unclassified
    if "cleanup" in query or "delete unclassified" in query:
        return {
            "type": "action",
            "agent_thought": "I will identify all genomes in system-generated or unclassified clusters and perform a bulk deletion to clean the memory index.",
            "tool": "DATABASE_CLEANUP",
            "params": {"target": "unclassified"}
        }

    # Tool 4: Cluster Management (Rename)
    rename_match = re.search(r"rename\s+(.+)\s+to\s+(.+)", query)
    if rename_match:
        old_id = rename_match.group(1).strip()
        new_id = rename_match.group(2).strip()
        return {
            "type": "action",
            "agent_thought": f"Initiating bulk update tool to rename taxonomic group '{old_id}' to '{new_id}'.",
            "tool": "CLUSTER_RENAME",
            "params": {"old_id": old_id, "new_id": new_id}
        }

    # Tool 5: Memory Inspection
    if "clusters" in query or "species" in query:
        return {
            "type": "data",
            "agent_thought": "Accessing Elasticsearch long-term memory to retrieve current taxonomic clusters.",
            "tool": "ES_SEARCH"
        }

    # Tool 6: Anomaly Detection (ES|QL)
    if re.search(r"(find|detect|check|show)\s+(anomaly|anomalies|drift|drifts)", query):
        return {
            "type": "action",
            "agent_thought": "Invoking the ES|QL Analytical Engine to identify genomic drift and taxonomic anomalies across the database.",
            "tool": "ANOMALY_DETECTOR",
            "params": {"limit": 10}
        }

    # Tool 7: Taxonomic Sanity Check
    if "sanity" in query or "variance" in query or "noise" in query:
        return {
            "type": "action",
            "agent_thought": "Analyzing cluster variance using ES|QL to identify potentially mislabeled species or noisy taxonomic groups.",
            "tool": "SANITY_CHECKER",
            "params": {"variance_threshold": 0.05}
        }

    # Tool 8: Stability Ranking
    if "stability" in query or "extremophile" in query or "rank species" in query:
        return {
            "type": "action",
            "agent_thought": "Calculating the Biological Stability Index via ES|QL EVAL to identify organisms optimized for extreme environments.",
            "tool": "STABILITY_RANKER",
            "params": {"gc_weight": 0.7}
        }

    # Tool 9: Bottleneck Detection
    if "bottleneck" in query or "entropy audit" in query:
        return {
            "type": "action",
            "agent_thought": "Auditing population entropy to detect recent evolutionary bottlenecks or repetitive genetic signatures.",
            "tool": "BOTTLENECK_DETECTOR",
            "params": {"entropy_threshold": 0.9}
        }

    # Tool 10: Clear Terminal
    if query == "clear" or query == "cls":
        return {
            "type": "action",
            "agent_thought": "Clearing all diagnostic traces and user commands from the current session.",
            "tool": "TERMINAL_CLEAR"
        }

    return {
        "type": "error",
        "agent_thought": "Command unrecognized. Valid options: 'fetch [accession]', 'compare', 'cleanup', 'rename [old] to [new]', 'find anomalies', 'check sanity', 'rank stability', 'audit bottlenecks', 'list clusters', or 'clear'."
    }
