// rng.js — PRNG deterministik. WAJIB identik di client & server
// supaya posisi pohon/rumah/loot cocok (prompt.md §3.1).
// Mulberry32: 32-bit, cepat, cukup untuk world generation.

export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** RNG ter-scope per koordinat — hasil tetap sama berapa kali pun dipanggil. */
export function rngAt(seed, x, z, salt = 0) {
  const h = hash2(seed, x | 0, z | 0, salt);
  return makeRng(h);
}

/** Hash integer 2D deterministik (tanpa Math.random). */
export function hash2(seed, x, z, salt = 0) {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (x >>> 0), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (z >>> 0), 0xc2b2ae35) >>> 0;
  h = Math.imul(h ^ (salt >>> 0), 0x27d4eb2f) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** Bilangan bulat deterministik dalam [min, max]. */
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Pilih satu elemen deterministik. */
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

/** Float deterministik dalam [a, b). */
export function randRange(rng, a, b) {
  return a + rng() * (b - a);
}
