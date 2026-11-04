// usersRepo.js — SATU-SATUNYA tempat query tabel users/player_stats.
// prompt.md §4.6: SQL prepared, constraint, tidak ada string SQL yang dirakit.

import crypto from 'node:crypto';
import { getDb } from '../persistence/db.js';

const nowIso = () => new Date().toISOString();

let stmts = null;

function prepared() {
  if (stmts) return stmts;
  const db = getDb();
  stmts = {
    insertUser: db.prepare(`
      INSERT INTO users (id, username_display, username_canonical, password_hash, character, created_at, updated_at)
      VALUES (@id, @display, @canonical, @hash, @character, @now, @now)
    `),
    insertStats: db.prepare(`
      INSERT INTO player_stats (user_id, kills, deaths, updated_at) VALUES (?, 0, 0, ?)
    `),
    byCanonical: db.prepare(`
      SELECT id, username_display, username_canonical, password_hash, character, created_at, updated_at
      FROM users WHERE username_canonical = ?
    `),
    byId: db.prepare(`
      SELECT id, username_display, username_canonical, character, created_at, updated_at
      FROM users WHERE id = ?
    `),
    publicById: db.prepare(`
      SELECT u.id, u.username_display, u.character, u.created_at,
             COALESCE(s.kills, 0)  AS kills,
             COALESCE(s.deaths, 0) AS deaths
      FROM users u
      LEFT JOIN player_stats s ON s.user_id = u.id
      WHERE u.id = ?
    `),
    updateCharacter: db.prepare(`
      UPDATE users SET character = ?, updated_at = ? WHERE id = ?
    `),
    statsFor: db.prepare('SELECT kills, deaths FROM player_stats WHERE user_id = ?'),
    statsInit: db.prepare(`
      INSERT OR IGNORE INTO player_stats (user_id, kills, deaths, updated_at) VALUES (?, 0, 0, ?)
    `),
  };
  return stmts;
}

/** Bentuk data yang aman dikirim ke klien — TIDAK pernah menyertakan password_hash. */
export function toPublicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username_display ?? row.username,
    character: row.character,
    createdAt: row.created_at,
    kills: Number(row.kills ?? 0),
    deaths: Number(row.deaths ?? 0),
  };
}

export function findByCanonical(canonical) {
  return prepared().byCanonical.get(canonical) || null;
}

export function findById(id) {
  return prepared().byId.get(id) || null;
}

export function getPublicById(id) {
  return prepared().publicById.get(id) || null;
}

/**
 * Buat user + inisialisasi player_stats 0 dalam SATU transaksi.
 * Mengembalikan row publik atau melempar {code:'USERNAME_TAKEN'}.
 */
export function createUser({ display, canonical, hash, character }) {
  const db = getDb();
  const id = crypto.randomUUID();
  const tx = db.transaction(() => {
    const s = prepared();
    s.insertUser.run({
      id, display, canonical, hash,
      character: character || 'male',
      now: nowIso(),
    });
    s.insertStats.run(id, nowIso());
    return id;
  });

  try {
    const createdId = tx();
    return getPublicById(createdId);
  } catch (err) {
    if (String(err.message || '').includes('UNIQUE constraint failed')) {
      const e = new Error('Username sudah dipakai.');
      e.code = 'USERNAME_TAKEN';
      e.statusCode = 409;
      throw e;
    }
    throw err;
  }
}

export function setCharacter(userId, character) {
  prepared().updateCharacter.run(character, nowIso(), userId);
  return getPublicById(userId);
}

/** Pastikan baris stats ada (untuk akun lama sebelum Fase 2). */
export function ensureStats(userId) {
  prepared().statsInit.run(userId, nowIso());
  return prepared().statsFor.get(userId) || { kills: 0, deaths: 0 };
}

/** Statistik global ringkas untuk lobby (bukan data pribadi). */
export function globalCounts() {
  const db = getDb();
  const users = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  const totals = db.prepare('SELECT COALESCE(SUM(kills),0) AS k, COALESCE(SUM(deaths),0) AS d FROM player_stats').get();
  return { users, totalKills: Number(totals.k), totalDeaths: Number(totals.d) };
}
