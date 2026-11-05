// world.js — skema dunia deterministik: rumah, POI, spawn, loot, collider.
// PURE. Dipakai client (render) DAN server (collision authoritative).
// prompt.md §3.1: >=12 rumah, >=8 POI non-rumah, >=40 spawn candidate valid.

import { hash2, makeRng, randInt, randRange, pick } from './rng.js';
import { terrainHeight, terrainSlope, insideWorld } from './terrain.js';
import { WORLD, SPAWN } from './constants.js';

const SEED = WORLD.SEED;

/** Konvensi: x -> timur, z -> selatan, y -> atas (three.js). */

// ---------------------------------------------------------------- rumah/gubuk
export const HOUSE_TYPES = Object.freeze([
  Object.freeze({ type: 'hut',        w: 4.5, d: 4.5, wallH: 2.4, door: 1.2 }), // gubuk kecil
  Object.freeze({ type: 'cabin',      w: 6.0, d: 5.0, wallH: 2.7, door: 1.3 }), // rumah kayu
  Object.freeze({ type: 'longhouse',  w: 7.5, d: 4.0, wallH: 2.9, door: 1.4 }), // rumah panjang
  Object.freeze({ type: 'ruin_house', w: 5.5, d: 5.5, wallH: 1.8, door: 1.6 }), // dinding rendah
]);

// ------------------------------------------------------------------- POI non-rumah
export const POI_TYPES = Object.freeze([
  'ruins',      // reruntuhan batu
  'camp',       // perkemahan
  'shrine',     // altar batu
  'watchtower', // menara pengawas (kaki terbuka)
  'stonecircle',// lingkaran batu
  'woodpile',   // tumpukan kayu
  'clearing',   // lapangan terbuka dengan sisa api unggun
  'graveyard',  // batu nisan
]);

/**
 * Cari posisi datar & di dalam batas dunia.
 * Menghindari tepi map, lereng curam, dan (opsional) posisi yang sudah ada.
 */
function findFlatSpot(rng, { minSlope = 0.14, tries = 60, avoid = [], minDist = 18 } = {}) {
  const lim = WORLD.HALF - 60;
  for (let t = 0; t < tries; t++) {
    const x = randRange(rng, -lim, lim);
    const z = randRange(rng, -lim, lim);
    if (!insideWorld(x, z, 60)) continue;
    if (terrainSlope(x, z) > minSlope) continue;
    let clash = false;
    for (const p of avoid) {
      if (Math.hypot(p.x - x, p.z - z) < minDist) { clash = true; break; }
    }
    if (clash) continue;
    return { x, z, y: terrainHeight(x, z) };
  }
  return null;
}

/** Bangun daftar rumah deterministik (>=12). */
export function buildHouses() {
  const rng = makeRng(SEED ^ 0x484f5553);
  const houses = [];
  const target = 14; // >12 untuk margin
  let guard = 0;
  while (houses.length < target && guard++ < 4000) {
    const spot = findFlatSpot(rng, { avoid: houses, minDist: 45 });
    if (!spot) continue;
    const def = HOUSE_TYPES[randInt(rng, 0, HOUSE_TYPES.length - 1)];
    houses.push({
      id: `house-${String(houses.length + 1).padStart(2, '0')}`,
      kind: 'house',
      type: def.type,
      x: spot.x,
      y: spot.y,
      z: spot.z,
      rotY: randRange(rng, 0, Math.PI * 2),
      w: def.w,
      d: def.d,
      wallH: def.wallH,
      door: def.door,
      enterable: true, // Fase 1: bisa dimasuki (bukaan pintu, tanpa atap penuh di dalam)
    });
  }
  return houses;
}

/** Bangun POI non-rumah (>=8), tersebar. */
export function buildPois() {
  const rng = makeRng(SEED ^ 0x504f4921);
  const used = buildHouses(); // jaga agar POI tidak menimpa rumah
  const pois = [];
  const target = 10; // >8 untuk margin
  let guard = 0;
  const types = [...POI_TYPES];
  while (pois.length < target && guard++ < 4000) {
    const spot = findFlatSpot(rng, { avoid: [...used, ...pois], minDist: 40 });
    if (!spot) continue;
    // Setiap tipe dipakai bergilir supaya beragam.
    const type = types[pois.length % types.length];
    pois.push({
      id: `poi-${String(pois.length + 1).padStart(2, '0')}`,
      kind: 'poi',
      type,
      x: spot.x,
      y: spot.y,
      z: spot.z,
      rotY: randRange(rng, 0, Math.PI * 2),
      radius: randRange(rng, 3, 6),
    });
  }
  return pois;
}

/**
 * Kandidat spawn: divalidasi datar, di dalam batas, tidak di dalam bangunan,
 * jarak minim dari POI/house. prompt.md §3.1 & SPAWN.MIN_CANDIDATES.
 */
