// constants.js — parameter gameplay tetap. HARUS identik client & server.
// prompt.md §1.2: parameter harus configurable, bukan tersebar hard-coded.

export const PROTOCOL_VERSION = 1;
export const MAP_ID = 'forest';

export const WORLD = Object.freeze({
  SEED: 20261104,
  VERSION: 'forest-v1',
  SIZE: 1024,          // meter (1024 x 1024)
  CHUNK_SIZE: 64,      // meter
  ACTIVE_RING: 2,      // ring chunk aktif di sekitar kamera
  HALF: 512,           // setengah ukuran dunia
  BOUNDARY_MARGIN: 24, // pemain tidak boleh lebih dekat dari ini ke tepi
  GRID_CELL: 32,       // spatial hash server (meter)
});

export const PLAYER = Object.freeze({
  HP_MAX: 100,
  RADIUS: 0.45,        // kapsul aproximasi
  HEIGHT: 1.8,
  WALK_SPEED: 3.6,     // m/s
  SPRINT_SPEED: 6.4,
  PRONE_SPEED: 1.2,
  JUMP_SPEED: 5.2,
  GRAVITY: -18.0,
  RESPAWN_INVULN_MS: 2000,
});

export const WEAPONS = Object.freeze({
  unarmed: Object.freeze({ id: 'unarmed', slotId: null, damage: 20, range: 1.6, cooldownMs: 700, ammo: false }),
  sword:   Object.freeze({ id: 'sword',   slotId: 'sword', damage: 20, range: 3.0, cooldownMs: 800, ammo: false }),
  bow:     Object.freeze({ id: 'bow',     slotId: 'bow',   damage: 20, range: 10.0, cooldownMs: 1400, ammo: true }),
  thrown:  Object.freeze({ id: 'thrown',  slotId: null,    damage: 20, range: 8.0, cooldownMs: 900, ammo: false }),
});

export const COMBAT = Object.freeze({
  DAMAGE_PER_HIT: 20,
  HITS_TO_KILL: 5,
  RESPAWN_DELAY_MS: 3000,
  COMBAT_LOGOUT_SECONDS: 10,
});

export const LOOT = Object.freeze({
  PICKUP_RANGE: 2.5,
  INVENTORY_SLOTS: 2,
  BOW_START_ARROWS: 10,
  // Respawn loot: server-authoritative (prompt.md §1.2 "Loot respawn 45-90 detik").
  RESPAWN_MIN_MS: 45000,
  RESPAWN_MAX_MS: 90000,
});

export const NETWORK = Object.freeze({
  TICK_HZ: 20,
  SNAPSHOT_HZ: 10,
  ENEMY_MAP_HZ: 2,
  AOI_RADIUS: 150,
  MAX_FRAME_BYTES: 16 * 1024,
  MAX_INPUT_PER_SEC: 20,
  MAX_ATTACK_PER_SEC: 50,
  AUTH_TIMEOUT_MS: 5000,
  ROOM_HARD_CAP: 8,
});

export const SPAWN = Object.freeze({
  MIN_CANDIDATES: 40,
  MIN_ENEMY_DISTANCE: 30,
  MIN_POI_DISTANCE: 12,  // jangan spawn di dalam bangunan
});

/** Origin frontend yang sah di production (tanpa slash, tanpa path). */
export const TRUSTED_ORIGIN = 'https://akbarwiran.github.io';
