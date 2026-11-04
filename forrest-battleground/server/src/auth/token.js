// token.js — access token bertanda tangan (HS256) memakai node:crypto.
// Tidak menambah dependency JWT: formatnya JWT-compatible tapi minimal.
// prompt.md §4.6: TTL 15-30 menit, disimpan HANYA di RAM browser.

import crypto from 'node:crypto';
import { config } from '../config.js';

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const unb64url = (str) => Buffer.from(str, 'base64url');

function sign(payloadB64) {
  return crypto
    .createHmac('sha256', config.authSecret)
    .update(payloadB64)
    .digest();
}

/**
 * @param {{sub:string, username:string, character:string}} claims
 * @returns {{token:string, expiresAt:number}}
 */
export function issueToken(claims) {
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + config.accessTokenTtlSeconds;

  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    sub: claims.sub,
    username: claims.username,
    character: claims.character,
    iat: nowSec,
    exp: expSec,
    jti: crypto.randomUUID(),
  }));

  const signingInput = `${header}.${payload}`;
  const signature = b64url(sign(signingInput));

  return {
    token: `${signingInput}.${signature}`,
    expiresAt: expSec * 1000,
  };
}

/**
 * Verifikasi token. Tidak pernah melempar: mengembalikan {ok, claims?, code?}.
 */
export function verifyToken(token) {
  if (typeof token !== 'string' || token.length > 2048) {
    return { ok: false, code: 'TOKEN_INVALID' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, code: 'TOKEN_INVALID' };

  const [headerB64, payloadB64, sigB64] = parts;

  // Cek header sebelum verifikasi supaya alg tidak bisa diganti (alg=none attack).
  let header;
  try {
    header = JSON.parse(unb64url(headerB64).toString('utf8'));
  } catch {
    return { ok: false, code: 'TOKEN_INVALID' };
  }
  if (header?.alg !== 'HS256' || header?.typ !== 'JWT') {
    return { ok: false, code: 'TOKEN_INVALID' };
  }

  const expected = sign(`${headerB64}.${payloadB64}`);
  let actual;
  try {
    actual = unb64url(sigB64);
  } catch {
    return { ok: false, code: 'TOKEN_INVALID' };
  }
  if (actual.length !== expected.length) return { ok: false, code: 'TOKEN_INVALID' };
  // Perbandingan waktu-konstan.
  if (!crypto.timingSafeEqual(actual, expected)) return { ok: false, code: 'TOKEN_INVALID' };

  let payload;
  try {
    payload = JSON.parse(unb64url(payloadB64).toString('utf8'));
  } catch {
    return { ok: false, code: 'TOKEN_INVALID' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) {
    return { ok: false, code: 'TOKEN_EXPIRED' };
  }
  if (typeof payload.sub !== 'string' || !payload.sub) {
    return { ok: false, code: 'TOKEN_INVALID' };
  }

  return { ok: true, claims: payload };
}

/** Ambil bearer token dari header Authorization. */
export function readBearer(headers) {
  const raw = headers?.authorization;
  if (typeof raw !== 'string') return null;
  const m = raw.match(/^Bearer\s+([A-Za-z0-9._-]+)$/);
  return m ? m[1] : null;
}