export function buildSpawnCandidates() {
  const rng = makeRng(SEED ^ 0x53504157);
  // Batu besar kini punya collider → kandidat spawn tidak boleh di dalamnya.
  const structure = [...buildHouses(), ...buildPois(), ...buildLargeRocks()];
  const out = [];
  let guard = 0;
  while (out.length < 48 && guard++ < 20000) { // target 48 > 40
    const x = randRange(rng, -(WORLD.HALF - 50), WORLD.HALF - 50);
    const z = randRange(rng, -(WORLD.HALF - 50), WORLD.HALF - 50);
    if (!insideWorld(x, z, 50)) continue;
    if (terrainSlope(x, z) > 0.12) continue; // hanya tempat landai
    let blocked = false;
    for (const s of structure) {
      const r = s.kind === 'house' ? Math.max(s.w, s.d) / 2 + 3
        : s.kind === 'rock' ? s.scale + 2
          : s.radius + 4;
      if (Math.hypot(s.x - x, s.z - z) < r) { blocked = true; break; }
    }
    if (blocked) continue;
    out.push({ id: `spawn-${String(out.length + 1).padStart(2, '0')}`, x, y: terrainHeight(x, z), z });
  }
  return out;
}

/**
 * Titik loot: di dalam/di sekitar rumah & POI. Tiap titik punya ID stabil.
 * Fase 1 hanya menyiapkan datanya (belum ada pickup — itu Fase 2).
 */
export function buildLootHotspots() {
  const houses = buildHouses();
  const pois = buildPois();
  const rng = makeRng(SEED ^ 0x4c4f4f54);
  const spots = [];

  // 2 titik per rumah (dalam ruang gerak) + 1 titik per POI.
  for (const h of houses) {
    for (let i = 0; i < 2; i++) {
      const ang = rng() * Math.PI * 2;
      const rad = randRange(rng, 0, Math.max(0.8, Math.min(h.w, h.d) / 2 - 0.9));
      const x = h.x + Math.cos(ang) * rad;
      const z = h.z + Math.sin(ang) * rad;
      spots.push({ id: `loot-${h.id}-${i + 1}`, kind: 'house', x, y: terrainHeight(x, z) + 0.15, z });
    }
  }
  for (const p of pois) {
    const ang = rng() * Math.PI * 2;
    const rad = randRange(rng, 1.0, Math.max(1.2, p.radius - 1.0));
    const x = p.x + Math.cos(ang) * rad;
    const z = p.z + Math.sin(ang) * rad;
    spots.push({ id: `loot-${p.id}`, kind: 'poi', x, y: terrainHeight(x, z) + 0.15, z });
  }
  return spots;
}

/**
 * Collider padat (AABB 2D + tinggi) untuk server & client — SATU sumber.
 * Hanya objek besar yang menghalangi (prompt.md §3.1: rumput kecil tanpa collider).
 */
export function buildColliders() {
  const out = [];
  for (const h of buildHouses()) {
    const halfW = h.w / 2;
    const halfD = h.d / 2;
    const cos = Math.cos(h.rotY);
    const sin = Math.sin(h.rotY);
    // Dinding depan (side 's') punya BUKAAN PINTU seperti mesh di buildings.js:
    // dibuat 2 segmen, bukan satu blok penuh. Versi lama satu blok → collider
    // menutup pintu sehingga rumah TIDAK BISA dimasuki (laporan pemain).
    const t = 0.25; // ketebalan dinding
    const frontHalf = (h.w - h.door) / 2;
    const walls = [
      { ox: 0, oz: -halfD, sx: halfW, sz: t, side: 'n' },
      { ox: -halfW, oz: 0, sx: t, sz: halfD, side: 'w' },
      { ox: halfW, oz: 0, sx: t, sz: halfD, side: 'e' },
      // Segmen kiri & kanan pintu (hx = SETENGAH lebar segmen, konsisten dgn
      // dinding lain). Sisi depan = +halfD (sama seperti mesh pintu).
      { ox: -(h.door / 2 + frontHalf / 2), oz: halfD, sx: frontHalf / 2, sz: t, side: 'sw' },
      { ox: (h.door / 2 + frontHalf / 2), oz: halfD, sx: frontHalf / 2, sz: t, side: 'se' },
    ];
    for (const w of walls) {
      const wx = h.x + (w.ox * cos - w.oz * sin);
      const wz = h.z + (w.ox * sin + w.oz * cos);
      out.push({
        id: `${h.id}-${w.side}`,
        shape: 'obb',
        cx: wx, cz: wz,
        hx: w.sx, hz: w.sz,
        rotY: h.rotY,
        y: h.y, h: h.wallH,
        solid: true,
      });
    }
  }
  return out;
}

