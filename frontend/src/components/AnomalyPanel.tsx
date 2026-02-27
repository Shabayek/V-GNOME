import React, { useState, useEffect } from 'react';

interface AnomalyData {
  columns: string[];
  rows: any[][];
}

export const AnomalyPanel: React.FC = () => {
  const [data, setData] = useState<AnomalyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [driftThreshold, setDriftThreshold] = useState(0.1);
  const [displayLimit, setDisplayLimit] = useState(10);

  const fetchAnomalies = async () => {
    setLoading(true);
    try {
      const finalLimit = Math.max(1, Math.min(100, displayLimit));
      // Backend now returns the top N records sorted by drift
      const res = await fetch(`http://localhost:8000/agent/anomalies?limit=${finalLimit}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch anomalies", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnomalies();
    // Expose refresh to global window for Agent interaction
    (window as any).refreshAnomaliesGlobal = () => fetchAnomalies();
  }, []);

  return (
    <div className="anomaly-panel-content">
      <div className="anomaly-header">
        <div className="anomaly-controls">
          <div className="input-field">
            <label>Drift Threshold:</label>
            <input 
              type="number" 
              step="0.01" 
              value={driftThreshold} 
              onChange={(e) => setDriftThreshold(parseFloat(e.target.value) || 0)} 
            />
          </div>
          <div className="input-field">
            <label>Top Records:</label>
            <input 
              type="number" 
              value={displayLimit} 
              onChange={(e) => setDisplayLimit(parseInt(e.target.value) || 1)} 
            />
          </div>
          <button className="small-btn primary-btn-mini" onClick={fetchAnomalies} disabled={loading}>
            {loading ? 'Analyzing...' : '🔄 Run ES|QL Analysis'}
          </button>
        </div>
        <p className="hint">Visualizing top {displayLimit} species. Rows exceeding {driftThreshold} drift are highlighted in <span style={{color: '#F87171', fontWeight: 'bold'}}>RED</span>.</p>
      </div>

      {data && (
        <div className="anomaly-table-wrapper">
          <table className="anomaly-table">
            <thead>
              <tr>
                {data.columns.map(col => <th key={col}>{col.replace('_', ' ').toUpperCase()}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => {
                // The 'drift' column is the last one in our ES|QL query
                const driftValue = parseFloat(row[row.length - 1]);
                const isAnomaly = driftValue >= driftThreshold;
                
                return (
                  <tr key={i} className={isAnomaly ? 'high-drift' : ''}>
                    {row.map((cell, j) => (
                      <td key={j}>
                        {typeof cell === 'number' ? cell.toFixed(4) : cell}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
