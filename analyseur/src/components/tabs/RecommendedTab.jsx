import { useState, useEffect } from 'react';
import DbSelector from '../common/DbSelector';
import ResultCard from '../common/ResultCard';
import { post, get } from '../../utils/api';

export default function RecommendedTab() {
  const [mode, setMode] = useState('both');
  const [userId, setUserId] = useState(1);
  const [level, setLevel] = useState(2);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

  // Charger le dernier résultat sauvegardé au montage
  useEffect(() => {
    get('/results?type=recommended')
      .then((data) => {
        if (data && data.length > 0) {
          const last = data[0];
          setResult(last.results);
          setSavedAt(last.created_at);
          if (last.params) {
            if (last.params.userId) setUserId(last.params.userId);
            if (last.params.level) setLevel(last.params.level);
            if (last.params.mode) setMode(last.params.mode);
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setSavedAt(null);
    try {
      const data = await post('/products/recommended', { userId, level, mode });
      setResult(data);
      setSavedAt(new Date().toISOString());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const renderTable = (label, badgeClass, res) => {
    if (!res) return null;
    return (
      <ResultCard label={label} badgeClass={badgeClass} time={res.time}>
        {res.data && res.data.length > 0 ? (
          <>
            <div style={{ marginBottom: '0.5rem' }}>
              <span className="result-label">{res.data.length} produits trouvés</span>
            </div>
            <table className="result-table">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Nb commandes</th>
                </tr>
              </thead>
              <tbody>
                {res.data.map((row, i) => (
                  <tr key={i}>
                    <td>{row.name || row.product_name || `#${row.product_id || row.productId}`}</td>
                    <td>{row.count || row.order_count || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <div className="no-data">Aucun résultat</div>
        )}
      </ResultCard>
    );
  };

  return (
    <div className="card">
      <h2>Produits commandes par les cercles de followers</h2>
      <p className="subtitle">
        Observe le rôle d'influenceur d'un individu : quels produits sont commandés par ses cercles de followers (niveau 1 à N).
      </p>

      <DbSelector value={mode} onChange={setMode} />

      <div className="form-grid">
        <div className="form-group">
          <label>User ID</label>
          <input type="number" value={userId} onChange={(e) => setUserId(+e.target.value)} />
        </div>
        <div className="form-group">
          <label>Niveau (profondeur)</label>
          <input type="number" min={1} value={level} onChange={(e) => setLevel(+e.target.value)} />
        </div>
      </div>

      <button className="submit-btn" onClick={handleSubmit} disabled={loading}>
        {loading && <span className="spinner" />}
        {loading ? 'Requête en cours…' : 'Exécuter'}
      </button>

      {error && <div className="error-box">{error}</div>}

      {result && (
        <>
          {savedAt && (
            <div className="saved-indicator">
              💾 Résultat sauvegardé le {new Date(savedAt).toLocaleString()}
            </div>
          )}
          <div className="results-wrapper">
            {renderTable('PostgreSQL', 'badge-pg', result.sql)}
            {renderTable('Neo4j', 'badge-neo4j', result.neo4j)}
          </div>
        </>
      )}
    </div>
  );
}
