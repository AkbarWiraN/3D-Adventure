// spawn.js — pilih titik spawn acak dari kandidat yang SUDAH divalidasi.
// prompt.md §3.1: acak dari banyak posisi aman, bukan mengacak koordinat mentah.

import { getWorld } from '../shared/world.js';
import { makeRng } from '../shared/rng.js';

let counter = 0;

/**
 * Ambil kandidat spawn.
 * @param avoid array posisi musuh/pemain lain {x,z}
 * @param minEnemyDist jarak minimal dari musuh
 */
export function randomSpawn(avoid = [], minEnemyDist = 30) {
  const world = getWorld();
  const candidates = world.spawns;
  if (!candidates.length) throw new Error('Tidak ada kandidat spawn');

  // Seed deterministik + penghitung supaya tetap bervariasi tapi dapat direproduksi saat tes.
  counter++;
  const rng = makeRng(0x53504157 ^ (counter * 2654435761));

  // Coba beberapa kali cari yang jauh dari musuh.
  for (let attempt = 0; attempt < 12; attempt++) {
    const idx = Math.floor(rng() * candidates.length);
    const c = candidates[idx];
    let tooClose = false;
    for (const a of avoid) {
      if (Math.hypot(a.x - c.x, a.z - c.z) < minEnemyDist) { tooClose = true; break; }
    }
    if (!tooClose) return c;
  }
  // Tidak ketemu yang ideal: pakai kandidat acak (tetap aman secara collider).
  return candidates[Math.floor(rng() * candidates.length)];
}

/** Untuk pengujian: reset penghitung. */
export function _resetSpawnCounter() { counter = 0; }
