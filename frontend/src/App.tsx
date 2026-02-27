// frontend/src/App.tsx
import React, { useState, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import * as ss from 'simple-statistics';
import * as THREE from 'three';
import { Face3D } from './components/Face3D';
import { AIAssistant } from './components/AIAssistant';
import { AdvancedInspectionPanel } from './components/AdvancedInspectionPanel';
import './App.css';

// --- Interfaces ---
interface FaceData {
  genome_hash: string;
  face_parameters: any;
  svg: string;
  face_parameters_signature?: any;
  face_parameters_label?: any;
}
interface Metrics { 
  codon_frequency: { [key: string]: number };
  rscu: { [key: string]: number };
  [key: string]: any;
}
interface GenomeResponse {
  face_data: FaceData;
  metrics: Metrics;
  filename?: string;
  suggested_cluster: string;
  current_cluster: string;
  mode: string;
  agent_trace?: any[];
  agent_rationale?: string[];
}

// ... (constants remain unchanged)
const PARAM_GROUPS = [
  { label: "Genus Level Traits (Family Identity)", params: ["skin_tone_hue", "skin_tone_saturation", "ear_identity_color"] },
  { label: "Species Level Traits (Structural Anchors)", params: ["face_shape_type", "antenna_type", "forehead_pattern"] },
  { label: "Functional Traits (Genomic State)", params: ["armor_plating", "glow_intensity"] },
  { label: "Individual Level Traits (Biometric Unique)", params: ["face_width", "face_height", "jaw_shape", "eye_size", "eye_spacing", "eye_color_hue", "mouth_width", "mouth_curve", "antenna_length", "nose_size_asymmetry"] }
];

const paramExplanations: { [key: string]: { short: string, long: string } } = {
  skin_tone_hue: { 
    short: "Genus Identity or DNA Signature (RSCU).", 
    long: "In Label Mode, the hue is mathematically locked to the Genus name string, ensuring taxonomic consistency. In Signature Mode, it is derived from the Relative Synonymous Codon Usage (RSCU) bias, representing the unique 'genomic dialect' of the organism." 
  },
  skin_tone_saturation: { 
    short: "Genomic Complexity (Entropy).", 
    long: "Driven by Shannon Entropy of the k-mer distribution. Highly complex genomes with diverse nucleotide patterns appear more vibrant, while repetitive or 'simple' DNA results in more muted tones." 
  },
  ear_identity_color: {
    short: "Linked to Genus/Identity.",
    long: "The coloration of the ears is derived from the primary skin tone metrics, providing a consistent structural identity across the taxonomic family."
  },
  face_shape_type: { 
    short: "Species Anchor or CpG Odds.", 
    long: "In Label Mode, this determines a stable head shape for the Species. In Signature Mode, it uses CpG Dinucleotide Odds—a powerful evolutionary signal reflecting selection pressures and structural archetypes." 
  },
  antenna_type: { 
    short: "Taxonomic Marker or GC Skew.", 
    long: "In Label Mode, a discrete sensor type is assigned via Species hash. In Signature Mode, it is derived from GC Skew (strand asymmetry), acting as a biometric marker for the organism's replication profile." 
  },
  forehead_pattern: { 
    short: "Lineage Pattern (Forehead Crest).", 
    long: "In Label Mode, patterns are fixed to the Species identity. In Signature Mode, they are generated from a high-entropy biometric hash of all DNA signals, creating a unique visual 'crest' on the forehead." 
  },
  armor_plating: { 
    short: "Coding Robustness (RSCU Variance).", 
    long: "Metallic armor plates appear on genomes with high Coding Robustness. This represents the intensity of specialized codon usage strategies, effectively 'armoring' the genetic code against synonymous mutations." 
  },
  glow_intensity: { 
    short: "Hydrophobic Density.", 
    long: "The brightness of the iris and sensors is driven by the Hydrophobic Ratio. Higher density of structural bases results in a more intense emissive glow, symbolizing metabolic and structural intensity." 
  },
  face_width: { 
    short: "Head Width (GC Content).", 
    long: "A Biometric Constant measuring the percentage of Guanine and Cytosine. High GC content expands the lateral scale of the phenotype, providing a 'sturdier' facial foundation." 
  },
  face_height: { 
    short: "Head Height (CpG Odds).", 
    long: "A Biometric Constant where the vertical scale of the face reflects the density of CpG sites, capturing the global footprint of evolutionary selection signatures." 
  },
  jaw_shape: { 
    short: "GC Skew: Structural Curvature.", 
    long: "A Biometric Constant derived from strand-specific nucleotide bias. This 'mechanical' signal drives the curvature of the jawline, often tied to the replication origin of the genome." 
  },
  eye_size: { 
    short: "Signature Entropy: Sensor Scale.", 
    long: "A Biometric Constant mapping genomic randomness to the scale of the eyes. Organisms with higher information density develop larger, more complex visual sensors." 
  },
  eye_spacing: { 
    short: "Genome Hash: Unique Placement.", 
    long: "A Biometric Constant derived from the SHA-256 digital fingerprint, ensuring that even close strains have unique orbital proportions." 
  },
  eye_color_hue: { 
    short: "Genome Hash: The Genomic 'Soul'.", 
    long: "The core individual identity. Tied directly to the sequence's unique digital fingerprint, this glowing iris color allows for instant recognition of the same sequence across any view." 
  },
  mouth_width: { 
    short: "GC Middle: Centric Ratios.", 
    long: "A Biometric Constant derived from the GC content of the middle section of the sequence, mapping centric genomic ratios to the width of the mouth." 
  },
  mouth_curve: { 
    short: "Genome Hash: Unique Expression.", 
    long: "The 'smile' or 'frown' is an individual character trait derived from the digital fingerprint, giving each genome a unique visual personality." 
  },
  antenna_length: { 
    short: "Skew Magnitude: Signal Intensity.", 
    long: "A Biometric Constant where the length of the sensors reflects the overall intensity of the strand-specific nucleotide bias (GC Skew)." 
  },
  nose_size_asymmetry: { 
    short: "Nose Size & Asymmetry.", 
    long: "A Biometric Constant that introduces subtle 3D deviations and nose scaling based on individual sequence nuances, ensuring no two phenotypes are perfectly identical." 
  }
};

const getStableColor = (str: string, seed: number = 0) => {
  let hash = seed;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  const s = 65 + Math.abs((hash >> 8) % 35);
  const l = 45 + Math.abs((hash >> 16) % 25);
  return `hsl(${h}, ${s}%, ${l}%)`;
};

const getGenusFromCluster = (cid: string) => cid.split(' ')[0] || 'Unknown';

// --- Galaxy Components ---
const GalaxyStar: React.FC<{ 
  data: any; 
  isSelected: boolean; 
  onClick: () => void;
  genusColor: string;
  speciesColor: string;
}> = ({ data, isSelected, onClick, genusColor, speciesColor }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const pos: [number, number, number] = [
    ((data.metrics?.gc_content || 0.5) - 0.5) * 10, 
    ((data.metrics?.coding_robustness || 0.0) - 0.0) * 10, 
    ((data.metrics?.gc_skew || 0.5) - 0.5) * 10
  ];

  useFrame((state) => {
    if (isSelected && meshRef.current) {
      const glow = (Math.sin(state.clock.elapsedTime * 4) + 1) / 2; // Pulse 0 to 1
      (meshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.5 + glow * 4;
    }
  });

  return (
    <group position={pos} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial 
          color={genusColor} 
          emissive={genusColor} 
          emissiveIntensity={isSelected ? 4 : 1.2} 
        />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.3, 8]} />
        <meshStandardMaterial color={speciesColor} />
      </mesh>
      <mesh position={[0, 0.45, 0]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial 
          color={speciesColor} 
          emissive={speciesColor} 
          emissiveIntensity={isSelected ? 3 : 1.5} 
        />
      </mesh>
    </group>
  );
};

// --- How to Use Component ---
const HowToUse: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className={`how-to-use-floating ${isOpen ? 'open' : ''}`}>
      <div className="terminal-header clickable" onClick={() => setIsOpen(!isOpen)}>
        📖 SYSTEM DOCUMENTATION {isOpen ? '[-]' : '[+]'}
      </div>
      {isOpen && (
        <div className="terminal-body help-content">
          <div className="help-section">
            <h6>📂 1. Active Clusters (Taxonomic Memory)</h6>
            <p><strong>Purpose:</strong> Organize and curate your private genomic database stored in Elasticsearch.</p>
            <p><strong>Usage:</strong> Click Genus/Species to expand the tree. Use <strong>'Rename'</strong> to update groups, <strong>'Re-classify'</strong> to move genomes to new clusters, and <strong>'Genus/Species Avg'</strong> to view the ancestral prototype.</p>
          </div>
          <div className="help-section">
            <h6>🧪 2. Comparative Morph Overlay (Phylogenetic Blending)</h6>
            <p><strong>Purpose:</strong> Visualize the evolutionary distance between two unique genomic identities.</p>
            <p><strong>Usage:</strong> Click <strong>'+ Compare'</strong> on any two genomes. Use the <strong>'Morph Balance'</strong> slider to blend their 3D phenotypes and view their genomic metrics side-by-side.</p>
          </div>
          <div className="help-section">
            <h6>🌌 3. 3D Genomic Galaxy (Biometric Discovery)</h6>
            <p><strong>Purpose:</strong> Explore the entire database in a spatial map based on mathematical DNA similarity.</p>
            <p><strong>Usage:</strong> Rotate and zoom to find clusters. Pulsing stars indicate selection. Use the <strong>'Genome Navigator'</strong> tree beside it for rapid jumping between species. Toggle <strong>'Explain'</strong> to activate the feature-mapping HUD.</p>
          </div>
          <div className="help-section">
            <h6>📥 4. Ingestion Panels (Data Entry)</h6>
            <p><strong>Purpose:</strong> Stream genomic data from the NCBI cloud or local files into the V-Gnome ecosystem.</p>
            <p><strong>Usage:</strong> Use <strong>'Single Input'</strong> for sequences/accessions, <strong>'Upload'</strong> for FASTA files, or <strong>'Batch Ingest'</strong> to process entire local directories or zip archives autonomously.</p>
          </div>
          <div className="help-section">
            <h6>📊 5. Advanced Genomic Inspection (ES|QL)</h6>
            <p><strong>Purpose:</strong> Perform deep statistical audits across the entire database using the Elasticsearch Query Language.</p>
            <p><strong>Usage:</strong> 
              <ul>
                <li><strong>Drift Detection:</strong> Find species with high internal GC variance.</li>
                <li><strong>Taxonomic Sanity:</strong> Identify noisy clusters using Standard Deviation.</li>
                <li><strong>Stability Index:</strong> Rank organisms by environmental robustness.</li>
                <li><strong>Bottleneck Audit:</strong> Detect low-entropy population signatures.</li>
                <li><strong>Investigate:</strong> Run custom raw ES|QL commands in the sandbox.</li>
              </ul>
            </p>
          </div>
          <div className="help-section">
            <h6>✨ 6. Genomic AI Expert (RAG Chat)</h6>
            <p><strong>Purpose:</strong> A Retrieval-Augmented Generation agent that knows your private database.</p>
            <p><strong>Usage:</strong> Open the left drawer, enter your OpenAI API key, and ask complex natural language questions. The AI will search your Elasticsearch index to provide context-aware answers about your genomes.</p>
          </div>
          <div className="help-section">
            <h6>🤖 7. Agent Command Interface (Orchestrator)</h6>
            <p><strong>Purpose:</strong> Interact with the autonomous Genomic Curation Agent using natural language.</p>
            <p><strong>Usage Examples:</strong>
              <ul className="help-command-list">
                <li><code>'fetch NC_000913'</code>: Activates the NCBI Retrieval tool.</li>
                <li><code>'compare'</code>: Compares the last 2 genomes added to the database.</li>
                <li><code>'cleanup'</code>: Invokes bulk deletion of all unclassified data.</li>
                <li><code>'rename cluster_1 to MyStrain'</code>: Executes bulk taxonomic update.</li>
                <li><code>'find anomalies'</code>: Invokes the ES|QL drift analysis tool.</li>
                <li><code>'check sanity'</code>: Finds noisy or mislabeled clusters.</li>
                <li><code>'rank stability'</code>: Ranks species by environmental robustness.</li>
                <li><code>'audit bottlenecks'</code>: Detects low-entropy genetic populations.</li>
                <li><code>'list clusters'</code>: Accesses memory retrieval tool.</li>
                <li><code>'clear'</code>: Resets the agent diagnostic terminal.</li>
              </ul>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Agent Terminal Component ---
const AgentTerminal: React.FC<{ 
  onResult: (data: GenomeResponse) => void;
  setFolded: React.Dispatch<React.SetStateAction<any>>;
}> = ({ onResult, setFolded }) => {
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<{ role: 'user' | 'agent' | 'result', text: string }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of terminal
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, isProcessing]);

  const handleSend = async () => {
    if (!command.trim()) return;
    const userQuery = command;
    setCommand('');
    setHistory(prev => [...prev, { role: 'user', text: userQuery }]);
    setIsProcessing(true);

    try {
      const res = await fetch('http://localhost:8000/agent/interact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userQuery })
      });
      const data = await res.json();
      
      setHistory(prev => [...prev, { role: 'agent', text: data.agent_thought }]);

      // Handle Data Retrieval Tools (e.g. List Clusters)
      if (data.type === 'data' && data.tool === 'ES_SEARCH') {
        const clusterRes = await fetch('http://localhost:8000/clusters/');
        if (clusterRes.ok) {
          const list = await clusterRes.json();
          setHistory(prev => [...prev, { role: 'agent', text: `Found ${list.length} active species clusters: ${list.join(', ')}` }]);
        }
      }

      // --- Tool Execution: NCBI_FETCHER ---
      if (data.tool === 'NCBI_FETCHER' && data.params?.accession) {
        setHistory(prev => [...prev, { role: 'agent', text: `Executing NCBI_FETCHER for ${data.params.accession}...` }]);
        const ncbiRes = await fetch('http://localhost:8000/fetch-ncbi/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accession: data.params.accession })
        });
        if (ncbiRes.ok) {
          const genomeData = await ncbiRes.json();
          onResult(genomeData);
          if (typeof (window as any).refreshAllGenomicData === 'function') (window as any).refreshAllGenomicData();
          setHistory(prev => [...prev, { role: 'agent', text: "Success. Identity generated and indexed." }]);
        } else setHistory(prev => [...prev, { role: 'agent', text: "Error: Could not retrieve sequence." }]);
      }

      // --- Tool Execution: GENOME_COMPARATOR ---
      if (data.tool === 'GENOME_COMPARATOR') {
        setHistory(prev => [...prev, { role: 'agent', text: "Fetching last two identities for comparison..." }]);
        try {
          const metricsRes = await fetch('http://localhost:8000/all-metrics/');
          if (metricsRes.ok) {
            const all = await metricsRes.json();
            const lastTwo = all.slice(-2);
            if (lastTwo.length < 2) {
              setHistory(prev => [...prev, { role: 'agent', text: "Abort: Insufficient data. I need at least two genomes in memory." }]);
            } else {
              setHistory(prev => [...prev, { role: 'agent', text: `Comparing ${lastTwo[0].name} vs ${lastTwo[1].name}. Synchronizing Morph panel...` }]);
              
              // 1. Clear existing comparison first
              if (typeof (window as any).onClearCompareGlobal === 'function') (window as any).onClearCompareGlobal();
              
              // 2. Fetch full profiles for both and add to compare
              for (const g of lastTwo) {
                const fullRes = await fetch(`http://localhost:8000/genome/${g.sequence_hash}`);
                if (fullRes.ok) {
                  const full = await fullRes.json();
                  const mapped: any = { face_data: { genome_hash: full.sequence_hash, face_parameters: full.face_parameters, face_parameters_signature: full.face_parameters_signature, face_parameters_label: full.face_parameters_label } as any, metrics: full.metrics, current_cluster: full.cluster_id, filename: full.name, mode: "signature" };
                  if (typeof (window as any).addToCompareGlobal === 'function') (window as any).addToCompareGlobal(mapped);
                }
              }
            }
          }
        } catch { setHistory(prev => [...prev, { role: 'agent', text: "Comparator tool failed." }]); }
      }

      // --- Tool Execution: DATABASE_CLEANUP ---
      if (data.tool === 'DATABASE_CLEANUP') {
        setHistory(prev => [...prev, { role: 'agent', text: "Identifying unclassified taxonomic artifacts..." }]);
        const clustersRes = await fetch('http://localhost:8000/clusters/');
        if (clustersRes.ok) {
          const list: string[] = await clustersRes.json();
          const unclassified = list.filter(c => c.toLowerCase().includes('unclassified') || c.toLowerCase().includes('unknown') || c.startsWith('cluster_'));
          for (const cid of unclassified) {
            setHistory(prev => [...prev, { role: 'agent', text: `Purging ${cid}...` }]);
            await fetch(`http://localhost:8000/clusters/${cid}`, { method: 'DELETE' });
          }
          if (typeof (window as any).refreshAllGenomicData === 'function') (window as any).refreshAllGenomicData();
          setHistory(prev => [...prev, { role: 'agent', text: "Cleanup complete. Memory index optimized." }]);
        }
      }

      // --- Tool Execution: CLUSTER_RENAME ---
      if (data.tool === 'CLUSTER_RENAME' && data.params?.old_id) {
        setHistory(prev => [...prev, { role: 'agent', text: `Updating memory mapping for ${data.params.old_id}...` }]);
        const renRes = await fetch('http://localhost:8000/clusters/rename', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ old_id: data.params.old_id, new_id: data.params.new_id })
        });
        if (renRes.ok) {
          if (typeof (window as any).refreshAllGenomicData === 'function') (window as any).refreshAllGenomicData();
          setHistory(prev => [...prev, { role: 'agent', text: `Rename successful. Group is now '${data.params.new_id}'.` }]);
        } else setHistory(prev => [...prev, { role: 'agent', text: "Rename tool error." }]);
      }

      // --- Tool Execution: ANOMALY_DETECTOR ---
      if (data.tool === 'ANOMALY_DETECTOR') {
        setHistory(prev => [...prev, { role: 'agent', text: "Executing ES|QL to detect drifts and anomalies across all taxonomic groups..." }]);
        setFolded(prev => ({ ...prev, anomalies: false }));
        
        // Wait for the backend to finish the complex ES|QL query
        setTimeout(async () => {
          if (typeof (window as any).refreshAnomaliesGlobal === 'function') {
            (window as any).refreshAnomaliesGlobal();
            
            try {
              const res = await fetch('http://localhost:8000/agent/anomalies?limit=1');
              const result = await res.json();
              if (result.rows?.length > 0 && result.columns) {
                const row = result.rows[0];
                const dIdx = result.columns.indexOf('drift');
                const cIdx = result.columns.indexOf('cluster_id');
                if (dIdx !== -1 && cIdx !== -1) {
                  const val = typeof row[dIdx] === 'number' ? row[dIdx].toFixed(4) : row[dIdx];
                  setHistory(prev => [...prev, { 
                    role: 'result', 
                    text: `TOP DRIFT DETECTED: Cluster '${row[cIdx]}' has a spread of ${val}. Full report available in the Advanced Panel.` 
                  }]);
                }
              }
            } catch (err) {
              console.error("Agent fetch error:", err);
            }
          }
        }, 1500);
      }

      // --- Tool Execution: TERMINAL_CLEAR ---
      if (data.tool === 'TERMINAL_CLEAR') {
        setHistory([]);
      }

      // --- Tool Execution: SANITY_CHECKER ---
      if (data.tool === 'SANITY_CHECKER') {
        setHistory(prev => [...prev, { role: 'agent', text: "Performing taxonomic sanity audit using STDEV variance..." }]);
        setFolded(prev => ({ ...prev, anomalies: false }));
        setTimeout(async () => {
          try {
            const res = await fetch('http://localhost:8000/agent/sanity-check?limit=1');
            if (res.ok) {
              const result = await res.json();
              if (result.rows?.length > 0) {
                const top = result.rows[0];
                setHistory(prev => [...prev, { 
                  role: 'result', 
                  text: `NOISIEST CLUSTER: '${top[2]}' has a GC variance of ${top[0].toFixed(4)}. Check the Advanced panel.` 
                }]);
              }
            }
          } catch {}
        }, 1500);
      }

      // --- Tool Execution: STABILITY_RANKER ---
      if (data.tool === 'STABILITY_RANKER') {
        setHistory(prev => [...prev, { role: 'agent', text: "Ranking species by Environmental Stability Index..." }]);
        setFolded(prev => ({ ...prev, anomalies: false }));
        setTimeout(async () => {
          try {
            const res = await fetch('http://localhost:8000/agent/stability-rank?limit=1');
            if (res.ok) {
              const result = await res.json();
              if (result.rows?.length > 0) {
                const top = result.rows[0];
                setHistory(prev => [...prev, { 
                  role: 'result', 
                  text: `MOST STABLE: '${top[2]}' leads with an index of ${top[0].toFixed(4)}. Full rank in Advanced panel.` 
                }]);
              }
            }
          } catch {}
        }, 1500);
      }

      // --- Tool Execution: BOTTLENECK_DETECTOR ---
      if (data.tool === 'BOTTLENECK_DETECTOR') {
        setHistory(prev => [...prev, { role: 'agent', text: "Auditing population entropy for bottleneck signatures..." }]);
        setFolded(prev => ({ ...prev, anomalies: false }));
        setTimeout(async () => {
          try {
            const res = await fetch('http://localhost:8000/agent/bottleneck-detect?limit=1');
            if (res.ok) {
              const result = await res.json();
              if (result.rows?.length > 0) {
                const top = result.rows[0];
                setHistory(prev => [...prev, { 
                  role: 'result', 
                  text: `BOTTLENECK ALERT: '${top[1]}' has unusually low entropy (${top[0].toFixed(4)}). Full audit in Advanced panel.` 
                }]);
              }
            }
          } catch {}
        }, 1500);
      }
    } catch (err: any) {
      console.error("Agent interaction error:", err);
      setHistory(prev => [...prev, { role: 'agent', text: `System Error: ${err.message || 'Connection lost.'}` }]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="agent-terminal-floating">
      <div className="terminal-header">🤖 AGENT COMMAND INTERFACE</div>
      <div className="terminal-body" ref={scrollRef}>
        {history.map((h, i) => (
          <div key={i} className={`terminal-line ${h.role}`}>
            <span className="line-prefix">{h.role === 'user' ? '>' : '>>>'}</span>
            {h.text}
          </div>
        ))}
        {isProcessing && <div className="terminal-line agent pulse">Thinking...</div>}
      </div>
      <div className="terminal-input-row">
        <input 
          type="text" 
          value={command} 
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Command: 'fetch accession', 'list species'..."
        />
        <button onClick={handleSend}>SEND</button>
      </div>
    </div>
  );
};

