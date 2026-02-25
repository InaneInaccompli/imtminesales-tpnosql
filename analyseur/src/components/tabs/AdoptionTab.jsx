import { useState, useEffect } from 'react';
import DbSelector from '../common/DbSelector';
import ResultCard from '../common/ResultCard';
import { post, get } from '../../utils/api';

export default function AdoptionTab() {
  const [mode, setMode] = useState('both');
  const [userId, setUserId] = useState(1);
  const [productId, setProductId] = useState(1);
  const [level, setLevel] = useState(2);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

  // Charger le dernier résultat sauvegardé au montage
  useEffect(() => {
    get('/results?type=adoption')
      .then((data) => {
        if (data && data.length > 0) {
          const last = data[0];
          setResult(last.results);
          setSavedAt(last.created_at);
          if (last.params) {
            if (last.params.userId) setUserId(last.params.userId);
            if (last.params.productId) setProductId(last.params.productId);
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
      const data = await post('/products/adoption', { userId, productId, level, mode });
      setResult(data);
      setSavedAt(new Date().toISOString());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const renderCount = (label, badgeClass, res) => {
    if (!res) return null;
    return (
      <ResultCard label={label} badgeClass={badgeClass} time={res.time}>
        <div className="result-count">{res.count ?? 0}</div>
        <div className="result-label">followers ayant commandé ce produit</div>
      </ResultCard>
    );
  };

  return (
    <div className="card">
      <h2>Influence sur un produit specifique</h2>
      <p className="subtitle">
        Nombre de followers (jusqu'au niveau N) d'un individu ayant commandé un produit spécifique. Permet d'observer l'influence d'un « post ».
      </p>

      <DbSelector value={mode} onChange={setMode} />

      <div className="form-grid">
        <div className="form-group">
          <label>User ID</label>
          <input type="number" value={userId} onChange={(e) => setUserId(+e.target.value)} />
        </div>
        <div className="form-group">
          <label>Product ID</label>
          <input type="number" value={productId} onChange={(e) => setProductId(+e.target.value)} />
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
            {renderCount('PostgreSQL', 'badge-pg', result.sql)}
            {renderCount('Neo4j', 'badge-neo4j', result.neo4j)}
          </div>
        </>
      )}
    </div>
  );
}
