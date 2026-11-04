// config.js — baca env, fail-fast di production bila kredensial kosong.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  // .env sederhana (tanpa dependency dotenv) — prod pakai env systemd
  const envFile = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  }
}
loadEnv();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

// Origin diizinkan: comma-separated, wajib non-kosong di production.
function parseOrigins(raw) {
  return (raw || '').split(',').map((s) => s.trim()).filter(Boolean);
}

const origins = parseOrigins(process.env.FRONTEND_ORIGINS);
if (isProd && origins.length === 0) {
  throw new Error('FRONTEND_ORIGINS wajib diisi di production (fail-fast).');
}
if (isProd && origins.some((o) => o === '*' || o === 'null')) {
  throw new Error('Wildcard/null origin tidak diizinkan di production.');
}

const authSecret = process.env.AUTH_SECRET || '';
if (isProd && (!authSecret || authSecret === 'GENERATE_RANDOM_SECRET_LOCALLY_DO_NOT_COMMIT')) {
  throw new Error('AUTH_SECRET belum di-set (fail-fast production).');
}
if (isProd && Buffer.byteLength(authSecret) < 32) {
  throw new Error('AUTH_SECRET minimal 32 byte di production.');
}

export const config = {
  nodeEnv,
  isProd,
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || '127.0.0.1',
  origins,
  databaseFile: process.env.DATABASE_FILE || path.join(__dirname, '..', 'data', 'game.sqlite'),
  authSecret,
  accessTokenTtlSeconds: Number(process.env.ACCESS_TOKEN_TTL_SECONDS || 1200),
  worldSeed: Number(process.env.WORLD_SEED || 20261104),
  worldVersion: process.env.WORLD_VERSION || 'forest-v1',
  roomHardCap: Number(process.env.ROOM_HARD_CAP || 8),
  tickHz: Number(process.env.TICK_HZ || 20),
  snapshotHz: Number(process.env.SNAPSHOT_HZ || 10),
  enemyMapHz: Number(process.env.ENEMY_MAP_HZ || 2),
  combatLogoutSeconds: Number(process.env.COMBAT_LOGOUT_SECONDS || 10),
  version: '0.1.0',
};