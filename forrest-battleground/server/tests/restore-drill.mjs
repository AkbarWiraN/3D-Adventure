// restore-drill.mjs — bukti backup BENAR-BENAR bisa dipulihkan.
// Alur: DB sumber → backup (Online Backup API) → restore ke file baru →
// bandingkan jumlah baris + integrity + query leaderboard nyata.
//
// Pakai: SRC_DB=/tmp/fb-qa.sqlite node tests/restore-drill.mjs
// Kalau SRC_DB tidak ada, buat DB sintetis (supaya drill tetap bisa jalan).
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const SRC = process.env.SRC_DB || path.join(os.tmpdir(), 'fb-restore-src.sqlite');
const BK = path.join(os.tmpdir(), 'fb-restore-backup.sqlite');
const OUT = path.join(os.tmpdir(), 'fb-restore-out.sqlite');

if (!fs.existsSync(SRC)) {
  const db = new Database(SRC);
  db.pragma('journal_mode = WAL');
  // Skema MINIMAL sama bentuk dengan migrations/001_init.sql (nama kolom asli),
  // supaya drill menguji query produksi, bukan skema karangan.
  db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, username_display TEXT NOT NULL,
             username_canonical TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
             character TEXT NOT NULL DEFAULT 'male', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
           CREATE TABLE player_stats (user_id TEXT PRIMARY KEY REFERENCES users(id),
             kills INTEGER NOT NULL DEFAULT 0, deaths INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
           CREATE TABLE elimination_events (event_id TEXT PRIMARY KEY, room_id TEXT NOT NULL,
             victim_id TEXT NOT NULL REFERENCES users(id), killer_id TEXT REFERENCES users(id),
             weapon TEXT NOT NULL, cause TEXT NOT NULL, occurred_at TEXT NOT NULL);`);
  const ins = db.prepare('INSERT INTO users (id, username_display, username_canonical, password_hash, created_at, updated_at) VALUES (?,?,?,?,?,?)');
  for (let i = 0; i < 7; i++) ins.run(`u${i}`, `pemain_${i}`, `pemain_${i}`, 'x', '2026-11-05', '2026-11-05');
  db.prepare('INSERT INTO player_stats VALUES (?,?,?,?)').run('u0', 3, 1, '2026-11-05');
  db.close();
}

// Backup (logika sama dengan scripts/backup-db.mjs, inline supaya drill mandiri).
{
  const db = new Database(SRC);
  await db.backup(BK);
  db.close();
  const bk = new Database(BK);
  bk.pragma('journal_mode = DELETE');
  bk.close();
}

fs.copyFileSync(BK, OUT);
for (const ext of ['-wal', '-shm']) { const f = OUT + ext; if (fs.existsSync(f)) fs.unlinkSync(f); }

const src = new Database(SRC, { readonly: true });
const dst = new Database(OUT, { readonly: true });
const q = (db, sql) => db.prepare(sql).get();
const rows = (db, sql) => db.prepare(sql).all();
const a = {
  users: q(src, 'SELECT COUNT(*) n FROM users').n,
  events: q(src, 'SELECT COUNT(*) n FROM elimination_events').n,
  integrity: q(dst, 'PRAGMA integrity_check').integrity_check,
  dstUsers: q(dst, 'SELECT COUNT(*) n FROM users').n,
  dstEvents: q(dst, 'SELECT COUNT(*) n FROM elimination_events').n,
  singleFile: !fs.existsSync(OUT + '-wal') && !fs.existsSync(OUT + '-shm'),
};
// Uji fungsional: query leaderboard nyata jalan di DB hasil restore
const lb = rows(dst, `SELECT u.username_display AS username, s.kills, s.deaths
     FROM player_stats s JOIN users u ON u.id = s.user_id
     ORDER BY s.kills DESC, s.deaths ASC, u.username_display ASC LIMIT 3`);
console.log('RESTORE DRILL:', JSON.stringify({ ...a, leaderboardWorks: Array.isArray(lb) }));
const pass = a.integrity === 'ok' && a.dstUsers === a.users && a.dstEvents === a.events && a.singleFile;
console.log('VERDICT:', pass ? 'PASS' : 'FAIL');
src.close(); dst.close();
process.exit(pass ? 0 : 1);
