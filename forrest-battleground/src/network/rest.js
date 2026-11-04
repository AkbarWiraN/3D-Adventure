// rest.js — klien REST backend. Token HANYA di memori (prompt.md §4.2).
// Tidak ada password/token di localStorage.

import { CONFIG } from '../config.js';

// Token akses disimpan di memori modul — hilang saat reload (memang disengaja).
let accessToken = null;
let currentUser = null;

export function setToken(token, user = null) {
  accessToken = token || null;
  if (user) currentUser = user;
}

export function clearToken() {
  accessToken = null;
  currentUser = null;
}

export function getToken() { return accessToken; }
export function getUser() { return currentUser; }

export function backendBase() {
  const custom = (CONFIG.backendBase || '').trim().replace(/\/$/, '');
  return custom || 'https://api-be.bssn.biz.id';
}

/**
 * Deteksi campuran konten: halaman HTTPS tidak boleh memanggil HTTP.
 * prompt.md §4.3 acceptance I.
 */
export function isMixedContentBlocked(url) {
  try {
    const u = new URL(url, location.href);
    return location.protocol === 'https:' && u.protocol === 'http:';
  } catch {
    return true;
  }
}

async function request(path, { method = 'GET', body = null, auth = false, timeoutMs = 12000 } = {}) {
  const base = backendBase();
  const url = `${base}${path}`;

  if (isMixedContentBlocked(url)) {
    throw new Error('MIXED_CONTENT: halaman HTTPS tidak dapat memanggil alamat HTTP. Gunakan HTTPS.');
  }

  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    if (!accessToken) throw new Error('NO_TOKEN: belum login');
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: 'no-store',
    });
    const latencyMs = Math.round(performance.now() - started);

    let data = null;
    const text = await res.text();
    if (text) {
      try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 200) }; }
    }

    if (!res.ok) {
      const code = data?.error?.code || `HTTP_${res.status}`;
      const msg = data?.error?.message || `Permintaan gagal (${res.status})`;
      const err = new Error(msg);
      err.code = code;
      err.status = res.status;
      err.latencyMs = latencyMs;
      throw err;
    }
    return { data, latencyMs, status: res.status };
  } catch (err) {
    if (err.name === 'AbortError') {
      const e = new Error('Waktu koneksi habis');
      e.code = 'TIMEOUT';
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  health: () => request('/api/v1/health'),
  configPublic: () => request('/api/v1/config/public'),

  // Fase 2 (belum dipakai di Fase 1 — jangan tampilkan tombol yang belum berfungsi)
  register: (username, password) =>
    request('/api/v1/auth/register', { method: 'POST', body: { username, password } }),
  login: (username, password) =>
    request('/api/v1/auth/login', { method: 'POST', body: { username, password } }),
  me: () => request('/api/v1/users/me', { auth: true }),
  maps: () => request('/api/v1/maps', { auth: true }),
  mapStatus: () => request('/api/v1/maps/forest/status', { auth: true }),
  leaderboard: (limit = 10) => request(`/api/v1/leaderboard?mapId=forest&limit=${limit}`, { auth: true }),
  leaderboardMe: () => request('/api/v1/leaderboard/me?mapId=forest', { auth: true }),
};

/** Uji koneksi untuk Settings: health + config/public, kembalikan status & latency. */
export async function testConnection() {
  try {
    const t0 = performance.now();
    const { data } = await api.health();
    const rtt = Math.round(performance.now() - t0);
    let cfg = null;
    try { cfg = (await api.configPublic()).data; } catch { /* opsional */ }
    return {
      ok: true,
      latencyMs: rtt,
      status: data.status,
      version: data.version,
      worldVersion: cfg?.worldVersion ?? null,
      roomHardCap: cfg?.roomHardCap ?? null,
      base: backendBase(),
    };
  } catch (err) {
    return { ok: false, code: err.code || 'ERROR', message: err.message, base: backendBase() };
  }
}
