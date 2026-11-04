// build-pages.mjs — whitelist ketat: HANYA aset frontend masuk dist/.
// prompt.md §4/§5: jangan pernah kirim server/, .env, sqlite, prompt.md, TASKS.md.

import { cpSync, existsSync, mkdirSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

// Daftar PUTIH — tidak ada pola "kecualikan", hanya ini yang disalin.
const WHITELIST = [
  'index.html',
  'style.css',
  'favicon.svg',
  'src',
  'vendor',
];

// Daftar HITAM tambahan (pertahanan berlapis bila whitelist salah edit).
const FORBIDDEN = [
  'server', 'prompt.md', 'TASKS.md', 'SPEC.md', 'progress.log',
  '.env', 'node_modules', 'data', 'dist', 'tests', 'scripts',
];

const ANON = new Set(['.git', '.github', '.vscode', '.idea']);

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

let copied = 0;
for (const entry of WHITELIST) {
  const src = join(ROOT, entry);
  if (!existsSync(src)) continue;
  const dest = join(DIST, entry);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, {
    recursive: true,
    filter: (p) => {
      const base = p.split('/').pop();
      if (base === '.DS_Store' || ANON.has(base)) return false;
      if (base.endsWith('.bak') || base.endsWith('.log')) return false;
      return true;
    },
  });
  copied++;
}

// ------------------------------------------------------------------ audit
const problems = [];
const files = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else files.push(relative(DIST, p));
  }
}
walk(DIST);

for (const f of files) {
  const segs = f.split('/');
  for (const bad of FORBIDDEN) {
    if (segs.includes(bad)) problems.push(`terlarang di dist: ${f}`);
  }
  if (f.endsWith('.sqlite') || f.endsWith('.sqlite-wal') || f.endsWith('.sqlite-shm')) {
    problems.push(`database bocor: ${f}`);
  }
  if (/^\.env/.test(f.split('/').pop())) problems.push(`env bocor: ${f}`);
  if (f.endsWith('.md')) problems.push(`markdown internal bocor: ${f}`);
}

const totalBytes = files.reduce((n, f) => n + statSync(join(DIST, f)).size, 0);

console.log(`build:pages → dist/`);
console.log(`  entry disalin : ${copied}/${WHITELIST.length}`);
console.log(`  jumlah file   : ${files.length}`);
console.log(`  ukuran total  : ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);

if (problems.length) {
  console.error('\nAUDIT GAGAL:');
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log(`  audit         : lolos, tidak ada file server/.env/db/markdown`);
