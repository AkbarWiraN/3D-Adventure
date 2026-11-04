// tests/http.test.js — integrasi HTTP lewat SERVER PORT NYATA (bukan inject),
// supaya header CORS yang dilihat browser benar-benar teruji. prompt.md §4.3 A–F.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

// Kebijakan yang diuji = kebijakan production (origin exact GitHub Pages).
// Harus di-set SEBELUM import config.js karena config dibaca saat import.
process.env.FRONTEND_ORIGINS = 'https://akbarwiran.github.io';

const { buildApp } = await import('../src/app.js');
const { config } = await import('../src/config.js');

const ALLOWED = 'https://akbarwiran.github.io';
let app;
let base;

before(async () => {
  app = await buildApp();
  await app.listen({ host: '127.0.0.1', port: 0 });
  const addr = app.server.address();
  base = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  await app.close();
});

test('A. Origin GitHub diizinkan -> 200 + ACAO tepat + Vary: Origin', async () => {
  const res = await fetch(`${base}/api/v1/health`, { headers: { Origin: ALLOWED } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), ALLOWED);
  assert.match(res.headers.get('vary') || '', /Origin/);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.ok(typeof body.version === 'string');
  assert.ok(Number.isInteger(body.uptimeSec));
});

test('A2. Preflight OPTIONS origin sah -> 204/200 + ACAO + allow-headers minimal', async () => {
  const res = await fetch(`${base}/api/v1/health`, {
    method: 'OPTIONS',
    headers: {
      Origin: ALLOWED,
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'Authorization,Content-Type',
    },
  });
  assert.ok([200, 204].includes(res.status), `status=${res.status}`);
  assert.equal(res.headers.get('access-control-allow-origin'), ALLOWED);
  const allowHeaders = (res.headers.get('access-control-allow-headers') || '').toLowerCase();
  assert.match(allowHeaders, /authorization/);
  assert.doesNotMatch(allowHeaders, /\*/);
});

test('B. Origin asing -> 403 dan TIDAK ada ACAO', async () => {
  const res = await fetch(`${base}/api/v1/health`, { headers: { Origin: 'https://evil.example' } });
  assert.equal(res.status, 403);
  assert.equal(res.headers.get('access-control-allow-origin'), null);
});

test('C. Origin "null" -> 403 dan tidak ada ACAO', async () => {
  const res = await fetch(`${base}/api/v1/health`, { headers: { Origin: 'null' } });
  assert.equal(res.status, 403);
  assert.equal(res.headers.get('access-control-allow-origin'), null);
});

test('D. Origin localhost di production -> 403', async () => {
  const res = await fetch(`${base}/api/v1/health`, { headers: { Origin: 'http://localhost:8000' } });
  assert.equal(res.status, 403);
});

test('E. Origin missing pada API browser-facing -> 403', async () => {
  const res = await fetch(`${base}/api/v1/health`);
  assert.equal(res.status, 403);
  assert.equal(res.headers.get('access-control-allow-origin'), null);
});

test('F. Origin dipalsukan + protected endpoint -> tetap 401/404 tanpa Bearer (dokumentasi batas)', async () => {
  // /api/v1/config/public publik-terbatas: Origin palsu tetap ditolak guard.
  const res = await fetch(`${base}/api/v1/config/public`, { headers: { Origin: 'https://evil.example' } });
  assert.equal(res.status, 403);
});

test('G. /healthz internal bebas kebijakan origin (loopback monitoring)', async () => {
  const res = await fetch(`${base}/healthz`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, db: true });
});

test('H. /config/public origin sah -> kontrak Fase 1 tepat & tanpa field sensitif', async () => {
  const res = await fetch(`${base}/api/v1/config/public`, { headers: { Origin: ALLOWED } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.protocolVersion, 1);
  assert.equal(body.mapId, 'forest');
  assert.equal(body.worldVersion, config.worldVersion);
  assert.equal(body.roomHardCap, config.roomHardCap);
  assert.ok(Array.isArray(body.supportedFeatures));
  // Tidak boleh membocorkan detail internal apa pun.
  const raw = JSON.stringify(body).toLowerCase();
  for (const leak of ['password', 'secret', 'token', 'sqlite', 'path']) {
    assert.ok(!raw.includes(leak), `bocor field: ${leak}`);
  }
});

test('I. Route tak dikenal dengan origin sah -> 404 bersih', async () => {
  const res = await fetch(`${base}/api/v1/tidak-ada`, { headers: { Origin: ALLOWED } });
  assert.equal(res.status, 404);
});
