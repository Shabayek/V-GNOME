# Kibana Integration Guide: V-GNOME Genomic Curation Agent

This guide explains how to connect the V-GNOME engine to **Elasticsearch Agent Builder** and how to visualize your genomic data using **Kibana Dashboards**.

---

## 1. Setting up the Agent Builder
To transform V-GNOME into a fully autonomous agent within the Elastic ecosystem:

1.  **Open Kibana**: Navigate to `http://localhost:5601`.
2.  **Go to Agent Builder**: In the main menu, find the **AI Assistant** or **Agent Builder** section.
3.  **Create New Agent**:
    *   **Name**: `Genomic Curation Expert`
    *   **Description**: `Specialized agent for fetching NCBI data, calculating evolutionary distances, and organizing genomic species clusters.`
4.  **Register Tools**:
    *   Click **Add Tool** and select **OpenAPI**.
    *   Upload the `OPENAPI.json` file located in your project root.
    *   Point the Base URL to your running FastAPI server: `http://localhost:8000`.
5.  **System Prompt**:
    *   Use this prompt: *"You are a Genomic Curation Expert. Your goal is to fetch DNA from NCBI using the fetch_ncbi tool, analyze the biometric coordinates, and use the reassign_genome tool to organize them into correct species clusters based on their Euclidean distance."*

---

## 2. Visualizing Genomic Identity in Kibana
Since V-GNOME indexes every genome into the `genomic_profiles` index, you can use Kibana to build high-level analytics:

### A. The "Evolutionary Heatmap" (Kibana Lens)
*   **X-Axis**: `metrics.gc_content`
*   **Y-Axis**: `metrics.cpg_odds`
*   **Color**: `cluster_id`
*   **Insight**: This recreates the 2D version of your 3D Galaxy, showing exactly where taxonomic groups congregate.

### B. Speciation Drift (Bar Chart)
*   **Metric**: `Average of metrics.coding_robustness`
*   **Breakdown**: `cluster_id`
*   **Insight**: Instantly see which species have "armored" their genetic code (high RSCU variance) vs. those with standard coding strategies.

### C. Agent Activity Log
*   Use **Discover** to filter for documents containing `_classified_`.
*   **Insight**: This demonstrates the "Measurable Impact" track—showing how many genomes the agent has successfully curated and moved from "Unclassified" to their proper species group.

---

## 3. Advanced: Using ES|QL for Curation
You can run this query in the **Kibana Dev Tools** to find "Anomalous Phenotypes" (genomes that might need re-classification):

```esql
FROM genomic_profiles
| STATS avg_gc = AVG(metrics.gc_content) BY cluster_id
| ENRICH species_prototypes ON cluster_id
| WHERE metrics.gc_content > (avg_gc + 0.1)
| KEEP name, cluster_id, metrics.gc_content
```

---
