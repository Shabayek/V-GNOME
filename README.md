# V-GNOME: Biometric Genomic Curation Agent
### 🧬 Visual Genomic Evolution & Morphing Engine

**V-GNOME** is an autonomous genomic curation agent built for the **Elasticsearch Agent Builder Hackathon 2026**. It bridges the gap between raw bioinformatics and interactive visual identity by mapping complex DNA signatures to 3D biometric "faces."

---

## 🚀 Quick Start (Installation & Setup)

### 1. Prerequisites
- **Python 3.10+**
- **Node.js 18+**
- **Elasticsearch 8.12.2** (Required for the core application)
- **Kibana 8.12.2** (Optional: Only for interactive dashboards/Canvas)
- **OpenAI API Key** (Optional: Only required for the **Genomic AI Expert (RAG Chat)** feature.)

### 2. Service Orchestration
The project includes several automation scripts to manage the environment. 

**Note:** These scripts assume that your Elasticsearch and Kibana binaries are located in a `vendor/` folder in the project root (e.g., `vendor/elasticsearch-8.12.2/bin/elasticsearch`). If your installation is elsewhere, please update the paths in the scripts.

#### ⚡ Option A: Core Application (Elasticsearch + Backend)
Use this workflow if you only want the main V-GNOME dashboard.
```bash
# Start Elasticsearch and the FastAPI backend
./scripts/core/run.sh
```

#### 📊 Option B: Full Visualization Suite (Search + Kibana Dashboards)
Use this workflow if you want the pre-built Kibana dashboards and the Canvas view.
```bash
# Start services, seed data, and import all Kibana assets
./scripts/full_stack/setup_master.sh
```

### 3. Start the Frontend
In a separate terminal, launch the React/Vite dashboard:
```bash
cd frontend
npm install
npm run dev
```

Visit: **http://localhost:5173**

---

## 🏗️ Core Architecture & Data Logic

### 🧠 Elasticsearch as Genomic Memory
V-GNOME stores comprehensive genomic profiles in Elasticsearch. Every ingested sequence is transformed into a set of facial parameters.

- **7D Biometric Distance**: The system uses **7 specific biometric dimensions** to calculate Euclidean distance between genomes for classification and anomaly detection.
- **3D Genomic Galaxy**: The spatial mapping in the 3D viewer is driven by **3 primary parameters** (GC Content, Coding Robustness, and GC Skew).
- **Kibana Integration**: While the V-GNOME UI is standalone, Kibana can be used for advanced Canvas visualizations and deep statistical audits via ES|QL.

---

## 📜 License
This project is licensed under the **Apache License 2.0** - see the [LICENSE](LICENSE) file for details.

---

## 👨‍🔬 Author
**Dr. Abd El Rahman Shabayek**
[ORCID: 0000-0001-8730-3765](https://orcid.org/0000-0001-8730-3765)
