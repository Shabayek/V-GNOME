import React, { useState, useEffect } from 'react';

interface AnalysisResult {
  columns: string[];
  rows: any[][];
}

export const AdvancedInspectionPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'drift' | 'sanity' | 'stability' | 'bottleneck' | 'investigate'>('drift');
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // --- Parameter States ---
  const [driftThreshold, setDriftThreshold] = useState(0.1);
  const [limit, setLimit] = useState(10);
  const [varianceThreshold, setVarianceThreshold] = useState(0.05);
  const [gcWeight, setGcWeight] = useState(0.7);
  const [entropyThreshold, setEntropyThreshold] = useState(0.9);
  
  // --- Investigate State ---
  const [customQuery, setCustomQuery] = useState('FROM genomic_profiles | LIMIT 10');

  const fetchData = async () => {
    setLoading(true);
    setErrorMessage(null);
    let url = '';
    let method = 'GET';
    let body = null;
    const finalLimit = Math.max(1, limit);
    
    switch (activeTab) {
      case 'drift':
        url = `http://localhost:8000/agent/anomalies?limit=${finalLimit}`;
        break;
      case 'sanity':
        url = `http://localhost:8000/agent/sanity-check?variance_threshold=${varianceThreshold}&limit=${finalLimit}`;
        break;
      case 'stability':
        url = `http://localhost:8000/agent/stability-rank?gc_weight=${gcWeight}&limit=${finalLimit}`;
        break;
      case 'bottleneck':
        url = `http://localhost:8000/agent/bottleneck-detect?entropy_threshold=${entropyThreshold}&limit=${finalLimit}`;
        break;
      case 'investigate':
        url = `http://localhost:8000/agent/query`;
        method = 'POST';
        body = JSON.stringify({ query: customQuery });
        break;
    }

    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body
      });
      if (res.ok) {
        setData(await res.json());
      } else {
        const err = await res.json();
        setErrorMessage(err.detail || "Query execution failed.");
      }
    } catch (err) {
      setErrorMessage("Network error. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    // Expose this panel's refresh logic to the global window so the Agent can trigger it
    (window as any).refreshAnomaliesGlobal = () => fetchData();

    if (activeTab !== 'investigate') {
      fetchData(); 
    } else {
      setData(null);
    }
  }, [activeTab]);

  return (
    <div className="advanced-inspection-container">
      <div className="tabs-header">
        <button className={activeTab === 'drift' ? 'active' : ''} onClick={() => setActiveTab('drift')}>Drift Detection</button>
        <button className={activeTab === 'sanity' ? 'active' : ''} onClick={() => setActiveTab('sanity')}>Taxonomic Sanity</button>
        <button className={activeTab === 'stability' ? 'active' : ''} onClick={() => setActiveTab('stability')}>Stability Index</button>
        <button className={activeTab === 'bottleneck' ? 'active' : ''} onClick={() => setActiveTab('bottleneck')}>Bottleneck Audit</button>
        <button className={activeTab === 'investigate' ? 'active' : ''} onClick={() => setActiveTab('investigate')}>🔬 Investigate</button>
      </div>

      <div className="tab-body">
        <div className="analysis-rationale">
          {activeTab === 'drift' && (
            <>
              <h6>🔍 Drift Detection (Max-Min Spread)</h6>
              <p>Identifies species with the highest internal GC variation. A spread &gt; 0.1 often indicates misclassifications.</p>
            </>
          )}
          {activeTab === 'sanity' && (
            <>
              <h6>⚖️ Taxonomic Sanity Check (STDEV)</h6>
              <p>Uses standard deviation to find clusters that are statistically noisy (variance &gt; 0.05).</p>
            </>
          )}
          {activeTab === 'stability' && (
            <>
              <h6>🌡️ Extremophile Profiler (Weighted EVAL)</h6>
              <p>Ranks organisms by a weighted index of GC Content and Coding Robustness.</p>
            </>
          )}
          {activeTab === 'bottleneck' && (
            <>
              <h6>📉 Population Bottleneck Audit</h6>
              <p>Finds species with unusually low Signature Entropy (&lt; 0.9).</p>
            </>
          )}
          {activeTab === 'investigate' && (
            <>
              <h6>🔬 Custom ES|QL Sandbox</h6>
              <p>Compose your own Elasticsearch Query Language commands to explore the genomic database.</p>
              <div className="query-examples">
                <strong>Tab Query Blueprints (Click to Load):</strong>
                <code className="clickable-example" onClick={() => setCustomQuery('FROM genomic_profiles | STATS min_gc = MIN(metrics.gc_content), max_gc = MAX(metrics.gc_content) BY cluster_id | EVAL drift = max_gc - min_gc | SORT drift DESC')}><strong>Drift Detection:</strong> FROM genomic_profiles | STATS min_gc = MIN(metrics.gc_content), max_gc = MAX(metrics.gc_content) BY cluster_id | EVAL drift = max_gc - min_gc | SORT drift DESC</code>
                <code className="clickable-example" onClick={() => setCustomQuery('FROM genomic_profiles | EVAL gc_sq = metrics.gc_content * metrics.gc_content | STATS avg_gc = AVG(metrics.gc_content), avg_gc_sq = AVG(gc_sq) BY cluster_id | EVAL var = avg_gc_sq - (avg_gc * avg_gc) | SORT var DESC')}><strong>Taxonomic Sanity:</strong> FROM genomic_profiles | EVAL gc_sq = metrics.gc_content * metrics.gc_content | STATS avg_gc = AVG(metrics.gc_content), avg_gc_sq = AVG(gc_sq) BY cluster_id | EVAL var = avg_gc_sq - (avg_gc * avg_gc) | SORT var DESC</code>
                <code className="clickable-example" onClick={() => setCustomQuery('FROM genomic_profiles | EVAL stability = (metrics.gc_content * 0.7) + (metrics.coding_robustness * 0.3) | STATS avg_s = AVG(stability) BY cluster_id | SORT avg_s DESC')}><strong>Stability Index:</strong> FROM genomic_profiles | EVAL stability = (metrics.gc_content * 0.7) + (metrics.coding_robustness * 0.3) | STATS avg_s = AVG(stability) BY cluster_id | SORT avg_s DESC</code>
                <code className="clickable-example" onClick={() => setCustomQuery('FROM genomic_profiles | STATS avg_e = AVG(metrics.signature_entropy) BY cluster_id | SORT avg_e ASC')}><strong>Bottleneck Audit:</strong> FROM genomic_profiles | STATS avg_e = AVG(metrics.signature_entropy) BY cluster_id | SORT avg_e ASC</code>
              </div>
            </>
          )}
        </div>

        <div className="analysis-controls">
          {activeTab === 'investigate' ? (
            <div className="investigate-area">
              <textarea 
                className="custom-query-input"
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                placeholder="Write your ES|QL here..."
              />
              <button className="primary-btn-mini" onClick={fetchData} disabled={loading}>
                {loading ? 'Executing...' : '▶ EXECUTE QUERY'}
              </button>
            </div>
          ) : (
            <div className="input-group-mini">
              {activeTab === 'drift' && (
                <>
                  <label>Drift Threshold:</label>
                  <input type="number" step="0.01" value={driftThreshold} onChange={(e) => setDriftThreshold(parseFloat(e.target.value))} />
                </>
              )}
              {activeTab === 'sanity' && (
                <>
                  <label>Variance Threshold:</label>
                  <input type="number" step="0.01" value={varianceThreshold} onChange={(e) => setVarianceThreshold(parseFloat(e.target.value))} />
                </>
              )}
              {activeTab === 'stability' && (
                <>
                  <label>GC Weight (0-1):</label>
                  <input type="number" step="0.1" value={gcWeight} onChange={(e) => setGcWeight(parseFloat(e.target.value))} />
                  <span className="weight-display">Robust: {(1 - gcWeight).toFixed(1)}</span>
                </>
              )}
              {activeTab === 'bottleneck' && (
                <>
                  <label>Entropy Ceiling:</label>
                  <input type="number" step="0.01" value={entropyThreshold} onChange={(e) => setEntropyThreshold(parseFloat(e.target.value))} />
                </>
              )}
              
              <label>Limit:</label>
              <input type="number" value={limit} onChange={(e) => setLimit(parseInt(e.target.value))} />
              
              <button className="primary-btn-mini" onClick={fetchData} disabled={loading}>
                {loading ? 'Analyzing...' : '▶ RUN ES|QL'}
              </button>
            </div>
          )}
        </div>

        {errorMessage && <div className="query-error">{errorMessage}</div>}

        {data && (
          <div className="anomaly-table-wrapper">
            <table className="anomaly-table">
              <thead>
                <tr>
                  {data.columns.map(col => <th key={col}>{col.toUpperCase().replace('_', ' ')}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, i) => {
                  let isAnomaly = false;
                  if (activeTab === 'drift') {
                    const idx = data.columns.indexOf('drift');
                    if (idx !== -1) isAnomaly = parseFloat(row[idx]) >= driftThreshold;
                  }
                  if (activeTab === 'sanity') {
                    const idx = data.columns.indexOf('variance');
                    if (idx !== -1) isAnomaly = parseFloat(row[idx]) >= varianceThreshold;
                  }
                  if (activeTab === 'bottleneck') {
                    const idx = data.columns.indexOf('avg_entropy');
                    if (idx !== -1) isAnomaly = parseFloat(row[idx]) <= (entropyThreshold - 0.1);
                  }

                  return (
                    <tr key={i} className={isAnomaly ? 'high-drift' : ''}>
                      {row.map((cell, j) => (
                        <td key={j}>{typeof cell === 'number' ? cell.toFixed(4) : cell}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
