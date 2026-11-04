// db.js — koneksi SQLite WAL + pragma wajib. Satu instance per proses.
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

let db = null;

export function getDb() {
  if (db) return db;

  const dir = path.dirname(config.databaseFile);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

  db = new Database(config.databaseFile);
  // Pragma wajib (prompt.md §4.6): WAL, FK on, busy_timeout.
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');

  return db;
}

export function closeDb() {
  if (db) {
    try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch { /* checkpoint best-effort */ }
    db.close();
    db = null;
  }
}
