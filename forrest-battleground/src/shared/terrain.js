// terrain.js — heightfield deterministik 1024x1024 m. Shared client+server.
// Tujuan: undulasi ringan, TIDAK ada jurang/bukit yang memutus akses (prompt.md §3.1).
// Implementasi: nilai noise murah berbasis hash + interpolasi smoothstep,
// bukan library eksternal (tidak ada dependency).

import { hash2 } from './rng.js';
import { WORLD } from './constants.js';

const LATTICE = 128;          // sel noise (m) — makin besar makin landai
const MAX_HEIGHT = 7.5;       // amplitudo total (m) — sengaja rendah
const FRICTION = 1;           // kemiringan maksimum praktis dijaga oleh amplitudo rendah

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

/** Nilai noise pada titik lattice (deterministik penuh). */
function latticeValue(seed, ix, iz) {
  const h = hash2(seed, ix, iz, 0x7e11);
  return (h % 10000) / 10000; // 0..1
}

/** Value noise 2D dengan interpolasi bikubik sederhana. */
function valueNoise(seed, x, z) {
  const fx = x / LATTICE;
  const fz = z / LATTICE;
  const ix = Math.floor(fx);
  const iz = Math.floor(fz);
  const tx = smoothstep(fx - ix);
  const tz = smoothstep(fz - iz);

  const v00 = latticeValue(seed, ix, iz);
  const v10 = latticeValue(seed, ix + 1, iz);
  const v01 = latticeValue(seed, ix, iz + 1);
  const v11 = latticeValue(seed, ix + 1, iz + 1);

  const a = v00 + (v10 - v00) * tx;
  const b = v01 + (v11 - v01) * tx;
  return a + (b - a) * tz;
}

/**
 * Tinggi terrain (meter) di koordinat dunia. PURE & deterministik.
 * Dijaga landai: dua oktaf nilai noise, amplitudo kecil, tanpa ridge.
 */
export function terrainHeight(x, z, seed = WORLD.SEED) {
  const n1 = valueNoise(seed, x, z);                      // fitur besar
  const n2 = valueNoise(seed * 31 + 7, x * 2.7, z * 2.7); // detail halus
  const h = (n1 - 0.5) * 2 * (MAX_HEIGHT * 0.75) + (n2 - 0.5) * 2 * (MAX_HEIGHT * 0.25);
  return h;
}

/** Normal permukaan (untuk menaruh objek rata dengan tanah). */
export function terrainNormal(x, z, seed = WORLD.SEED, eps = 0.75) {
  const hL = terrainHeight(x - eps, z, seed);
  const hR = terrainHeight(x + eps, z, seed);
  const hD = terrainHeight(x, z - eps, seed);
  const hU = terrainHeight(x, z + eps, seed);
  const nx = hL - hR;
  const nz = hD - hU;
  const ny = 2 * eps;
  const len = Math.hypot(nx, ny, nz) || 1;
  return { x: nx / len, y: ny / len, z: nz / len };
}

/** Kemiringan 0..1 (0 datar). Dipakai untuk validasi spawn. */
export function terrainSlope(x, z, seed = WORLD.SEED) {
  const n = terrainNormal(x, z, seed);
  return Math.min(1, Math.acos(Math.max(-1, Math.min(1, n.y))) / (Math.PI / 2));
}

/** Apakah koordinat berada di dalam batas main (dengan margin). */
export function insideWorld(x, z, margin = WORLD.BOUNDARY_MARGIN) {
  const lim = WORLD.HALF - margin;
  return x >= -lim && x <= lim && z >= -lim && z <= lim;
}

/**
 * Tinggi terrain pada grid chunk — dipakai untuk membuat mesh.
 * Output: Float32Array berukuran (segs+1)^2.
 */
export function buildChunkHeights(chunkX, chunkZ, segs, seed = WORLD.SEED) {
  const size = WORLD.CHUNK_SIZE;
  const step = size / segs;
  const originX = chunkX * size;
  const originZ = chunkZ * size;
  const out = new Float32Array((segs + 1) * (segs + 1));
  let i = 0;
  for (let gz = 0; gz <= segs; gz++) {
    for (let gx = 0; gx <= segs; gx++) {
      out[i++] = terrainHeight(originX + gx * step, originZ + gz * step, seed);
    }
  }
  return out;
}
