// maps.js — lobby & status peta. prompt.md §4.1, §4.6 butir 6.
// PENTING: onlineCount HARUS 0 selama belum ada session WS yang join.
// Akun yang sekadar login TIDAK dihitung online.

import { requireAuth } from '../../auth/requireAuth.js';
import { config } from '../../config.js';
import { getWorld } from '../../../../src/shared/world.js';
import { globalCounts } from '../../persistence/usersRepo.js';
import { getRealtime } from '../../realtime/index.js';

// Registry room nyata. Fase 3 akan mengisi ini dari gateway WSS.
// Sampai ada WS, room tidak punya pemain → onlineCount 0 (jujur, bukan angka palsu).
const rooms = new Map();

export function getRoom(mapId = 'forest') {
  if(mapId!=='forest')return null;
  if (!rooms.has(mapId)) {
    rooms.set(mapId, {
      mapId,
      players: new Map(), // sessionId -> {userId, joinedAt}
      hardCap: config.roomHardCap,
      startedAt: new Date().toISOString(),
    });
  }
  return rooms.get(mapId);
}

/** Dipakai Fase 3 (WS join/leave). Tidak diekspos ke REST. */
export function addPlayer(mapId, sessionId, userId) {
  const room=getRoom(mapId);if(!room)return false;
  room.players.set(sessionId, { userId, joinedAt: Date.now() });return true;
}
export function removePlayer(mapId, sessionId) {
  return getRoom(mapId)?.players.delete(sessionId)??false;
}

function roomStatus(mapId) {
  if(mapId!=='forest')return null;
  const room = getRoom(mapId);
  const world = getWorld();
  // Satu sumber kebenaran: gateway WSS (room in-memory di sana).
  // Fallback ke room registry lokal hanya jika gateway belum terpasang (test unit).
  const gw = getRealtime?.();
  const onlineCount = gw ? gw.status().online : room.players.size;
  return {
    mapId,
    name: 'Forest Purba',
    worldVersion: config.worldVersion,
    worldSeed: config.worldSeed,
    sizeMeters: world.size,
    houseCount: world.houses.length,
    poiCount: world.pois.length,
    spawnCount: world.spawns.length,
    onlineCount,
    hardCap: room.hardCap,
    available: onlineCount < room.hardCap,
    // Jujur: Fase 3 aktif — onlineCount dari gateway WSS (session join nyata).
    multiplayerActive: true,
    note: 'Angka online berasal dari session WSS yang join room forest.',
  };
}

export async function registerMapRoutes(app) {
  // Daftar peta — butuh login (prompt.md: endpoint terlindungi auth).
  app.get('/api/v1/maps', { preHandler: requireAuth }, async (_req, reply) => {
    return reply.send({ maps: [roomStatus('forest')] });
  });

  app.get('/api/v1/maps/forest/status', { preHandler: requireAuth }, async (_req, reply) => {
    return reply.send({ status: roomStatus('forest'), ...globalCounts() });
  });

  // Endpoint publik-khusus-config untuk lobby tanpa login tidak dibuat:
  // lobby memang mensyaratkan akun (guest hanya untuk Solo offline).
}
