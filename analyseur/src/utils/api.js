// Construit l'URL API dynamiquement a partir du hostname du navigateur
// pour supporter l'acces depuis n'importe quelle machine du reseau.
export function getApiUrl() {
  if (process.env.REACT_APP_API_URL) {
    try {
      const configured = new URL(process.env.REACT_APP_API_URL);
      // Si l'URL configuree utilise localhost, la remplacer par le hostname actuel
      if (configured.hostname === 'localhost' || configured.hostname === '127.0.0.1') {
        configured.hostname = window.location.hostname;
      }
      return configured.toString().replace(/\/$/, '');
    } catch {
      // fallback
    }
  }
  return `http://${window.location.hostname}:5000/api`;
}

const API = getApiUrl();

/**
 * Effectue un POST JSON vers le backend.
 */
export async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Effectue un GET vers le backend.
 */
export async function get(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Effectue un DELETE vers le backend.
 */
export async function del(path) {
  const res = await fetch(`${API}${path}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}
