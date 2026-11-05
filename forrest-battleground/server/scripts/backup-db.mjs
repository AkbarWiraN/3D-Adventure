// backup-db.mjs — backup SQLite online yang WAL-safe + retensi + integrity check.
//
// Kenapa bukan `cp game.sqlite`: file SQLite dalam mode WAL bisa punya commit
// terakhir masih di -wal; copy mentah = backup bisa kehilangan data terbaru
// atau corrupt. better-sqlite3 .backup() memakai SQLite Online Backup API:
// konsisten walau server sedang menulis (lock singkat, bukan downtime).
//
// Pakai:
//   node scripts/backup-db.mjs [nama-file]      # backup sekali
//   BACKUP_KEEP_DAYS=7 BACKUP_KEEP_WEEKLY=4 node scripts/backup-db.mjs
//   node scripts/backup-db.mjs --verify <file>  # cek integrity file backup
//
// Env: DATABASE_FILE (default data/game.sqlite), BACKUP_DIR (default ../../backups),
//      BACKUP_KEEP_DAYS (7), BACKUP_KEEP_WEEKLY (4).
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const DB = process.env.DATABASE_FILE || path.join(here, '..', 'data', 'game.sqlite');
const DIR = process.env.BACKUP_DIR || path.join(here, '..', '..', 'backups');
const KEEP_DAYS = Number(process.env.BACKUP_KEEP_DAYS || 7);
const KEEP_WEEKLY = Number(process.env.BACKUP_KEEP_WEEKLY || 4);

function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function verify(file) {
  const db = new Database(file, { readonly: true });
  try {
    const r = db.pragma('integrity_check'); // [{integrity_check: 'ok'}]
    const users = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
    const events = db.prepare('SELECT COUNT(*) AS n FROM elimination_events').get().n;
    const ok = r[0]?.integrity_check === 'ok';
    console.log(`verify ${path.basename(file)}: integrity=${ok ? 'ok' : 'RUSAK'} users=${users} events=${events}`);
    return ok;
  } finally { db.close(); }
}

const arg = process.argv[2];
if (arg === '--verify') {
  if (!process.argv[3]) { console.error('pakai: --verify <file>'); process.exit(2); }
  process.exit(verify(process.argv[3]) ? 0 : 1);
}

if (!fs.existsSync(DB)) { console.error(`DB tidak ada: ${DB}`); process.exit(1); }
fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });

const out = path.join(DIR, arg || `game-${stamp()}.sqlite`);
const db = new Database(DB);
try {
  await db.backup(out); // Online Backup API: konsisten saat server jalan
} finally { db.close(); }
// Backup harus SATU file mandiri (mudah di-copy/restore). Buka hasil backup,
// pindahkan ke journal DELETE + checkpoint supaya tak ada -wal/-shm tertinggal.
const bk = new Database(out);
try {
  bk.pragma('journal_mode = DELETE');
  bk.pragma('wal_checkpoint(TRUNCATE)');
} finally { bk.close(); }
for (const ext of ['-wal', '-shm']) {
  const f = out + ext;
  if (fs.existsSync(f)) fs.unlinkSync(f);
}
fs.chmodSync(out, 0o600);

if (!verify(out)) { console.error('BACKUP GAGAL VERIFIKASI'); process.exit(1); }
console.log(`backup ok: ${out} (${(fs.statSync(out).size / 1024).toFixed(1)} KB)`);

// Retensi: hapus backup harian > KEEP_DAYS, TAPI simpan backup PERTAMA tiap
// pekan sampai KEEP_WEEKLY — supaya ada titik pemulihan mingguan.
const files = fs.readdirSync(DIR).filter((f) => f.startsWith('game-') && f.endsWith('.sqlite'))
  .map((f) => ({ f, t: fs.statSync(path.join(DIR, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t);
const now = Date.now();
const weeklyKept = new Set();
let removed = 0;
for (const { f, t } of files) {
  const ageDays = (now - t) / 86400000;
  const d = new Date(t);
  const isMonday = d.getDay() === 1;
  const weekKey = `${d.getFullYear()}-W${Math.ceil((d.getDate() + 6 - d.getDay()) / 7)}`;
  if (ageDays > KEEP_DAYS && !(isMonday && weeklyKept.size < KEEP_WEEKLY && !weeklyKept.has(weekKey))) {
    fs.unlinkSync(path.join(DIR, f)); removed++;
  } else if (isMonday) weeklyKept.add(weekKey);
}
console.log(`retensi: ${files.length} file, ${removed} dihapus (hari>${KEEP_DAYS}, pekan<=${KEEP_WEEKLY})`);