// --- KDE Visualization Component ---
const GenomeCharts: React.FC<{ metrics: Metrics }> = ({ metrics }) => {
  const kdeData = useMemo(() => {
    const frequencies = Object.values(metrics.codon_frequency || {});
    if (frequencies.length < 2) return [];
    const kernel = ss.kernelDensityEstimation(frequencies);
    const min = Math.min(...frequencies);
    const max = Math.max(...frequencies);
    const step = (max - min) / 40;
    const points = [];
    for (let x = min; x <= max; x += step) points.push({ x: x.toFixed(2), y: kernel(x) });
    return points;
  }, [metrics.codon_frequency]);

  const rscuData = useMemo(() => Object.entries(metrics.rscu || {}).map(([codon, value]) => ({ codon, value })).sort((a, b) => b.value - a.value).slice(0, 15), [metrics.rscu]);

  return (
    <div className="charts-grid">
      <div className="chart-item">
        <h5>Codon Frequency Density (KDE)</h5>
        <ResponsiveContainer width="100%" height={120}><AreaChart data={kdeData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="x" hide /><YAxis hide /><Tooltip /><Area type="monotone" dataKey="y" stroke="#8884d8" fill="#8884d8" /></AreaChart></ResponsiveContainer>
      </div>
      <div className="chart-item">
        <h5>Top 15 RSCU Bias</h5>
        <ResponsiveContainer width="100%" height={120}><BarChart data={rscuData}><XAxis dataKey="codon" fontSize={8} /><YAxis fontSize={8} /><Tooltip /><Bar dataKey="value">{rscuData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.value > 1 ? '#ff7300' : '#82ca9d'} />))}</Bar></BarChart></ResponsiveContainer>
      </div>
    </div>
  );
};