// ------------------------------------------------------- batu besar & jalan setapak
/**
 * Batu besar (≥3 varian ukuran dari geometri yang sama: besar/sedang/kecil sudah
 * ada di vegetasi; ini yang punya collider). Deterministik, menghindari rumah/POI.
 */
export function buildLargeRocks() {
  const rng = makeRng(SEED ^ 0x524f434b);
  const avoid = [...buildHouses(), ...buildPois()];
  const rocks = [];
  let guard = 0;
  while (rocks.length < 18 && guard++ < 4000) {
    const spot = findFlatSpot(rng, { minSlope: 0.2, avoid: [...avoid, ...rocks], minDist: 22 });
    if (!spot) continue;
    rocks.push({
      id: `rock-${String(rocks.length + 1).padStart(2, '0')}`,
      kind: 'rock',
      x: spot.x,
      y: spot.y,
      z: spot.z,
      scale: randRange(rng, 1.6, 4.2),
      rotY: randRange(rng, 0, Math.PI * 2),
    });
  }
  return rocks;
}

/**
 * Jalan setapak: rantai segmen antar struktur terdekat (bukan grid jalan penuh).
 * PURE & deterministik — dipakai terrain (pewarnaan tanah) dan bisa dipakai server.
 * Mengembalikan daftar segmen garis {ax,az,bx,bz,width}.
 */
export function buildPaths() {
  const nodes = [...buildHouses(), ...buildPois()];
  // Urutkan deterministik lalu sambungkan berurutan: jaringan jalan sederhana
  // yang mudah dibaca pemain tanpa algoritma graph (cukup untuk MVP).
  const sorted = [...nodes].sort((a, b) => (a.x - b.x) || (a.z - b.z));
  const segs = [];
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1];
    const b = sorted[i];
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    if (d < 20 || d > 300) continue; // terlalu dekat/terlalu jauh: bukan jalan
    segs.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, width: 3.0 });
  }
  return segs;
}

/** Jarak titik ke segmen jalan terdekat (meter). Dipakai pewarnaan terrain. */
export function distanceToPath(x, z, segs) {
  let best = Infinity;
  for (const s of segs) {
    const dx = s.bx - s.ax;
    const dz = s.bz - s.az;
    const len2 = dx * dx + dz * dz;
    let t = len2 > 0 ? ((x - s.ax) * dx + (z - s.az) * dz) / len2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = s.ax + t * dx;
    const pz = s.az + t * dz;
    const d = Math.hypot(x - px, z - pz);
    if (d < best) best = d;
  }
  return best;
}

/** Snapshot dunia lengkap (deterministik). Cache di pemanggil. */
let _cache = null;
export function getWorld() {
  if (_cache) return _cache;
  const houses = buildHouses();
  const pois = buildPois();
  const spawns = buildSpawnCandidates();
  const loot = buildLootHotspots();
  const colliders = buildColliders();
  const largeRocks = buildLargeRocks();
  const paths = buildPaths();
  // Batu besar ikut jadi collider (spec: benda besar punya collision).
  for (const r of largeRocks) {
    colliders.push({
      id: r.id,
      shape: 'obb',
      cx: r.x, cz: r.z,
      hx: r.scale * 0.75, hz: r.scale * 0.75,
      rotY: 0,
      y: r.y, h: r.scale * 1.5,
      solid: true,
    });
  }
  _cache = {
    seed: SEED,
    version: WORLD.VERSION,
    size: WORLD.SIZE,
    chunkSize: WORLD.CHUNK_SIZE,
    houses,
    pois,
    spawns,
    loot,
    colliders,
    largeRocks,
    paths,
  };
  return _cache;
}

/** Validasi internal dunia — dipakai test, bukan hanya di produksi. */
export function validateWorld(world = getWorld()) {
  const problems = [];
  if (world.houses.length < 12) problems.push(`rumah ${world.houses.length} < 12`);
  if (world.pois.length < 8) problems.push(`POI ${world.pois.length} < 8`);
  if (world.spawns.length < SPAWN.MIN_CANDIDATES) problems.push(`spawn ${world.spawns.length} < ${SPAWN.MIN_CANDIDATES}`);
  for (const s of world.spawns) {
    if (!insideWorld(s.x, s.z, 24)) problems.push(`${s.id} di luar batas`);
    if (terrainSlope(s.x, s.z) > 0.16) problems.push(`${s.id} lereng terlalu curam`);
    for (const h of world.houses) {
      const r = Math.max(h.w, h.d) / 2;
      if (Math.hypot(h.x - s.x, h.z - s.z) < r) problems.push(`${s.id} di dalam ${h.id}`);
    }
  }
  const emptyLoot = world.loot.filter((l) => !l.id);
  if (emptyLoot.length) problems.push(`${emptyLoot.length} loot tanpa ID stabil`);
  return problems;
}
