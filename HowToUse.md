# How to Use: V-GNOME Biometric Genomic Curation Agent
### Visual Genomic Evolution & Morphing Engine

A Comprehensive Guide for Navigating the 3D Biometric Space.

---

## 🛠️ 0. Automation & Orchestration
The project includes a tidy `scripts/` directory to manage the backend and database services.

### ⚡ Core Scripts (`scripts/core/`)
- **`run.sh`**: The primary entry point. It verifies/starts Elasticsearch and then launches the FastAPI backend.
- **`run_elasticsearch_only.sh`**: Use this if you only need the search engine without the web backend.

### 📊 Full Stack Scripts (`scripts/full_stack/`)
- **`setup_master.sh`**: One-click setup for the full experience. It starts all services, seeds the database from local `.fna` files, and imports Kibana dashboards.
- **`run_search_and_kibana.sh`**: Starts both Elasticsearch and Kibana in the background.
- **`import_kibana_assets.sh`**: Manually import the visualizations and dashboards into a running Kibana instance.
- **`seed_genomic_data.py`**: A standalone tool to index the provided Streptococcus reference genomes.

---

## 📂 1. Active Clusters (Taxonomic Memory)
This panel organizes and curates your private genomic database stored in Elasticsearch.

- **Tree Navigation:** Expand the Genus/Species folders to see individual genomes.
- **Search:** Use the **"Genus/Species"** or **"Genomes"** search boxes to live-filter the database.
- **Actions:**
  - **Rename:** Update taxonomies directly in the Elasticsearch index.
  - **Re-classify:** Use the AI-suggested Euclidean Biometric Distance to move a genome to a more mathematically appropriate cluster.
  - **Delete:** Remove specific genomes or entire genera from the database.
  - **Species/Genus Avg:** Fetch the "ancestral prototype" parameters based on the average metrics of all members.

## 🧪 2. Comparative Morph Overlay (Phylogenetic Blending)
Visualize the evolutionary distance between two unique genomic identities in real-time.

- **Adding Subjects:** Click **"+ Compare"** on any two genomes in the tree or galaxy.
- **Morph Slider:** Move the **"Morph Balance"** slider to blend their 3D phenotypes (faces).
- **Metric HUD:** View their DNA metrics (GC Content, Skew, Coding Robustness) side-by-side to understand the mathematical drivers of their divergence.

## 🌌 3. 3D Genomic Galaxy (Biometric Discovery)
Explore the entire database in a spatial map based on mathematical DNA similarity (Euclidean 7D Space).

- **Navigation:** Left-click to rotate, right-click to pan, and scroll to zoom.
- **Genome Navigator:** Use the dedicated tree beside the galaxy for rapid jumping between species.
- **Selection:** Click a star to view its 3D profile. Pulsing stars indicate your active selection.
- **HUD (Feature Mapping):** Toggle the **"Explain"** HUD to see the live mapping of DNA metrics to visual facial features.
- **Spatial Logic:**
  - **X-Axis:** GC Content (Nulceotide Composition)
  - **Y-Axis:** Coding Robustness (Translation Efficiency)
  - **Z-Axis:** GC Skew (Structural Replication Asymmetry)

## 📥 4. Ingestion Panels (Data Entry)
Stream genomic data from various sources into the V-GNOME ecosystem.

- **Option A (Remote NCBI Stream):** Paste NCBI accessions (e.g., `CP000114.1, NC_000913.3`) to fetch and process them directly from the cloud.
- **Option B (Local File Upload):** Upload FASTA or FNA files from your computer.
- **Option C (Direct Sequence Paste):** Paste a raw DNA sequence for immediate analysis.
- **Option D (Batch Folder Ingest):** Provide a local path to a folder of FASTA files for high-speed, autonomous ingestion.

## 📊 5. Advanced Genomic Inspection (ES|QL)
Perform deep statistical audits across the entire database using **Elasticsearch Query Language**.

- **Drift Detection:** Find species with high internal variance in GC content (indicates potential naming errors).
- **Taxonomic Sanity:** Identify noisy clusters based on Standard Deviation.
- **Stability Index:** Rank organisms by environmental robustness.
- **Bottleneck Audit:** Detect low-entropy population signatures indicating historical genetic bottlenecks.
- **Raw Sandbox:** Write and execute your own custom ES|QL queries to audit the database.

## ✨ 6. Genomic AI Expert (RAG Chat)
A **Retrieval-Augmented Generation (RAG)** agent that is contextually aware of your private database.

- **OpenAI API Key Required:** Open the left drawer and enter your key. This is required only for this specific chat interface.
- **Usage:** Ask natural language questions like:
  - *"Compare the GC content of Streptococcus strains in my database."*
  - *"Find the most robust genome I have indexed."*
  - *"Explain why CP000114.1 is classified as an outlier."*
- **Source Transparency:** The agent will provide sources (Genomic Hashes) for its claims directly from your Elasticsearch index.

## 🤖 7. Agent Command Interface (Orchestrator)
Interact with the autonomous Genomic Curation Agent using shortcut commands. **No API key required** for core orchestration.

- **Fetch:** `fetch [accession]` - Triggers NCBI retrieval.
- **Anomalies:** `find anomalies` - Runs the ES|QL drift detection suite.
- **Cleanup:** `clear` - Wipes the transient session data.
- **Rank:** `rank stability` - Lists the top 10 most optimized genomes.