const ResultViewer: React.FC<{ 
  response: GenomeResponse; 
  onDelete: (hash: string) => void;
  onReassign: (newCluster: string) => void;
  onAddToCompare: (resp: GenomeResponse) => void;
  clusters: string[];
}> = ({ response, onDelete, onReassign, onAddToCompare, clusters }) => {
  const [autoRotate, setAutoRotate] = useState(true);
  const [viewMode, setViewMode] = useState(response.mode || 'signature');
  const [expandedParam, setExpandedParam] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(false);

  // Synchronize initial mode once on mount, then allow user to override
  React.useEffect(() => {
    if (response.mode) setViewMode(response.mode);
  }, []); // Run only on mount

  const hasLabelData = useMemo(() => {
    const cid = response.current_cluster;
    return !(!cid || cid === 'Unknown' || cid === 'Unclassified') && !!response.face_data.face_parameters_label;
  }, [response]);

  const activeParams = useMemo(() => {
    let p = response.face_data.face_parameters;
    if (viewMode === 'signature' && response.face_data.face_parameters_signature) p = response.face_data.face_parameters_signature;
    if (viewMode === 'label' && response.face_data.face_parameters_label) p = response.face_data.face_parameters_label;
    
    // Inject virtual keys for clearer sidebar display
    return {
      ...p,
      ear_identity_color: p.skin_tone_hue, // Shares the skin hue logic
      nose_size_asymmetry: p.asymmetry_factor
    };
  }, [viewMode, response]);

  return (
    <div className="results-container">
      <div className="results-header">
        <div className="results-identity">
          <h4>{response.filename || response.face_data.genome_hash.substring(0, 8)}</h4>
          <div className="taxonomy-badges">
            <span className="badge genus-badge" style={{ background: getStableColor(getGenusFromCluster(response.current_cluster), 1000) }}>
              {getGenusFromCluster(response.current_cluster)}
            </span>
            <span className="badge species-badge" style={{ background: getStableColor(response.current_cluster, 5000) }}>
              {response.current_cluster}
            </span>
          </div>
        </div>
        <div className="results-controls">
          <button className="small-btn primary-btn-mini" onClick={() => onAddToCompare(response)}>+ Compare</button>
          <div className="mini-toggle">
            <button className={viewMode === 'signature' ? 'active' : ''} onClick={() => setViewMode('signature')}>S</button>
            <button className={`${viewMode === 'label' ? 'active' : ''} ${!hasLabelData ? 'disabled' : ''}`} onClick={() => hasLabelData && setViewMode('label')} disabled={!hasLabelData}>L</button>
          </div>
          <button className={`small-btn ${showLabels ? 'active-explain' : ''}`} onClick={() => setShowLabels(!showLabels)}>Explain</button>
          <button className="small-btn" onClick={() => setAutoRotate(!autoRotate)}>{autoRotate ? 'Stop' : 'Rotate'}</button>
          <button className="danger-btn small-btn" onClick={() => onDelete(response.face_data.genome_hash)}>Remove</button>
        </div>
      </div>
      <div className="face-display-3d-mini">
        <Canvas style={{ height: '400px', width: '100%' }}>
          <ambientLight intensity={0.7} />
          <pointLight position={[10, 10, 10]} />
          <Face3D 
            parameters={activeParams} 
            showLabels={showLabels} 
          />
          <OrbitControls autoRotate={autoRotate} />
        </Canvas>
      </div>

      {/* AGENT COMMAND CENTER */}
      <div className="agent-command-center">
        <div className="agent-header">
          <span className="agent-icon">🤖</span>
          <h5>Genomic Curation Agent: Execution Trace</h5>
        </div>
        <div className="agent-log">
          {(response as any).agent_trace?.map((step: any, i: number) => (
            <div key={i} className="agent-step">
              <span className="step-tool">[{step.tool_used}]</span>
              <span className="step-outcome">{step.outcome}</span>
            </div>
          ))}
        </div>
        <div className="agent-rationale">
          {(response as any).agent_rationale?.map((line: string, i: number) => (
            <p key={i} className="rationale-line">{line}</p>
          ))}
        </div>
      </div>

      <GenomeCharts metrics={response.metrics} />
      <div className="metrics-display-mini">
        <details>
          <summary>View Face Parameters ({viewMode})</summary>
          <div className="param-list">
            {PARAM_GROUPS.map(group => (
              <div key={group.label} className="param-group-section"><h5 className="group-label">{group.label}</h5>
                {group.params.map(key => (
                  <div key={key} className={`param-entry ${expandedParam === key ? 'expanded' : ''}`} onClick={() => setExpandedParam(expandedParam === key ? null : key)}>
                    <div className="param-main-row"><span className="param-label">{key}:</span><span className="param-value">{typeof activeParams[key] === 'number' ? activeParams[key].toFixed(3) : 'N/A'}</span><span className="expand-icon">{expandedParam === key ? '−' : '+'}</span></div>
                    <div className="param-short-desc">{paramExplanations[key]?.short}</div>
                    {expandedParam === key && <div className="param-long-desc">{paramExplanations[key]?.long}</div>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </details>
        <details><summary>View Genomic Metrics</summary><pre>{JSON.stringify(response.metrics, null, 2)}</pre></details>
      </div>
    </div>
  );
};

const ComparativePanel: React.FC<{ subjects: GenomeResponse[]; onClear: () => void; clusters: string[] }> = ({ subjects, onClear, clusters }) => {
  const [blend, setBlend] = useState(0.5);
  const [autoRotate, setAutoRotate] = useState(true);
  const [viewMode, setViewMode] = useState<'signature' | 'label'>('signature');
  const [expandedParam, setExpandedParam] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(false);

  const hasLabelData = useMemo(() => {
    return subjects.length > 0 && subjects.every(s => {
      const cid = s.current_cluster;
      return !(!cid || cid === 'Unknown' || cid === 'Unclassified') && !!s.face_data.face_parameters_label;
    });
  }, [subjects]);

  const blendedParams = useMemo(() => {
    if (subjects.length === 0) return null;
    const getParams = (s: GenomeResponse) => {
      if (viewMode === 'signature') return s.face_data.face_parameters_signature || s.face_data.face_parameters;
      if (viewMode === 'label') return s.face_data.face_parameters_label || s.face_data.face_parameters;
      return s.face_data.face_parameters;
    };
    if (subjects.length === 1) return getParams(subjects[0]);
    const p1 = getParams(subjects[0]);
    const p2 = getParams(subjects[1]);
    const res: any = {};
    Object.keys(p1).forEach(k => { if (typeof p1[k] === 'number') res[k] = p1[k] * (1 - blend) + p2[k] * blend; else res[k] = blend > 0.5 ? p2[k] : p1[k]; });
    
    // Virtual keys for sidebar
    res.ear_identity_color = res.skin_tone_hue;
    res.nose_size_asymmetry = res.asymmetry_factor;
    
    return res;
  }, [subjects, blend, viewMode]);

  if (subjects.length === 0) return <div className="comparative-placeholder"><p>Select a genome using "+ Compare" to start.</p></div>;

  return (
    <div className="comparative-engine">
      <div className="results-header">
        <div className="subjects-row" style={{ flex: 1 }}>
          <div className="subject-label">
            <span className="subject-swatch" style={{ background: getStableColor(subjects[0].face_data.genome_hash, 1000) }}></span>
            A: {subjects[0].filename || subjects[0].face_data.genome_hash.substring(0,8)}
          </div>
          {subjects.length > 1 ? (
            <div className="subject-label">
              <span className="subject-swatch" style={{ background: getStableColor(subjects[1].face_data.genome_hash, 1000) }}></span>
              B: {subjects[1].filename || subjects[1].face_data.genome_hash.substring(0,8)}
            </div>
          ) : (<div className="subject-label-pending">Waiting for Subject B...</div>)}
        </div>
        <div className="results-controls">
          <div className="mini-toggle">
            <button className={viewMode === 'signature' ? 'active' : ''} onClick={() => setViewMode('signature')}>S</button>
            <button className={`${viewMode === 'label' ? 'active' : ''} ${!hasLabelData ? 'disabled' : ''}`} onClick={() => hasLabelData && setViewMode('label')} disabled={!hasLabelData}>L</button>
          </div>
          <button className={`small-btn ${showLabels ? 'active-explain' : ''}`} onClick={() => setShowLabels(!showLabels)}>Explain</button>
          <button className="small-btn" onClick={() => setAutoRotate(!autoRotate)}>{autoRotate ? 'Stop' : 'Rotate'}</button>
        </div>
      </div>
      {subjects.length > 1 && (<div className="morph-slider-container"><label>Morph Balance: {(100 - blend * 100).toFixed(0)}% A | {(blend * 100).toFixed(0)}% B</label><input type="range" min="0" max="1" step="0.01" value={blend} onChange={(e) => setBlend(parseFloat(e.target.value))} /></div>)}
      <div className="face-display-3d-large"><Canvas style={{ height: '500px', width: '100%' }}><ambientLight intensity={0.7} /><pointLight position={[10, 10, 10]} /><Face3D parameters={blendedParams} showLabels={showLabels} /><OrbitControls autoRotate={autoRotate} /></Canvas></div>
      {blendedParams && (
        <div className="metrics-display-mini">
          <details><summary>View Morphed Parameters ({viewMode})</summary>
            <div className="param-list">
              {PARAM_GROUPS.map(group => (
                <div key={group.label} className="param-group-section"><h5 className="group-label">{group.label}</h5>
                  {group.params.map(key => (
                    <div key={key} className={`param-entry ${expandedParam === key ? 'expanded' : ''}`} onClick={() => setExpandedParam(expandedParam === key ? null : key)}>
                      <div className="param-main-row"><span className="param-label">{key}:</span><span className="param-value">{typeof blendedParams[key] === 'number' ? blendedParams[key].toFixed(3) : 'N/A'}</span><span className="expand-icon">{expandedParam === key ? '−' : '+'}</span></div>
                      <div className="param-short-desc">{paramExplanations[key]?.short}</div>
                      {expandedParam === key && <div className="param-long-desc">{paramExplanations[key]?.long}</div>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </details>
          <details>
            <summary>View Genomic Metrics (Side-by-Side Comparison)</summary>
            <div className="dual-metrics-row">
              <div className="metric-col">
                <h5>Subject A: {subjects[0].filename || 'Original'}</h5>
                <pre>{JSON.stringify(subjects[0].metrics, null, 2)}</pre>
              </div>
              {subjects.length > 1 && (
                <div className="metric-col">
                  <h5>Subject B: {subjects[1].filename || 'Target'}</h5>
                  <pre>{JSON.stringify(subjects[1].metrics, null, 2)}</pre>
                </div>
              )}
            </div>
          </details>
        </div>
      )}
      <button className="danger-btn" style={{ width: '100%', marginTop: '10px' }} onClick={onClear}>Reset Comparison</button>
    </div>
  );
};

const NCBIFetcher: React.FC<{ onSuccess: (data: GenomeResponse) => void; targetCluster?: string; }> = ({ onSuccess, targetCluster }) => {
  const [accession, setAccession] = useState('');
  const [loading, setLoading] = useState(false);
  const handleFetch = async () => {
    if (!accession) return; setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/fetch-ncbi/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accession, target_cluster: targetCluster || undefined }) });
      if (!res.ok) throw new Error("Not found"); onSuccess(await res.json()); setAccession('');
    } catch { alert("Error"); } finally { setLoading(false); }
  };
  return (<div className="ncbi-fetcher-row"><input type="text" placeholder="NCBI Accession" value={accession} onChange={(e) => setAccession(e.target.value)} /><button className="primary-btn" style={{ width: 'auto' }} onClick={handleFetch} disabled={loading}>{loading ? '...' : 'Fetch'}</button></div>);
};

const PathBrowser: React.FC<{ onSelect: (path: string) => void; onClose: () => void; }> = ({ onSelect, onClose }) => {
  const [currentPath, setCurrentPath] = useState('/');
  const [dirs, setDirs] = useState<string[]>([]);
  const [parentPath, setParentPath] = useState('/');
  const fetchPath = async (path: string) => {
    try {
      const res = await fetch(`http://localhost:8000/ls/?path=${encodeURIComponent(path)}`);
      if (res.ok) { const data = await res.json(); setCurrentPath(data.current_path); setParentPath(data.parent_path); setDirs(data.directories); }
    } catch {}
  };
  React.useEffect(() => { fetchPath('/'); }, []);
  return (<div className="modal-overlay"><div className="path-browser-modal"><h3>Browse Local Folders</h3><div className="current-path-display">{currentPath}</div><div className="dir-list"><div className="dir-item parent" onClick={() => fetchPath(parentPath)}>.. (Parent)</div>{dirs.map(d => (<div key={d} className="dir-item" onClick={() => fetchPath(currentPath + (currentPath.endsWith('/') ? '' : '/') + d)}>📁 {d}</div>))}</div><div className="modal-actions"><button className="secondary-btn" onClick={onClose}>Cancel</button><button className="primary-btn" onClick={() => onSelect(currentPath)}>Select Folder</button></div></div></div>);
};

const ClassificationPanel: React.FC<{ 
  target: any; 
  onClose: () => void; 
  onConfirm: (clusterId: string) => void;
}> = ({ target, onClose, onConfirm }) => {
  const [customCluster, setCustomCluster] = useState('');
  const [selectedCandidate, setSelectedCluster] = useState(target.recommended);
  const spread = 30; 

  return (
    <div className="modal-overlay">
      <div className="classification-modal">
        <h3>Classify Genome: {target.target.name}</h3>
        <div className="classification-layout">
          <div className="classification-viewer-3d">
            <Canvas camera={{ position: [5, 5, 15], fov: 50 }} style={{ height: '450px', width: '100%', background: '#000' }}>
              <ambientLight intensity={0.9} />
              <pointLight position={[10, 10, 10]} />
              <Stars radius={50} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />
              <OrbitControls />
              <GizmoHelper alignment="top-left" margin={[80, 80]}>
                <GizmoViewport axisColors={['#ff3653', '#0adb46', '#2c8fff']} labelColor="white" />
              </GizmoHelper>
              <mesh position={[0, 0, 0]}>
                <sphereGeometry args={[0.3, 16, 16]} />
                <meshStandardMaterial color="white" emissive="white" emissiveIntensity={3} />
              </mesh>
              {target.candidates.map((c: any) => {
                const isSelected = c.cluster_id === selectedCandidate;
                const pos: [number, number, number] = [
                  (c.coords[0] - target.target.coords[0]) * spread,
                  (c.coords[1] - target.target.coords[1]) * spread,
                  (c.coords[2] - target.target.coords[2]) * spread
                ];
                const color = getStableColor(c.cluster_id, 5000); 
                return (
                  <group key={c.cluster_id}>
                    <mesh position={pos} onClick={() => setSelectedCluster(c.cluster_id)}>
                      <sphereGeometry args={[isSelected ? 0.35 : 0.2, 16, 16]} />
                      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={isSelected ? 4 : 1.5} />
                    </mesh>
                    {isSelected && (
                      <line>
                        <bufferGeometry attach="geometry" onUpdate={self => self.setFromPoints([
                          new THREE.Vector3(0, 0, 0),
                          new THREE.Vector3(pos[0], pos[1], pos[2])
                        ])} />
                        <lineBasicMaterial attach="material" color="#0adb46" linewidth={3} transparent opacity={0.8} />
                      </line>
                    )}
                  </group>
                );
              })}
            </Canvas>
            <p className="hint">Center (White) = Target | Lines indicate distance to candidates.</p>
          </div>
          <div className="classification-controls">
            <div className="classification-inputs">
              <div className="recom-box"><label>Recommendation:</label><div className="recom-value">{target.recommended}</div></div>
              
              <div className="current-drift-readout">
                <label>Current Assignment:</label>
                {(() => {
                  const current = target.candidates.find((c: any) => c.is_current);
                  if (current) {
                    return <span>{current.cluster_id} (Distance: {current.distance.toFixed(4)})</span>;
                  }
                  return <span>Unclassified / Prototype missing</span>;
                })()}
              </div>

              <div className="selection-box">
                <label>Assign to:</label>
                <select value={selectedCandidate} onChange={(e) => setSelectedCluster(e.target.value)}>
                  {target.candidates.map((c: any) => (
                    <option key={c.cluster_id} value={c.cluster_id}>
                      {c.cluster_id} {c.is_current ? '(Current Cluster)' : ''} (Dist: {c.distance.toFixed(3)})
                    </option>
                  ))}
                  <option value="new">-- Suggest New --</option>
                </select>
                {selectedCandidate === 'new' && <input type="text" placeholder="Enter name..." value={customCluster} onChange={(e) => setCustomCluster(e.target.value)} />}
              </div>
            </div>
            <div className="actions-row">
              <button className="secondary-btn" onClick={onClose}>Cancel</button>
              <button className="primary-btn" onClick={() => onConfirm(selectedCandidate === 'new' ? customCluster : selectedCandidate)}>Confirm</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  const [clusters, setClusters] = useState<string[]>([]);
  const [expandedGenus, setExpandedGenus] = useState<string | null>(null);
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);
  const [clusterGenomes, setClusterGenomes] = useState<any[]>([]);
  const [clusterResponse, setClusterResponse] = useState<GenomeResponse | null>(null);
  const [galaxyResponse, setGalaxyResponse] = useState<GenomeResponse | null>(null);
  const [classifyTarget, setClassifyTarget] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [genomeSearchTerm, setGenomeSearchTerm] = useState('');
  const [showPathBrowser, setShowPathBrowser] = useState(false);
  const [compareList, setCompareList] = useState<GenomeResponse[]>([]);
  const [folded, setFolded] = useState({ clusters: true, sequence: true, upload: true, batch: true, compare: true, space: true, anomalies: true });
  const [genomeSequence, setGenomeSequence] = useState<string>('');
  const [sequenceResponse, setSequenceResponse] = useState<GenomeResponse | null>(null);
  const [seqTargetCluster, setSeqTargetCluster] = useState<string>('');
  const [seqNewCluster, setSeqNewCluster] = useState<string>('');
  const [seqLoading, setSeqLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResponse, setUploadResponse] = useState<GenomeResponse | null>(null);
  const [upTargetCluster, setUpTargetCluster] = useState<string>('');
  const [upNewCluster, setUpNewCluster] = useState<string>('');
  const [upLoading, setUpLoading] = useState(false);
  const [localPath, setLocalPath] = useState<string>('');
  const [ncbiBatch, setNcbiBatch] = useState<string>('');
  const [zipTargetCluster, setZipTargetCluster] = useState<string>('');
  const [zipNewCluster, setZipNewCluster] = useState<string>('');
  const [zipSummary, setZipSummary] = useState<any | null>(null);
  const [zipLoading, setZipLoading] = useState(false);
  const [folderLoading, setFolderLoading] = useState(false);
  const [ncbiLoading, setNcbiLoading] = useState(false);
  const [allMetrics, setAllMetrics] = useState<any[]>([]);
  const [visibleSpecies, setVisibleSpecies] = useState<Set<string>>(new Set());

  // --- OPTIMIZATION: Pre-calculate groupings to avoid O(N*M) in render ---
  const metricsBySpecies = useMemo(() => {
    const map: Record<string, any[]> = {};
    allMetrics.forEach(m => {
      if (!map[m.cluster_id]) map[m.cluster_id] = [];
      map[m.cluster_id].push(m);
    });
    return map;
  }, [allMetrics]);

  const metricsByGenus = useMemo(() => {
    const map: Record<string, any[]> = {};
    allMetrics.forEach(m => {
      const genus = getGenusFromCluster(m.cluster_id);
      if (!map[genus]) map[genus] = [];
      map[genus].push(m);
    });
    return map;
  }, [allMetrics]);

  const genusGroups = useMemo(() => {
    const groups: { [key: string]: string[] } = {};
    clusters.forEach(c => { 
      const g = getGenusFromCluster(c);
      if (!groups[g]) groups[g] = []; 
      groups[g].push(c); 
    });
    return groups;
  }, [clusters]);

  const filteredGenuses = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    const genomeSearchLower = genomeSearchTerm.toLowerCase();

    return Object.keys(genusGroups).filter(g => {
      const genusMatches = g.toLowerCase().includes(searchLower) || 
                          genusGroups[g].some(c => c.toLowerCase().includes(searchLower));
      
      if (genomeSearchTerm) {
        const hasMatchingGenome = metricsByGenus[g]?.some(m => 
          m.name.toLowerCase().includes(genomeSearchLower)
        );
        return genusMatches && hasMatchingGenome;
      }
      return genusMatches;
    }).sort();
  }, [genusGroups, searchTerm, genomeSearchTerm, metricsByGenus]);
  // ---------------------------------------------------------------------

  const toggleSpeciesVisibility = (speciesId: string) => {
    setVisibleSpecies(prev => {
      const next = new Set(prev);
      if (next.has(speciesId)) next.delete(speciesId);
      else next.add(speciesId);
      return next;
    });
  };

  const toggleGenusVisibility = (genus: string, speciesList: string[]) => {
    setVisibleSpecies(prev => {
      const next = new Set(prev);
      const allSelected = speciesList.every(s => next.has(s));
      if (allSelected) speciesList.forEach(s => next.delete(s));
      else speciesList.forEach(s => next.add(s));
      return next;
    });
  };

  const fetchClusters = async () => { 
    try { 
      const res = await fetch('http://localhost:8000/clusters/'); 
      if (res.ok) {
        const list = await res.json();
        setClusters(list);
        // Force initialize visibility for all clusters
        setVisibleSpecies(new Set(list));
      } 
    } catch {} 
  };
  const fetchAllMetrics = async () => { try { const res = await fetch('http://localhost:8000/all-metrics/'); if (res.ok) setAllMetrics(await res.json()); } catch {} };
  
  React.useEffect(() => { 
    fetchClusters(); 
    fetchAllMetrics(); 
    // Expose refresh globally
    (window as any).refreshAllGenomicData = () => { fetchClusters(); fetchAllMetrics(); };
    // Expose comparator globally for Agent
    (window as any).addToCompareGlobal = (resp: GenomeResponse) => handleAddToCompare(resp);
    (window as any).onClearCompareGlobal = () => setCompareList([]);
  }, []);

  const toggleFold = (panel: keyof typeof folded) => setFolded(prev => ({ ...prev, [panel]: !prev[panel] }));

  const handleFetchGenomes = async (clusterId: string, forceOpen: boolean = false) => {
    if (expandedCluster === clusterId && !forceOpen) { setExpandedCluster(null); setClusterGenomes([]); return; }
    try { const res = await fetch(`http://localhost:8000/clusters/${clusterId}/genomes`); if (res.ok) { setClusterGenomes(await res.json()); setExpandedCluster(clusterId); } } catch {}
  };

  const fetchAverageData = async (target: string) => {
    const res = await fetch(`http://localhost:8000/genus/${target}/prototype`);
    if (res.ok) {
      const dual = await res.json();
      return { face_data: { genome_hash: `AVG_${target}`, face_parameters: dual.signature, face_parameters_signature: dual.signature, face_parameters_label: dual.label, svg: '' } as any, metrics: { note: `Avg for ${target}` } as any, suggested_cluster: target, current_cluster: target, filename: `Avg: ${target}`, mode: "signature" };
    }
    return null;
  };

  const handleFetchGenusAverage = async (target: string) => { const data = await fetchAverageData(target); if (data) setClusterResponse(data); };
  const handleAddToCompare = (resp: GenomeResponse) => { setCompareList(prev => [resp, ...prev].slice(0, 2)); setFolded(prev => ({ ...prev, compare: false })); };
  const handleCompareAverage = async (target: string) => { const data = await fetchAverageData(target); if (data) handleAddToCompare(data); };

  const handleSelectFromDatabase = (g: any) => {
    setClusterResponse({ face_data: { genome_hash: g.sequence_hash, face_parameters: g.face_parameters, face_parameters_signature: g.face_parameters_signature, face_parameters_label: g.face_parameters_label, svg: g.svg || '' } as any, metrics: g.metrics, suggested_cluster: g.cluster_id, current_cluster: g.cluster_id, filename: g.name, mode: "signature" });
  };

  const handleSelectFromGalaxy = async (hash: string) => {
    try {
      const res = await fetch(`http://localhost:8000/genome/${hash}`);
      if (res.ok) {
        const g = await res.json();
        const mapped: GenomeResponse = { face_data: { genome_hash: g.sequence_hash, face_parameters: g.face_parameters, face_parameters_signature: g.face_parameters_signature, face_parameters_label: g.face_parameters_label, svg: g.svg || '' } as any, metrics: g.metrics, suggested_cluster: g.cluster_id, current_cluster: g.cluster_id, filename: g.name, mode: "signature" };
        setGalaxyResponse(mapped);
      }
    } catch {}
  };

  const handleOpenClassify = async (sequenceHash: string) => {
    try {
      const cleanHash = sequenceHash.trim();
      const res = await fetch(`http://localhost:8000/genome/${cleanHash}/classification-candidates`);
      if (res.ok) setClassifyTarget(await res.json());
    } catch (err) { console.error(err); }
  };

  const handleConfirmClassification = async (newCluster: string) => {
    if (!classifyTarget) return;
    try {
      await fetch(`http://localhost:8000/genome/${classifyTarget.target.hash}/reassign`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_cluster: newCluster })
      });
      setClassifyTarget(null); 
      fetchClusters(); 
      fetchAllMetrics();
      // Auto-refresh the current expanded cluster list if one is open
      if (expandedCluster) {
        const res = await fetch(`http://localhost:8000/clusters/${expandedCluster}/genomes`);
        if (res.ok) setClusterGenomes(await res.json());
      }
    } catch {}
  };

  const handleApiResponse = async (data: any, setResp: any) => { 
    setResp(data); 
    setGalaxyResponse(data); // Synchronize with the 3D Galaxy immediately
    setFolded(prev => ({ ...prev, space: false, clusters: false })); // Ensure Galaxy and Clusters are visible
    
    // Auto-expand the navigator to show the new genome
    const newCluster = data.current_cluster;
    const newGenus = getGenusFromCluster(newCluster);
    setExpandedGenus(newGenus);
    setVisibleSpecies(prev => new Set(prev).add(newCluster));
    
    // Slight delay to ensure ES shard visibility before refreshing the list
    setTimeout(async () => {
      await handleFetchGenomes(newCluster, true); // Force open and refresh the list
      fetchClusters(); 
      fetchAllMetrics(); 
    }, 300);
  };

  const handleSubmitSequence = async () => {
    setSeqLoading(true); 
    // We send the raw sequence so the backend can correctly strip FASTA headers
    const final = seqNewCluster || seqTargetCluster;
    try { 
      const res = await fetch('http://localhost:8000/generate-face/', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ sequence: genomeSequence, target_cluster: final || undefined }) 
      }); 
      if (res.ok) handleApiResponse(await res.json(), setSequenceResponse); 
      else {
        const errData = await res.json();
        alert(`Error: ${errData.detail}`);
      }
    } catch {
      alert("Connection Error: Backend server might be offline.");
    } finally { setSeqLoading(false); }
  };

  const handleSubmitFile = async () => {
    if (!selectedFile) return; setUpLoading(true); const final = upNewCluster || upTargetCluster;
    try { const fd = new FormData(); fd.append('file', selectedFile); if (final) fd.append('target_cluster', final); const res = await fetch('http://localhost:8000/upload-genome-file/', { method: 'POST', body: fd }); if (res.ok) handleApiResponse(await res.json(), setUploadResponse); } catch {} finally { setUpLoading(false); }
  };

  const handleNcbiBatch = async () => {
    if (!ncbiBatch) return; setNcbiLoading(true); setZipSummary(null);
    const accs = ncbiBatch.split(',').map(s => s.trim());
    const final = zipNewCluster || zipTargetCluster;
    
    try {
      const response = await fetch('http://localhost:8000/fetch-ncbi-batch/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessions: accs, target_cluster: final || undefined })
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      const results: any[] = [];
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.trim());
        for (const line of lines) {
          const update = JSON.parse(line);
          results.push(update);
          setZipSummary({ total: accs.length, summary: [...results] });
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setNcbiLoading(false);
      fetchClusters();
      fetchAllMetrics();
    }
  };

  const handleSubmitPath = async () => {
    if (!localPath) return; 
    setFolderLoading(true);
    setZipSummary(null);
    const final = zipNewCluster || zipTargetCluster;
    
    try {
      const response = await fetch('http://localhost:8000/upload-batch-path/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: localPath, target_cluster: final || undefined })
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      const results: any[] = [];
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.trim());
        for (const line of lines) {
          const update = JSON.parse(line);
          results.push(update);
          setZipSummary({ total: results.length, summary: [...results] });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFolderLoading(false);
      fetchClusters();
      fetchAllMetrics();
    }
  };

  const handleSubmitZip = async (zipFile: File | null) => {
    if (!zipFile) return; 
    setZipLoading(true);
    setZipSummary(null);
    const final = zipNewCluster || zipTargetCluster;
    
    try { 
      const fd = new FormData(); 
      fd.append('file', zipFile); 
      if (final) fd.append('target_cluster', final); 
      
      const response = await fetch('http://localhost:8000/upload-batch-zip/', { 
        method: 'POST', 
        body: fd 
      }); 

      const reader = response.body?.getReader();
      if (!reader) return;

      const results: any[] = [];
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.trim());
        for (const line of lines) {
          const update = JSON.parse(line);
          results.push(update);
          setZipSummary({ total: results.length, summary: [...results] });
        }
      }
    } catch (err) { 
      alert("Network Error during batch upload."); 
    } finally { 
      setZipLoading(false);
      fetchClusters();
      fetchAllMetrics();
    }
  };

  const handleReassign = async (hash: string, val: string, setResp: any) => {
    let id = val; if (val === 'new') { const p = window.prompt("New:"); if (!p) return; id = p; }
    try { await fetch(`http://localhost:8000/genome/${hash}/reassign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_cluster: id }) }); fetchClusters(); } catch {}
  };

  const handleDeleteGenome = async (hash: string, setResp?: any) => { 
    if (window.confirm("Delete?")) try { 
      await fetch(`http://localhost:8000/genome/${hash}`, { method: 'DELETE' }); 
      if (setResp) setResp(null); 
      fetchClusters(); 
      fetchAllMetrics();
      // Auto-refresh the expanded cluster list if one is open
      if (expandedCluster) {
        const res = await fetch(`http://localhost:8000/clusters/${expandedCluster}/genomes`);
        if (res.ok) setClusterGenomes(await res.json());
      }
    } catch {} 
  };
  const handleRenameCluster = async (oldId: string) => { const n = window.prompt("New name:", oldId); if (n) try { await fetch('http://localhost:8000/clusters/rename', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ old_id: oldId, new_id: n }) }); fetchClusters(); fetchAllMetrics(); } catch {} };
  const handleDeleteCluster = async (id: string) => { if (window.confirm("Delete?")) try { await fetch(`http://localhost:8000/clusters/${id}`, { method: 'DELETE' }); fetchClusters(); fetchAllMetrics(); } catch {} };
  const handleDeleteGenus = async (g: string) => { if (window.confirm("Delete Genus?")) try { await fetch(`http://localhost:8000/genus/${g}`, { method: 'DELETE' }); fetchClusters(); fetchAllMetrics(); } catch {} };

  return (
    <div className="App">
      <header className="App-header"><h1>V-GNOME</h1><p className="subtitle">Visual Genomic Evolution & Morphing Engine</p></header>
      <div className="dashboard">
        {/* ACTIVE CLUSTERS PANEL - UPDATED TO NAVIGATOR STYLE */}
        <section className={`panel ${folded.clusters ? 'folded' : ''}`}>
          <div className="panel-header" onClick={() => toggleFold('clusters')}>
            <h2>Active Clusters (Hierarchical)</h2>
            <span>{folded.clusters ? 'Expand +' : 'Collapse -'}</span>
          </div>
          {!folded.clusters && (
            <div className="panel-content">
              <div className="search-row">
                <div className="search-box"><label>Genus/Species:</label><input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                <div className="search-box"><label>Genomes:</label><input type="text" value={genomeSearchTerm} onChange={(e) => setGenomeSearchTerm(e.target.value)} /></div>
              </div>
              
              <div className="navigator-container">
                <div className="nav-tree-scroll">
                  {filteredGenuses.map(genus => {
                    const searchLower = genomeSearchTerm.toLowerCase();
                    const genusMetrics = metricsByGenus[genus] || [];
                    
                    const manualGenusOpen = expandedGenus === genus;
                    const autoGenusOpen = allMetrics.some(g => getGenusFromCluster(g.cluster_id) === genus && g.sequence_hash === galaxyResponse?.face_data.genome_hash);
                    const isGenusOpen = manualGenusOpen || (!!genomeSearchTerm && genusMetrics.some(m => m.name.toLowerCase().includes(searchLower))) || (autoGenusOpen && !manualGenusOpen && expandedGenus !== null);

                    const filteredSpecies = genusGroups[genus].filter(species => {
                      if (!genomeSearchTerm) return true;
                      return (metricsBySpecies[species] || []).some(m => m.name.toLowerCase().includes(searchLower));
                    });

                    return (
                      <details key={genus} open={isGenusOpen}>
                        <summary className="nav-genus" onClick={(e) => { e.preventDefault(); setExpandedGenus(expandedGenus === genus ? null : genus); }}>
                          <span>{expandedGenus === genus ? '▼' : '▶'} 📁 {genus}</span>
                          <div className="nav-actions">
                            <button className="small-btn primary-btn-mini" onClick={(e) => { e.stopPropagation(); handleCompareAverage(genus); }}>+ Compare</button>
                            <button className="small-btn" onClick={(e) => { e.stopPropagation(); handleFetchGenusAverage(genus); }}>Genus Avg</button>
                            <button className="small-btn danger-btn" onClick={(e) => { e.stopPropagation(); handleDeleteGenus(genus); }}>Delete</button>
                          </div>
                        </summary>
                        {filteredSpecies.map(species => {
                          const speciesMetrics = metricsBySpecies[species] || [];
                          const manualSpeciesOpen = expandedCluster === species;
                          const autoSpeciesOpen = allMetrics.some(g => g.cluster_id === species && g.sequence_hash === galaxyResponse?.face_data.genome_hash);
                          const isSpeciesOpen = manualSpeciesOpen || (!!genomeSearchTerm && speciesMetrics.some(m => m.name.toLowerCase().includes(searchLower))) || (autoSpeciesOpen && !manualSpeciesOpen && expandedCluster !== null);
                          
                          return (
                            <details key={species} className="nav-species-nest" open={isSpeciesOpen}>
                              <summary className="nav-species" onClick={(e) => { e.preventDefault(); handleFetchGenomes(species); }}>
                                <span>{expandedCluster === species ? '▼' : '▶'} {species}</span>
                                <div className="nav-actions">
                                  <button className="small-btn primary-btn-mini" onClick={(e) => { e.stopPropagation(); handleCompareAverage(species); }}>+ Compare</button>
                                  <button className="small-btn" onClick={(e) => { e.stopPropagation(); handleFetchGenusAverage(species); }}>Species Avg</button>
                                  <button className="small-btn" onClick={(e) => { e.stopPropagation(); handleRenameCluster(species); }}>Rename</button>
                                  <button className="small-btn danger-btn" onClick={(e) => { e.stopPropagation(); handleDeleteCluster(species); }}>Delete</button>
                                </div>
                              </summary>
                              <ul className="nav-genome-list">
                                {(expandedCluster === species ? clusterGenomes : speciesMetrics).filter(g => g.name.toLowerCase().includes(searchLower)).map(g => { 
                                  const cid = g.cluster_id || '';
                                  const isUnclassified = cid.toLowerCase() === 'unclassified' || cid.toLowerCase() === 'unknown' || cid.startsWith('cluster_');
                                  const mapped: any = { face_data: { genome_hash: g.sequence_hash, face_parameters: g.face_parameters, face_parameters_signature: g.face_parameters_signature, face_parameters_label: g.face_parameters_label } as any, metrics: g.metrics, suggested_cluster: g.cluster_id, current_cluster: g.cluster_id, filename: g.name, mode: "signature" }; 
                                  return (
                                    <li key={g.sequence_hash} className={`nav-genome-item ${clusterResponse?.face_data.genome_hash === g.sequence_hash ? 'selected' : ''}`}>
                                      <span onClick={() => handleSelectFromDatabase(g)} style={{ cursor: 'pointer' }}>{g.name}</span>
                                      <div className="nav-actions">
                                        <button className="tiny-btn primary-btn-mini" style={{ background: '#007bff' }} onClick={(e) => { e.stopPropagation(); handleOpenClassify(g.sequence_hash); }}>
                                          {isUnclassified ? 'Classify' : 'Re-classify'}
                                        </button>
                                        <button className="tiny-btn primary-btn-mini" onClick={(e) => { e.stopPropagation(); handleAddToCompare(mapped); }}>+ Compare</button>
                                        <button className="tiny-btn danger-btn" onClick={(e) => { e.stopPropagation(); handleDeleteGenome(g.sequence_hash); }}>X</button>
                                      </div>
                                    </li>
                                  ); 
                                })}
                              </ul>
                            </details>
                          );
                        })}
                      </details>
                    );
                  })}
                </div>
              </div>
              {clusterResponse && (<ResultViewer response={clusterResponse} clusters={clusters} onDelete={(h) => handleDeleteGenome(h, setClusterResponse)} onReassign={(v) => handleReassign(clusterResponse.face_data.genome_hash, v, setClusterResponse)} onAddToCompare={handleAddToCompare} />)}
            </div>
          )}
        </section>

        <section className={`panel ${folded.compare ? 'folded' : ''} comparative-panel`}><div className="panel-header" onClick={() => toggleFold('compare')}><h2>Comparative Morph Overlay</h2><span>{folded.compare ? 'Expand +' : 'Collapse -'}</span></div>{!folded.compare && (<div className="panel-content"><ComparativePanel subjects={compareList} onClear={() => setCompareList([])} clusters={clusters} /></div>)}</section>
        
        <section className={`panel ${folded.space ? 'folded' : ''} space-panel`}><div className="panel-header" onClick={() => toggleFold('space')}><h2>3D Genomic Galaxy</h2><span>{folded.space ? 'Expand +' : 'Collapse -'}</span></div>{!folded.space && (<div className="panel-content"><div className="galaxy-controls">
                <details className="galaxy-legend">
                  <summary>Sphere Color Legend (by Genus)</summary>
                  <div className="legend-grid">
                    {Object.keys(genusGroups).sort().map(g => (
                      <div key={g} className="legend-item">
                        <span className="legend-swatch" style={{ background: getStableColor(g, 1000) }}></span>
                        <span className="legend-label">{g}</span>
                      </div>
                    ))}
                  </div>
                </details>
                <details className="galaxy-legend">
                  <summary>Antenna Color Legend (by Species)</summary>
                  <div className="legend-grid">
                    {clusters.sort().map(c => (
                      <div key={c} className="legend-item">
                        <span className="legend-swatch" style={{ background: getStableColor(c, 5000) }}></span>
                        <span className="legend-label">{c}</span>
                      </div>
                    ))}
                  </div>
                </details>
                <details className="galaxy-legend">
                  <summary>How the Galaxy is Built (Axes & Distance)</summary>
                  <div className="axis-legend">
                    <p>The 3D coordinates represent <strong>Euclidean Biometric Distance</strong> between genomes:</p>
                    <div className="axis-foldable-list">
                      <details className="axis-detail">
                        <summary><strong>X-Axis (GC Content):</strong> Primary nucleotide composition.</summary>
                        <div className="axis-content">Genomes with similar GC-ratios will align on this plane.</div>
                      </details>
                      <details className="axis-detail">
                        <summary><strong>Y-Axis (Coding Robustness):</strong> Translation optimization signature.</summary>
                        <div className="axis-content">Represents the efficiency of the organism's coding strategy. Highly optimized genomes will sit higher in the Galaxy.</div>
                      </details>
                      <details className="axis-detail">
                        <summary><strong>Z-Axis (GC Skew):</strong> Genomic structural architecture.</summary>
                        <div className="axis-content">Calculated via strand-asymmetry. This provides the "depth" of the cluster based on replication directionality.</div>
                      </details>
                    </div>
                    <p className="scientific-note"><em>Visual clustering in this space indicates intrinsic mathematical similarity in the DNA code, regardless of taxonomic naming.</em></p>
                  </div>
                </details></div>
                
                <div className="galaxy-layout-horizontal">
                  <div className="galaxy-navigation-tree">
                    <h5>Genome Navigator</h5>
                    <div className="search-box">
                      <input 
                        type="text" 
                        placeholder="Search navigator..." 
                        value={genomeSearchTerm} 
                        onChange={(e) => setGenomeSearchTerm(e.target.value)} 
                        style={{ fontSize: '0.75rem', padding: '6px' }}
                      />
                    </div>
                    <div className="navigator-container" style={{ flex: 1, padding: '5px' }}>
                      <div className="nav-tree-scroll">
                        {filteredGenuses.map(genus => {
                          const searchLower = genomeSearchTerm.toLowerCase();
                          const genusMetrics = metricsByGenus[genus] || [];
                          
                          const manualGenusOpen = expandedGenus === genus;
                          const autoGenusOpen = allMetrics.some(g => getGenusFromCluster(g.cluster_id) === genus && g.sequence_hash === galaxyResponse?.face_data.genome_hash);
                          const isGenusOpen = manualGenusOpen || (!!genomeSearchTerm && genusMetrics.some(m => m.name.toLowerCase().includes(searchLower))) || (autoGenusOpen && !manualGenusOpen && expandedGenus !== null);

                          const filteredSpecies = genusGroups[genus].filter(species => {
                            if (!genomeSearchTerm) return true;
                            return (metricsBySpecies[species] || []).some(m => m.name.toLowerCase().includes(searchLower));
                          });

                          return (
                            <details key={genus} open={isGenusOpen}>
                              <summary className="nav-genus" onClick={(e) => { e.preventDefault(); setExpandedGenus(expandedGenus === genus ? null : genus); }}>
                                <span>{expandedGenus === genus ? '▼' : '▶'} 📁 {genus}</span>
                                <input 
                                  type="checkbox" 
                                  checked={filteredSpecies.every(s => visibleSpecies.has(s))}
                                  onChange={() => toggleGenusVisibility(genus, filteredSpecies)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </summary>
                              {filteredSpecies.map(species => {
                                const searchLower = genomeSearchTerm.toLowerCase();
                                const speciesMetrics = metricsBySpecies[species] || [];
                                
                                const manualSpeciesOpen = expandedCluster === species;
                                const autoSpeciesOpen = allMetrics.some(g => g.cluster_id === species && g.sequence_hash === galaxyResponse?.face_data.genome_hash);
                                const isSpeciesOpen = manualSpeciesOpen || (!!genomeSearchTerm && speciesMetrics.some(m => m.name.toLowerCase().includes(searchLower))) || (autoSpeciesOpen && !manualSpeciesOpen && expandedCluster !== null);
                                
                                return (
                                  <details key={species} className="nav-species-nest" open={isSpeciesOpen}>
                                    <summary className="nav-species" onClick={(e) => { e.preventDefault(); handleFetchGenomes(species); }}>
                                      <span>{expandedCluster === species ? '▼' : '▶'} {species}</span>
                                      <input 
                                        type="checkbox" 
                                        checked={visibleSpecies.has(species)}
                                        onChange={() => toggleSpeciesVisibility(species)}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    </summary>
                                    <ul className="nav-genome-list">
                                      {speciesMetrics.filter(g => !genomeSearchTerm || g.name.toLowerCase().includes(searchLower)).map(g => (
                                        <li 
                                          key={g.sequence_hash} 
                                          className={`nav-genome-item ${galaxyResponse?.face_data.genome_hash === g.sequence_hash ? 'selected' : ''}`}
                                          onClick={(e) => { e.stopPropagation(); handleSelectFromGalaxy(g.sequence_hash); }}
                                        >
                                          <span>{g.name}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </details>
                                );
                              })}
                            </details>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="galaxy-container">
                    <Canvas camera={{ position: [10, 2, 10], fov: 30 }} style={{ height: '500px', width: '100%', background: '#000' }}>
                      <ambientLight intensity={0.8} />
                      <pointLight position={[10, 10, 10]} />
                      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
                      <OrbitControls target={[0, 2, 0]} />
                      <GizmoHelper alignment="top-left" margin={[80, 80]}><GizmoViewport axisColors={['#ff3653', '#0adb46', '#2c8fff']} labelColor="white" /></GizmoHelper>
                      {allMetrics.filter(g => visibleSpecies.has(g.cluster_id)).map((g) => (
                        <GalaxyStar 
                          key={g.sequence_hash}
                          data={g}
                          isSelected={galaxyResponse?.face_data.genome_hash === g.sequence_hash}
                          onClick={() => handleSelectFromGalaxy(g.sequence_hash)}
                          genusColor={getStableColor(getGenusFromCluster(g.cluster_id), 1000)}
                          speciesColor={getStableColor(g.cluster_id, 5000)}
                        />
                      ))}
                    </Canvas>
                    <p className="hint">X: GC (Red) | Y: Robustness (Green) | Z: Skew (Blue). Click star or tree.</p>
                  </div>
                </div>

                {galaxyResponse && (<div className="galaxy-selection-panel"><ResultViewer response={galaxyResponse} clusters={clusters} onDelete={(h) => { handleDeleteGenome(h); setGalaxyResponse(null); }} onReassign={(v) => handleReassign(galaxyResponse.face_data.genome_hash, v, setGalaxyResponse)} onAddToCompare={handleAddToCompare} /></div>)}</div>)}</section>
        
        <section className={`panel ${folded.anomalies ? 'folded' : ''}`}>
          <div className="panel-header" onClick={() => toggleFold('anomalies')}>
            <h2>Advanced Genomic Inspection (ES|QL)</h2>
            <span>{folded.anomalies ? 'Expand +' : 'Collapse -'}</span>
          </div>
          <div className={`panel-content ${folded.anomalies ? 'hidden' : ''}`}>
            <AdvancedInspectionPanel />
          </div>
        </section>

        {classifyTarget && <ClassificationPanel target={classifyTarget} onClose={() => setClassifyTarget(null)} onConfirm={handleConfirmClassification} />}
        {/* UNIFIED INGESTION CENTER */}
        <section className={`panel ${folded.sequence ? 'folded' : ''}`}>
          <div className="panel-header" onClick={() => toggleFold('sequence')}>
            <h2>Genomic Ingestion Center</h2>
            <span>{folded.sequence ? 'Expand +' : 'Collapse -'}</span>
          </div>
          {!folded.sequence && (
            <div className="panel-content">
              <div className="input-group">
                <label>Target Cluster (Optional)</label>
                <div className="cluster-select-row">
                  <select value={seqTargetCluster} onChange={(e) => { setSeqTargetCluster(e.target.value); if(e.target.value) setSeqNewCluster(''); }}>
                    <option value="">(Auto-detect)</option>
                    {clusters.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input type="text" placeholder="Or New Cluster..." value={seqNewCluster} onChange={(e) => { setSeqNewCluster(e.target.value); if(e.target.value) setSeqTargetCluster(''); }} />
                </div>
              </div>

              <div className="ingest-sub-section">
                <h6>Option A: Remote NCBI Stream</h6>
                <NCBIFetcher targetCluster={seqNewCluster || seqTargetCluster} onSuccess={(d) => handleApiResponse(d, setSequenceResponse)} />
              </div>

              <div className="path-upload-divider"><span>- OR -</span></div>

              <div className="ingest-sub-section">
                <h6>Option B: Local File Upload (.fasta, .fna)</h6>
                <div className="file-upload-row">
                  <input type="file" onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)} />
                  <button className="primary-btn" style={{ width: 'auto' }} onClick={handleSubmitFile} disabled={upLoading}>Upload & Process</button>
                </div>
              </div>

              <div className="path-upload-divider"><span>- OR -</span></div>

              <div className="ingest-sub-section">
                <h6>Option C: Direct Sequence Paste</h6>
                <textarea value={genomeSequence} onChange={(e) => setGenomeSequence(e.target.value)} placeholder="Paste raw DNA sequence here..." rows={4} />
                <div className="ingest-actions-row">
                  <button className="primary-btn" onClick={handleSubmitSequence} disabled={seqLoading}>Analyze Sequence</button>
                  <button className="small-btn danger-btn" style={{ padding: '8px 15px' }} onClick={() => { setGenomeSequence(''); setSequenceResponse(null); }}>Clear Sequence</button>
                </div>
              </div>

              {sequenceResponse && (
                <div className="ingest-result-area">
                  <ResultViewer response={sequenceResponse} clusters={clusters} onDelete={(h) => handleDeleteGenome(h, setSequenceResponse)} onReassign={(v) => handleReassign(sequenceResponse.face_data.genome_hash, v, setSequenceResponse)} onAddToCompare={handleAddToCompare} />
                </div>
              )}
              {uploadResponse && !sequenceResponse && (
                <div className="ingest-result-area">
                  <ResultViewer response={uploadResponse} clusters={clusters} onDelete={(h) => handleDeleteGenome(h, setUploadResponse)} onReassign={(v) => handleReassign(uploadResponse.face_data.genome_hash, v, setUploadResponse)} onAddToCompare={handleAddToCompare} />
                </div>
              )}
            </div>
          )}
        </section>

        <section className={`panel ${folded.batch ? 'folded' : ''}`}><div className="panel-header" onClick={() => toggleFold('batch')}><h2>Batch Ingest</h2><span>{folded.batch ? 'Expand +' : 'Collapse -'}</span></div>{!folded.batch && (<div className="panel-content"><div className="input-group"><label>Target Cluster</label><div className="cluster-select-row"><select value={zipTargetCluster} onChange={(e) => { setZipTargetCluster(e.target.value); if(e.target.value) setZipNewCluster(''); }}><option value="">(Auto)</option>{clusters.map(c => <option key={c} value={c}>{c}</option>)}</select><input type="text" placeholder="New Cluster..." value={zipNewCluster} onChange={(e) => { setZipNewCluster(e.target.value); if(e.target.value) setZipTargetCluster(''); }} /></div></div><div className="ncbi-batch-row"><textarea placeholder="Paste accessions" value={ncbiBatch} onChange={(e) => setNcbiBatch(e.target.value)} rows={2} /><button className="primary-btn" onClick={handleNcbiBatch} disabled={ncbiLoading}>{ncbiLoading ? 'Fetching...' : 'Fetch NCBI Batch'}</button></div><div className="path-upload-divider"><span>- OR -</span></div><div className="path-upload-row"><input type="text" placeholder="Local path" value={localPath} onChange={(e) => setLocalPath(e.target.value)} /><button className="small-btn" style={{ padding: '10px' }} onClick={() => setShowPathBrowser(true)}>Browse...</button><button className="primary-btn" onClick={handleSubmitPath} disabled={folderLoading}>{folderLoading ? 'Processing...' : 'Process Folder'}</button></div><div className="file-upload-row">
                  <input type="file" accept=".zip" id="zip-input-field" />
                  <button 
                    className="primary-btn" 
                    disabled={zipLoading} 
                    onClick={() => {
                      const el = document.getElementById('zip-input-field') as HTMLInputElement;
                      if (el && el.files && el.files[0]) handleSubmitZip(el.files[0]);
                    }}
                  >
                    {zipLoading ? 'Processing ZIP...' : 'Upload ZIP'}
                  </button>
                </div>
                {showPathBrowser && <PathBrowser onSelect={(p) => { setLocalPath(p); setShowPathBrowser(false); }} onClose={() => setShowPathBrowser(false)} />}
                {zipSummary && (
                  <div className="zip-summary-results">
                    <h4>Ingestion Summary: {zipSummary.total} Records</h4>
                    <div className="summary-list">
                      {zipSummary.summary.map((s: any, idx: number) => (
                        <div key={idx} className={`summary-item ${s.status}`}>
                          <span className="filename">📄 {s.filename}</span>
                          <span className={`status-badge ${s.status}`}>{s.status}</span>
                        </div>
                      ))}
                    </div>
                    <p className="hint">The 3D Galaxy and Cluster Tree have been synchronized with the new data.</p>
                  </div>
                )}</div>)}</section>
      </div>
      <div className="agent-ui-container-floating">
        <HowToUse />
        <AgentTerminal 
          onResult={(d) => { 
            setClusterResponse(d); 
            setGalaxyResponse(d); // Also highlight in the 3D Galaxy
            setFolded(prev => ({...prev, clusters: false, space: false})); // Open both panels
          }} 
          setFolded={setFolded}
        />
      </div>
      <AIAssistant />
    </div>
  );
}

export default App;
