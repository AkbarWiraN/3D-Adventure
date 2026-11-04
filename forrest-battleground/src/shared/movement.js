// movement.js — gerak & collision PURE, dipakai client (prediksi) & server (otoritatif).
// prompt.md §4.5 butir 2: client kirim intent, server validasi. Satu sumber aturan.

import { PLAYER, WORLD } from './constants.js';
import { terrainHeight, insideWorld } from './terrain.js';

/** Panjang vektor 3D. */
function len3(x, y, z) { return Math.hypot(x, y, z); }

/**
 * Normalisasi input gerak sehingga diagonal TIDAK lebih cepat (prompt.md §3.2).
 * moveX/moveZ adalah arah di ruang kamera (-1..1).
 */
export function normalizeMoveInput(moveX, moveZ) {
  const m = Math.hypot(moveX, moveZ);
  if (m < 1e-6) return { x: 0, z: 0 };
  const scale = m > 1 ? 1 / m : 1;   // clamp, jangan naikkan input kecil
  return { x: moveX * scale, z: moveZ * scale };
}

/** Kecepatan efektif berdasarkan state. Sprint batal saat prone (prompt.md §3.2). */
export function effectiveSpeed({ sprint = false, prone = false } = {}) {
  if (prone) return PLAYER.PRONE_SPEED;
  if (sprint) return PLAYER.SPRINT_SPEED;
  return PLAYER.WALK_SPEED;
}

/** Batas kecepatan per tick — server menolak gerak yang mustahil. */
export function maxDistancePerTick(dtSec, state = {}) {
  // Beri toleransi kecil untuk koreksi jaringan, tapi TIDAK boleh teleport.
  return effectiveSpeed(state) * dtSec * 1.15 + 0.05;
}

/** Apakah aksi sprint/jump diizinkan pada state ini. */
export function canSprint({ prone = false, dead = false } = {}) {
  return !prone && !dead;
}
export function canJump({ prone = false, dead = false } = {}) {
  return !prone && !dead;
}
export function canProne({ dead = false } = {}) {
  return !dead;
}

/**
 * Transformasi input (relatif kamera) menjadi delta dunia.
 * yaw kamera 0 => menghadap +Z.
 */
export function cameraRelativeMove(yaw, moveX, moveZ) {
  const { x: nx, z: nz } = normalizeMoveInput(moveX, moveZ);
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  // forward = (sin yaw, cos yaw), right = (cos yaw, -sin yaw)
  return {
    x: nx * cos + nz * sin,
    z: -nx * sin + nz * cos,
  };
}

// ------------------------------------------------------------- collision

/** Uji tabrakan lingkaran pemain vs OBB (dinding rumah). */
export function circleVsObb(px, pz, radius, obb) {
  const cos = Math.cos(-obb.rotY);
  const sin = Math.sin(-obb.rotY);
  const dx = px - obb.cx;
  const dz = pz - obb.cz;
  // putar ke ruang lokal OBB
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;
  // jarak ke kotak (diperluas radius pemain)
  const ex = Math.max(Math.abs(lx) - obb.hx, 0);
  const ez = Math.max(Math.abs(lz) - obb.hz, 0);
  return (ex * ex + ez * ez) < (radius * radius);
}

