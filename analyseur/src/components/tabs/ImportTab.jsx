import { useState, useRef, useCallback, useEffect } from 'react';
import DbSelector from '../common/DbSelector';
import ResultCard from '../common/ResultCard';
import { formatMs } from '../../utils/format';
import { getApiUrl, get } from '../../utils/api';

export default function ImportTab() {
  const [mode, setMode] = useState('both');
  const [counts, setCounts] = useState({
    users: 1000000,
    products: 10000,
    maxOrdersPerUser: 5,
    maxFollowersPerUser: 20,
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null);
  const [logs, setLogs] = useState([]);
  const [savedAt, setSavedAt] = useState(null);
  const eventSourceRef = useRef(null);
  const loadingRef = useRef(false);

  // Charger le dernier résultat d'import sauvegardé au montage
  useEffect(() => {
    get('/results?type=import')
      .then((data) => {
        if (data && data.length > 0) {
          const last = data[0];
          setResult(last.results);
          setSavedAt(last.created_at);
          if (last.params) {
            if (last.params.mode) setMode(last.params.mode);
            setCounts((prev) => ({
              ...prev,
              ...(last.params.users && { users: last.params.users }),
              ...(last.params.products && { products: last.params.products }),
              ...(last.params.maxOrdersPerUser && { maxOrdersPerUser: last.params.maxOrdersPerUser }),
              ...(last.params.maxFollowersPerUser && { maxFollowersPerUser: last.params.maxFollowersPerUser }),
            }));
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = useCallback(() => {
    setLoading(true);
    loadingRef.current = true;
    setError(null);
    setResult(null);
    setProgress(null);
    setLogs([]);

    const params = new URLSearchParams({
      mode,
      users: counts.users,
      products: counts.products,
      maxOrdersPerUser: counts.maxOrdersPerUser,
      maxFollowersPerUser: counts.maxFollowersPerUser,
    });

    const apiUrl = getApiUrl();
    const url = `${apiUrl}/import/progress?${params}`;
    console.log('[ImportTab] Opening SSE:', url);
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener('progress', (e) => {
      try {
        const data = JSON.parse(e.data);
        setProgress(data);
        setLogs((prev) => [...prev.slice(-50), `[${data.db}] ${data.step}: ${data.detail}`]);
      } catch (err) {
        console.error('[ImportTab] Failed to parse progress:', err);
      }
    });

    es.addEventListener('complete', (e) => {
      try {
        const data = JSON.parse(e.data);
        console.log('[ImportTab] Import complete', data);
        setResult(data.results);
        setSavedAt(new Date().toISOString());
      } catch (err) {
        console.error('[ImportTab] Failed to parse complete:', err);
      }
      setLoading(false);
      loadingRef.current = false;
      setProgress(null);
      es.close();
      eventSourceRef.current = null;
    });

    es.addEventListener('error', (e) => {
      // Evenement 'error' envoye explicitement par le serveur (pas l'erreur native SSE)
      if (e.data) {
        try {
          const data = JSON.parse(e.data);
          setError(data.error || 'Erreur inconnue');
        } catch {
          setError('Erreur serveur');
        }
        setLoading(false);
        loadingRef.current = false;
        setProgress(null);
        es.close();
        eventSourceRef.current = null;
      }
    });

    // L'erreur native SSE (deconnexion reseau, etc.)
    es.onerror = (evt) => {
      // EventSource peut retenter automatiquement — ne fermer que si on est encore en loading
      // et que le readyState est CLOSED (pas CONNECTING = retry)
      console.warn('[ImportTab] SSE onerror, readyState:', es.readyState);
      if (es.readyState === EventSource.CLOSED) {
        if (loadingRef.current) {
          setError('Connexion SSE perdue');
          setLoading(false);
          loadingRef.current = false;
          setProgress(null);
        }
        eventSourceRef.current = null;
      }
    };
  }, [mode, counts]);

  const handleCancel = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setLoading(false);
    loadingRef.current = false;
    setProgress(null);
  };

  const updateCount = (key) => (e) => setCounts({ ...counts, [key]: +e.target.value });

  const renderTimings = (label, badgeClass, res) => {
    if (!res) return null;
    const { times, counts: c } = res;
    return (
      <ResultCard label={label} badgeClass={badgeClass} time={times.total}>
        <div style={{ marginBottom: '0.75rem' }}>
          <span className="result-label">
            {c.users} users - {c.products} products - {c.orders} orders - {c.follows} follows
          </span>
        </div>
        <div className="timing-grid">
          {Object.entries(times)
            .filter(([k]) => k !== 'total')
            .map(([k, v]) => (
              <div className="timing-item" key={k}>
                <div className="timing-label">{k}</div>
                <div className="timing-value">{formatMs(v)}</div>
              </div>
            ))}
        </div>
      </ResultCard>
    );
  };

  return (
    <div className="card">
      <h2>Remplissage de base de donnees</h2>
      <p className="subtitle">
        Genere des utilisateurs, produits, commandes et relations de follow aleatoires, puis importe dans la BDD choisie.
      </p>

      <DbSelector value={mode} onChange={setMode} />

      <div className="form-grid">
        {[
          ['Utilisateurs', 'users'],
          ['Produits', 'products'],
          ['Max commandes / user', 'maxOrdersPerUser'],
          ['Max followers / user', 'maxFollowersPerUser'],
        ].map(([label, key]) => (
          <div className="form-group" key={key}>
            <label>{label}</label>
            <input type="number" value={counts[key]} onChange={updateCount(key)} />
          </div>
        ))}
      </div>

      {loading && (
        <div className="progress-section">
          {progress ? (
            <>
              <div className="progress-header">
                <span className="progress-db">{progress.db}</span>
                <span className="progress-step">{progress.step}</span>
                <span className="progress-pct">{progress.pct}%</span>
              </div>
              <div className="progress-bar-track">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${progress.pct || 0}%` }}
                />
              </div>
              <div className="progress-detail">{progress.detail}</div>
            </>
          ) : (
            <div className="progress-header">
              <span className="progress-db">Connexion au serveur...</span>
            </div>
          )}
          {logs.length > 0 && (
            <div className="progress-logs">
              {logs.slice(-8).map((log, i) => (
                <div key={i} className="progress-log-line">{log}</div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button className="submit-btn" onClick={handleSubmit} disabled={loading} style={{ flex: 1 }}>
          {loading && <span className="spinner" />}
          {loading ? 'Import en cours...' : "Lancer l'import"}
        </button>
        {loading && (
          <button className="submit-btn cancel-btn" onClick={handleCancel} style={{ flex: 'none', width: 'auto', padding: '0.75rem 1.5rem' }}>
            Annuler
          </button>
        )}
      </div>

      {error && <div className="error-box">{error}</div>}

      {result && (
        <>
          {savedAt && (
            <div className="saved-indicator">
              💾 Résultat sauvegardé le {new Date(savedAt).toLocaleString()}
            </div>
          )}
          {result.viralInfo && (
            <div className="viral-info-box">
              <strong>🧬 Produits viraux générés :</strong> IDs [{result.viralInfo.viralProductIds?.join(', ')}]
              &nbsp;—&nbsp;
              <strong>Influenceurs seed :</strong> User IDs [{result.viralInfo.seedUserIds?.join(', ')}]
              <div className="viral-info-hint">
                Utilisez ces IDs dans l'onglet « Viral » pour observer la propagation orientée.
              </div>
            </div>
          )}
          <div className="results-wrapper">
            {renderTimings('PostgreSQL', 'badge-pg', result.sql)}
            {renderTimings('Neo4j', 'badge-neo4j', result.neo4j)}
          </div>
        </>
      )}
    </div>
  );
}
