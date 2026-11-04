// migrate.js — runner migrasi versioned, idempotent.
// Tidak pernah CREATE TABLE per-request. Jalankan: npm run db:migrate
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, closeDb } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'migrations');

export function runMigrations() {
  const db = getDb();
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version    TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations').all().map((r) => r.version)
  );

  const insert = db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)');
  const results = [];

  for (const file of files) {
    const version = file.replace(/\.sql$/, '');
    if (applied.has(version)) {
      results.push({ version, status: 'skipped' });
      continue;
    }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    // Satu transaksi per migrasi: gagal = rollback penuh.
    const apply = db.transaction(() => {
      db.exec(sql);
      insert.run(version, new Date().toISOString());
    });
    apply();
    results.push({ version, status: 'applied' });
  }
  return results;
}

// Jalankan langsung bila dipanggil sebagai script.
if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  try {
    const results = runMigrations();
    for (const r of results) console.log(`[migrate] ${r.version}: ${r.status}`);
    closeDb();
    process.exit(0);
  } catch (err) {
    console.error('[migrate] GAGAL:', err.message);
    process.exit(1);
  }
}