/** Spatial hash sederhana untuk collider (grid 32 m). */
export function buildColliderGrid(colliders, cell = WORLD.GRID_CELL) {
  const map = new Map();
  for (const c of colliders) {
    const reach = Math.max(c.hx, c.hz) + 2;
    const minX = Math.floor((c.cx - reach) / cell);
    const maxX = Math.floor((c.cx + reach) / cell);
    const minZ = Math.floor((c.cz - reach) / cell);
    const maxZ = Math.floor((c.cz + reach) / cell);
    for (let gx = minX; gx <= maxX; gx++) {
      for (let gz = minZ; gz <= maxZ; gz++) {
        const key = `${gx},${gz}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(c);
      }
    }
  }
  return { cell, map };
}

/** Kumpulkan collider di sekitar titik (broad phase). */
export function nearbyColliders(grid, x, z, radius) {
  const out = [];
  const cell = grid.cell;
  const minX = Math.floor((x - radius) / cell);
  const maxX = Math.floor((x + radius) / cell);
  const minZ = Math.floor((z - radius) / cell);
  const maxZ = Math.floor((z + radius) / cell);
  const seen = new Set();
  for (let gx = minX; gx <= maxX; gx++) {
    for (let gz = minZ; gz <= maxZ; gz++) {
      const bucket = grid.map.get(`${gx},${gz}`);
      if (!bucket) continue;
      for (const c of bucket) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        out.push(c);
      }
    }
  }
  return out;
}

/**
 * Coba gerak dengan sliding di dinding (bukan berhenti total / nyangkut).
 * Return posisi final hasil validasi.
 */
export function resolveMove(grid, fromX, fromZ, toX, toZ, radius = PLAYER.RADIUS) {
  const dist = Math.hypot(toX - fromX, toZ - fromZ);
  const nearby = nearbyColliders(grid, (fromX + toX) / 2, (fromZ + toZ) / 2, dist / 2 + radius + 2);

  // Teleport kecil / tidak ada collider -> langsung.
  if (!nearby.length) return { x: toX, z: toZ, hit: false };

  // SWEPT TEST: sample lintasan supaya tidak bisa "lompat menembus" dinding tipis.
  // Ini bug nyata yang ditemukan unit test: cek titik akhir saja tidak cukup.
  const steps = Math.max(1, Math.ceil(dist / (radius * 0.75)));
  const blockedAt = (px, pz) => nearby.some((c) => circleVsObb(px, pz, radius, c));

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (blockedAt(fromX + (toX - fromX) * t, fromZ + (toZ - fromZ) * t)) {
      // Berhenti tepat sebelum titik tabrakan pertama, lalu coba sliding per-sumbu.
      const safeT = Math.max(0, (i - 1) / steps);
      const sx = fromX + (toX - fromX) * safeT;
      const sz = fromZ + (toZ - fromZ) * safeT;

      // Sliding: hanya sumbu X atau hanya sumbu Z dari posisi aman.
      const slideXBlocked = blockedAt(sx + (toX - fromX) / steps, sz);
      const slideZBlocked = blockedAt(sx, sz + (toZ - fromZ) / steps);
      if (!slideXBlocked) return { x: sx + (toX - fromX) / steps, z: sz, hit: true };
      if (!slideZBlocked) return { x: sx, z: sz + (toZ - fromZ) / steps, hit: true };
      return { x: sx, z: sz, hit: true };
    }
  }
  return { x: toX, z: toZ, hit: false };
}

/** Jaga pemain di dalam batas dunia (tidak bisa lolos via glitch). */
export function clampToWorld(x, z, margin = WORLD.BOUNDARY_MARGIN) {
  const lim = WORLD.HALF - margin;
  return { x: Math.max(-lim, Math.min(lim, x)), z: Math.max(-lim, Math.min(lim, z)) };
}

/** Posisi Y pemain mengikuti terrain. */
export function groundY(x, z, seed = WORLD.SEED) {
  return terrainHeight(x, z, seed);
}

/** Validasi satu langkah gerak (server-side anti-teleport). */
export function validateStep(from, to, dtSec, state = {}) {
  // Batas dunia diperiksa LEBIH DULU: keluar map selalu ditolak apa pun jaraknya.
  if (!insideWorld(to.x, to.z)) return { ok: false, reason: 'OUT_OF_BOUNDS' };
  const maxD = maxDistancePerTick(dtSec, state);
  const d = len3(to.x - from.x, to.y - from.y, to.z - from.z);
  if (d > maxD + 0.001) return { ok: false, reason: 'TOO_FAR', distance: d, max: maxD };
  return { ok: true };
}
