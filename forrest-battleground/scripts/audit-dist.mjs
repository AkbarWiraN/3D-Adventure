// audit-dist.mjs — verifikasi ulang dist/ TANPA membangun ulang.
// Dipakai sebagai gerbang sebelum push ke GitHub Pages.

import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

if (!existsSync(DIST)) {
  console.error('dist/ belum ada. Jalankan: npm run build:pages');
  process.exit(1);
}

// Kata kunci yang TIDAK BOLEH muncul di berkas yang dikirim ke publik.
const SECRET_PATTERNS = [
  { re: /BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/, what: 'private key' },
  { re: /argon2id\$|password_hash|JWT_SECRET\s*=/i, what: 'rahasia server' },
  { re: /better-sqlite3/i, what: 'kode backend' },
  { re: /"scripts"\s*:\s*\{[^}]*db:migrate/, what: 'package backend' },
];

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    statSync(p).isDirectory() ? walk(p) : files.push(p);
  }
})(DIST);

const problems = [];
const textExt = new Set(['.js', '.mjs', '.html', '.css', '.json', '.txt', '.svg']);

for (const f of files) {
  const rel = relative(DIST, f);
  const base = rel.split('/').pop();
  const segs = rel.split('/');

  for (const bad of ['server', 'node_modules', 'data', 'tests', '.git']) {
    if (segs.includes(bad)) problems.push(`terlarang: ${rel}`);
  }
  if (base.endsWith('.md')) problems.push(`markdown internal: ${rel}`);
  if (base.startsWith('.env')) problems.push(`env: ${rel}`);
  if (/\.sqlite(-wal|-shm)?$/.test(base)) problems.push(`database: ${rel}`);

  if (textExt.has('.' + base.split('.').pop())) {
    let text = '';
    try { text = readFileSync(f, 'utf8'); } catch { continue; }
    for (const { re, what } of SECRET_PATTERNS) {
      if (re.test(text)) problems.push(`${what} di ${rel}`);
    }
  }
}

const total = files.reduce((n, f) => n + statSync(f).size, 0);
console.log(`audit:dist → ${files.length} file, ${(total / 1024 / 1024).toFixed(2)} MB`);

if (!files.some((f) => f.endsWith('index.html'))) problems.push('index.html tidak ada di dist/');
if (!files.some((f) => /three(\.module)?\.js$/.test(f))) problems.push('three.js tidak ada di dist/');

if (problems.length) {
  console.error('AUDIT GAGAL:');
  for (const p of [...new Set(problems)]) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log('audit:dist → lolos');
