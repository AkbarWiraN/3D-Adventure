// security.test.js — CORS/preflight/origin guard lewat SERVER NYATA, bukan mock.
// prompt.md §4.3 acceptance C/G/I: CORS exact, tolak origin asing, Vary, preflight.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

const ALLOWED = 'https://akbarwiran.github.io';
const EVIL = 'https://evil.example';

let app;
let base;

before(async () => {
  // Config harus diset SEBELUM modul config diimpor.
  process.env.NODE_ENV = 'test';
  process.env.FRONTEND_ORIGINS = ALLOWED;
  process.env.DB_PATH = ':memory:';

  const { buildApp } = await import('../src/app.js');
  app = await buildApp();
  await app.listen({ port: 0, host: '127.0.0.1' });
  const addr = app.server.address();
  base = `http://127.0.0.1:${addr.port}`;
});

after(async () => { await app?.close(); });

const get = (path, headers = {}) => fetch(`${base}${path}`, { headers });

describe('CORS & origin guard', () => {
  test('origin sah menerima 200 + ACAO exact', async () => {
    const res = await get('/api/v1/health', { Origin: ALLOWED });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), ALLOWED);
    assert.equal(res.headers.get('vary'), 'Origin');
  });

  test('tanpa Origin ditolak 403', async () => {
    const res = await get('/api/v1/health');
    assert.equal(res.status, 403);
  });

  test('Origin asing ditolak 403', async () => {
    const res = await get('/api/v1/health', { Origin: EVIL });
    assert.equal(res.status, 403);
  });

  test('Origin "null" ditolak 403', async () => {
    const res = await get('/api/v1/health', { Origin: 'null' });
    assert.equal(res.status, 403);
  });

  test('origin mirip tapi beda tetap ditolak', async () => {
    for (const bad of [
      'https://akbarwiran.github.io.evil.example',
      'http://akbarwiran.github.io',
      'https://AKBARWIRAN.github.io.evil',
    ]) {
      const res = await get('/api/v1/health', { Origin: bad });
      assert.equal(res.status, 403, `harus tolak: ${bad}`);
    }
  });

  test('preflight OPTIONS dari origin sah diberi izin', async () => {
    const res = await fetch(`${base}/api/v1/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: ALLOWED,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
    assert.ok(res.status === 200 || res.status === 204, `status ${res.status}`);
    assert.equal(res.headers.get('access-control-allow-origin'), ALLOWED);
    assert.match(res.headers.get('vary') || '', /Origin/i);
  });

  test('preflight dari origin asing tidak diberi izin', async () => {
    const res = await fetch(`${base}/api/v1/health`, {
      method: 'OPTIONS',
      headers: { Origin: EVIL, 'Access-Control-Request-Method': 'GET' },
    });
    const acao = res.headers.get('access-control-allow-origin');
    assert.ok(!acao || acao !== EVIL, `tidak boleh mengizinkan evil, dapat: ${acao}`);
  });
});

describe('endpoint internal & malformed', () => {
  test('/healthz membalas struktur {ok, db}', async () => {
    const res = await get('/healthz', { Origin: ALLOWED });
    const body = await res.json();
    assert.ok(typeof body.ok === 'boolean');
    assert.ok(typeof body.db === 'boolean');
  });

  test('path tidak dikenal → 404 berformat error konsisten', async () => {
    const res = await get('/api/v1/tidak-ada', { Origin: ALLOWED });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.ok(body.error && body.error.code, 'harus ada error.code');
  });

  test('request ID ada di respons', async () => {
    const res = await get('/api/v1/health', { Origin: ALLOWED });
    const rid = res.headers.get('x-request-id');
    assert.ok(rid && rid.length >= 8, `request id tidak ada: ${rid}`);
  });

  test('JSON malformed ditolak tanpa crash 500', async () => {
    const res = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: { Origin: ALLOWED, 'Content-Type': 'application/json' },
      body: '{"rusak": ',
    });
    assert.ok(res.status >= 400 && res.status < 500, `harus 4xx, dapat ${res.status}`);
    const body = await res.json().catch(() => null);
    assert.ok(body?.error?.code, 'harus balas error terstruktur');
  });

  test('Content-Type salah tidak memicu 500', async () => {
    const res = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: { Origin: ALLOWED, 'Content-Type': 'text/plain' },
      body: 'bukan json',
    });
    assert.ok(res.status < 500, `tidak boleh 500, dapat ${res.status}`);
  });
});
