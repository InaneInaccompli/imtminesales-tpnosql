import db from '../db/sqlite.js';

/**
 * DAO pour persister les résultats de requêtes dans SQLite.
 * Chaque combinaison (queryType, params) est unique :
 * un nouveau résultat écrase l'ancien.
 */
class ResultsDAO {
  constructor() {
    this.stmtUpsert = db.prepare(`
      INSERT INTO query_results (query_type, params, results, created_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(query_type, params) DO UPDATE SET
        results = excluded.results,
        created_at = excluded.created_at
    `);

    this.stmtGet = db.prepare(`
      SELECT results, created_at
      FROM query_results
      WHERE query_type = ? AND params = ?
    `);

    this.stmtGetAll = db.prepare(`
      SELECT query_type, params, results, created_at
      FROM query_results
      ORDER BY created_at DESC
    `);

    this.stmtGetByType = db.prepare(`
      SELECT params, results, created_at
      FROM query_results
      WHERE query_type = ?
      ORDER BY created_at DESC
    `);

    this.stmtDelete = db.prepare(`
      DELETE FROM query_results
      WHERE query_type = ? AND params = ?
    `);

    this.stmtDeleteAll = db.prepare(`
      DELETE FROM query_results
    `);
  }

  /**
   * Sauvegarde (ou écrase) un résultat.
   * @param {string} queryType - ex: 'recommended', 'adoption', 'viral', 'import'
   * @param {object} params - les paramètres de la requête
   * @param {object} results - les résultats à sauvegarder
   */
  save(queryType, params, results) {
    const paramsStr = JSON.stringify(params, Object.keys(params).sort());
    const resultsStr = JSON.stringify(results);
    this.stmtUpsert.run(queryType, paramsStr, resultsStr);
  }

  /**
   * Récupère un résultat sauvegardé pour un type et des paramètres donnés.
   * @returns {{ results: object, created_at: string } | null}
   */
  get(queryType, params) {
    const paramsStr = JSON.stringify(params, Object.keys(params).sort());
    const row = this.stmtGet.get(queryType, paramsStr);
    if (!row) return null;
    return {
      results: JSON.parse(row.results),
      created_at: row.created_at,
    };
  }

  /**
   * Récupère tous les résultats sauvegardés pour un type de requête.
   * @returns {Array<{ params: object, results: object, created_at: string }>}
   */
  getByType(queryType) {
    return this.stmtGetByType.all(queryType).map((row) => ({
      params: JSON.parse(row.params),
      results: JSON.parse(row.results),
      created_at: row.created_at,
    }));
  }

  /**
   * Récupère tous les résultats sauvegardés.
   */
  getAll() {
    return this.stmtGetAll.all().map((row) => ({
      query_type: row.query_type,
      params: JSON.parse(row.params),
      results: JSON.parse(row.results),
      created_at: row.created_at,
    }));
  }

  /**
   * Supprime un résultat spécifique.
   */
  delete(queryType, params) {
    const paramsStr = JSON.stringify(params, Object.keys(params).sort());
    this.stmtDelete.run(queryType, paramsStr);
  }

  /**
   * Supprime tous les résultats.
   */
  deleteAll() {
    this.stmtDeleteAll.run();
  }
}

export default new ResultsDAO();
