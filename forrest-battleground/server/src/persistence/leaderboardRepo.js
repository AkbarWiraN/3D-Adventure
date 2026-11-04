// leaderboardRepo.js — query leaderboard HANYA BACA.
// prompt.md §4.6: top-N deterministik, index, cache pendek, TIDAK bisa dimutasi REST.
// Kill/death hanya ditulis oleh ledger PvP server (Fase 3) lewat writeKill().

import { getDb } from '../persistence/db.js';

// Cache pendek: leaderboard berubah hanya saat ada kill (Fase 3), bukan tiap request.
const cache = { at: 0, key: '', value: null };
const CACHE_MS = 5000;

export function invalidateCache() {
  cache.at = 0; cache.key = ''; cache.value = null;
}

/**
 * Urutan deterministik: kills DESC, deaths ASC, username ASC (tie-break stabil).
 */
export function top({ limit = 10, offset = 0 } = {}) {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) AS n FROM player_stats WHERE kills > 0 OR deaths > 0').get().n;
  const key = `${limit}:${offset}:${total}`;
  const now = Date.now();
  if (cache.value && cache.key === key && now - cache.at < CACHE_MS) return cache.value;

  const rows = db.prepare(`
    SELECT u.id, u.username_display, u.character,
           COALESCE(s.kills, 0) AS kills, COALESCE(s.deaths, 0) AS deaths
    FROM users u JOIN player_stats s ON s.user_id = u.id
    WHERE s.kills > 0 OR s.deaths > 0
    ORDER BY kills DESC, deaths ASC, LOWER(u.username_display) ASC, u.id ASC
    LIMIT ? OFFSET ?
  `).all(limit, offset);

  const validated = rows.map((r, i) => ({
    rank: offset + i + 1,
    userId: r.id,
    username: r.username_display,
    character: r.character,
    kills: Number(r.kills),
    deaths: Number(r.deaths),
    kdr: Number(r.deaths) === 0
      ? Number(r.kills)
      : Number((Number(r.kills) / Number(r.deaths)).toFixed(2)),
  }));

  const value = { total, entries: validated };
  cache.at=now;cache.key=key;cache.value=value;
  return value;
}

/** Rank 1-based milik seorang user; null bila tidak ada. */
export function rankOf(userId) {
  const db = getDb();
  const row = db.prepare(`
    SELECT rank, kills, deaths FROM (
      SELECT u.id,
             COALESCE(s.kills, 0)  AS kills,
             COALESCE(s.deaths, 0) AS deaths,
             ROW_NUMBER() OVER (
               ORDER BY kills DESC, deaths ASC, LOWER(u.username_display) ASC, u.id ASC
             ) AS rank
      FROM users u JOIN player_stats s ON s.user_id = u.id
    ) WHERE id = ?
  `).get(userId);

  if (!row) return null;
  const kills = Number(row.kills);
  const deaths = Number(row.deaths);
  return {
    rank: Number(row.rank),
    kills,
    deaths,
    kdr: deaths === 0 ? kills : Number((kills / deaths).toFixed(2)),
  };
}

/**
 * Tulis hasil eliminasi. HANYA dipanggil server (Fase 3), idempotent via event_id.
 * Tidak diekspos ke rute REST pemain.
 */
export function writeKill({ eventId, roomId, victimId, killerId, weapon, cause = 'combat', occurredAt = new Date().toISOString() }) {
  const db = getDb();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO elimination_events
      (event_id, room_id, victim_id, killer_id, weapon, cause, occurred_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const bumpKills = db.prepare(`
    UPDATE player_stats SET kills = kills + 1, updated_at = ? WHERE user_id = ?
  `);
  const bumpDeaths = db.prepare(`
    UPDATE player_stats SET deaths = deaths + 1, updated_at = ? WHERE user_id = ?
  `);

  const tx = db.transaction(() => {
    const res = insert.run(eventId, roomId, victimId, killerId, weapon, cause, occurredAt);
    // Idempotent: hanya naikkan statistik bila event benar-benar baru.
    if (res.changes === 0) return { applied: false };
    if (killerId && killerId !== victimId) bumpKills.run(occurredAt, killerId);
    bumpDeaths.run(occurredAt, victimId);
    return { applied: true };
  });

  const out = tx();
  if (out.applied) invalidateCache();
  return out;
}
