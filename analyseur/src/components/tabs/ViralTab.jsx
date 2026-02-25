import { useState, useEffect } from 'react';
import DbSelector from '../common/DbSelector';
import ResultCard from '../common/ResultCard';
import { post, get } from '../../utils/api';

export default function ViralTab() {
  const [mode, setMode] = useState('both');
  const [productId, setProductId] = useState(1);
  const [maxLevel, setMaxLevel] = useState(6);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [viralSuggestions, setViralSuggestions] = useState(null);

  // Charger les viralInfo depuis le dernier import sauvegardé
  useEffect(() => {
    get('/results?type=import')
      .then((data) => {
        if (data && data.length > 0) {
          const last = data[0];
          const info = last.results?.viralInfo;
          if (info && info.viralProductIds?.length > 0) {
            setViralSuggestions(info);
            setProductId(info.viralProductIds[0]);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Charger les derniers résultats sauvegardés au montage
  useEffect(() => {
    get('/results?type=viral')
      .then((data) => {
        if (data && data.length > 0) {
          const last = data[0];
          if (last.results) {
            setResults(last.results);
            setSavedAt(last.created_at);
            if (last.params) {
              setProductId(last.params.productId);
              setMaxLevel(last.params.maxLevel);
              if (last.params.mode) setMode(last.params.mode);
            }
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    setSavedAt(null);
    try {
      const data = await post('/products/viral-network', { productId, maxLevel, mode });
      setResults(data);
      setSavedAt(new Date().toISOString());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const renderViralResult = (label, badgeClass, dbKey) => {
    if (!results || !results[dbKey]) return null;
    const res = results[dbKey];
    return (
      <ResultCard label={label} badgeClass={badgeClass} time={res.time}>
        {res.rootUserId ? (
          <>
            <div style={{ marginBottom: '0.75rem' }}>
              <span className="result-label">Racine du réseau viral : </span>
              <span className="result-count" style={{ fontSize: '1.2rem' }}>
                User #{res.rootUserId}
              </span>
              <span className="result-label" style={{ marginLeft: '1rem' }}>
                Total propagé : <strong>{res.total}</strong> acheteurs
              </span>
            </div>
            <table className="result-table">
              <thead>
                <tr>
                  <th>Cercle</th>
                  <th>Nb acheteurs</th>
                </tr>
              </thead>
              <tbody>
                {res.circles.map((c) => (
                  <tr key={c.level}>
                    <td>Niveau {c.level}</td>
                    <td>{c.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <div className="no-data">
            Aucun réseau viral trouvé pour ce produit.
          </div>
        )}
      </ResultCard>
    );
  };

  return (
    <div className="card">
      <h2>Détection de produit viral</h2>
      <p className="subtitle">
        Pour un produit donné, explore <strong>toute la base</strong> pour trouver le
        réseau de followers où il a été le plus viral. Renvoie l'utilisateur racine et
        le nombre d'acheteurs par cercle. La propagation est orientée : dès qu'un
        follower n'a pas commandé le produit, la branche est coupée.
      </p>

      <DbSelector value={mode} onChange={setMode} />

      {viralSuggestions && (
        <div className="viral-info-box">
          <strong>🧬 Produits viraux générés lors du dernier import :</strong>
          <div className="viral-suggestions">
            {viralSuggestions.viralProductIds.map((pid) => (
              <button
                key={pid}
                className={`suggestion-chip${productId === pid ? ' active' : ''}`}
                onClick={() => setProductId(pid)}
              >
                Product {pid}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="form-grid">
        <div className="form-group">
          <label>Product ID</label>
          <input
            type="number"
            value={productId}
            onChange={(e) => setProductId(+e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Profondeur max</label>
          <input
            type="number"
            min={1}
            value={maxLevel}
            onChange={(e) => setMaxLevel(+e.target.value)}
          />
        </div>
      </div>

      <button className="submit-btn" onClick={handleSubmit} disabled={loading}>
        {loading && <span className="spinner" />}
        {loading ? 'Recherche en cours…' : `Trouver le réseau viral (profondeur ${maxLevel})`}
      </button>

      {error && <div className="error-box">{error}</div>}

      {results && (
        <>
          {savedAt && (
            <div className="saved-indicator">
              💾 Résultat sauvegardé le {new Date(savedAt).toLocaleString()}
            </div>
          )}
          <div className="results-wrapper">
            {renderViralResult('PostgreSQL', 'badge-pg', 'sql')}
            {renderViralResult('Neo4j', 'badge-neo4j', 'neo4j')}
          </div>
        </>
      )}
    </div>
  );
}
