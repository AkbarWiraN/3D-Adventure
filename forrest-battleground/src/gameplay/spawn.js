// spawn.js — pilih titik spawn acak dari kandidat yang SUDAH divalidasi.
// prompt.md §3.1: acak dari banyak posisi aman, bukan mengacak koordinat mentah.

import { getWorld } from '../shared/world.js';
import { makeRng } from '../shared/rng.js';

let counter = 0;

/**
 * Ambil kandidat spawn.
 * @param avoid array posisi musuh/pemain lain {x,z}
 * @param minEnemyDist jarak minimal dari musuh
 * @param opts.skipRingAdvance true => JANGAN majukan ring (dipakai Solo saat
 *        start agar spawn identik dengan respawn pertama).
 */
export function randomSpawn(avoid = [], minEnemyDist = 30, opts = {}) {
  const world = getWorld();
  // Spawn Solo diacak DARI RING: kandidat diurutkan jarak ke pusat, dibagi
  // ring 32 m (pusat=0), lalu ring dipilih bergiliran deterministik. Tanpa ini
  // spawn acak bisa jatuh di pinggir peta -> ring chunk aktif terpotong batas
  // -> jumlah chunk/objek scene berubah antar sesi (flake leak-20x-check).
  let candidates = world.spawns;
  if (!avoid.length) {
    const ringOf = (s) => Math.min(14, Math.floor(Math.hypot(s.x, s.z) / 32));
    const sorted = [...candidates].sort((a, b) => ringOf(a) - ringOf(b));
    const ring = opts.skipRingAdvance ? 0 : (counter % 15);
    const inRing = sorted.filter((s) => ringOf(s) === ring);
    if (inRing.length) candidates = inRing;
  }
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
