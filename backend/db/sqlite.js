import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const DB_PATH = process.env.SQLITE_PATH || '/data/results.db';

// Crée le dossier parent si nécessaire
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Activer le mode WAL pour de meilleures performances concurrentes
db.pragma('journal_mode = WAL');

// Créer la table des résultats si elle n'existe pas
db.exec(`
  CREATE TABLE IF NOT EXISTS query_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_type TEXT NOT NULL,
    params TEXT NOT NULL,
    results TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Index unique sur (query_type, params) pour écraser les anciens résultats
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_query_results_unique
  ON query_results(query_type, params)
`);

export default db;
