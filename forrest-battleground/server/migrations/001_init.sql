-- 001_init.sql — Fase 1: users, player_stats, elimination_events
-- Spesifikasi: prompt.md §4.6

CREATE TABLE IF NOT EXISTS users (
  id                 TEXT PRIMARY KEY,
  username_display   TEXT NOT NULL,
  username_canonical TEXT NOT NULL UNIQUE,
  password_hash      TEXT NOT NULL,
  character          TEXT NOT NULL DEFAULT 'male' CHECK (character IN ('male','female')),
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS player_stats (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  kills      INTEGER NOT NULL DEFAULT 0 CHECK (kills >= 0),
  deaths     INTEGER NOT NULL DEFAULT 0 CHECK (deaths >= 0),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS elimination_events (
  event_id    TEXT PRIMARY KEY,
  room_id     TEXT NOT NULL,
  victim_id   TEXT NOT NULL REFERENCES users(id),
  killer_id   TEXT REFERENCES users(id),
  weapon      TEXT NOT NULL,
  cause       TEXT NOT NULL CHECK (cause IN ('combat','combat_logout','other')),
  occurred_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stats_rank ON player_stats(kills DESC, deaths ASC);
CREATE INDEX IF NOT EXISTS idx_elim_victim ON elimination_events(victim_id);
CREATE INDEX IF NOT EXISTS idx_elim_killer ON elimination_events(killer_id);
