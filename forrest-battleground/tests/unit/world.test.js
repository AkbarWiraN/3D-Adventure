// world.test.js — unit test PURE rules (prompt.md §5.3).
// Tidak butuh browser/server; menguji aturan yang dipakai keduanya.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { makeRng, hash2 } from '../../src/shared/rng.js';
import { terrainHeight, terrainSlope, insideWorld } from '../../src/shared/terrain.js';
import { getWorld, validateWorld, buildHouses, buildPois, buildSpawnCandidates } from '../../src/shared/world.js';
import {
  normalizeMoveInput, effectiveSpeed, canSprint, canJump, canProne,
  cameraRelativeMove, circleVsObb, buildColliderGrid, resolveMove,
  clampToWorld, validateStep, maxDistancePerTick, nearbyColliders,
} from '../../src/shared/movement.js';
import { WORLD, PLAYER, SPAWN, WEAPONS, COMBAT } from '../../src/shared/constants.js';

// ------------------------------------------------------------------- RNG
test('RNG deterministik: seed sama -> urutan sama', () => {
  const a = makeRng(1234);
  const b = makeRng(1234);
  for (let i = 0; i < 20; i++) assert.equal(a(), b());
});

test('hash2 stabil dan berbeda untuk koordinat berbeda', () => {
  assert.equal(hash2(1, 2, 3), hash2(1, 2, 3));
  assert.notEqual(hash2(1, 2, 3), hash2(1, 2, 4));
});

// --------------------------------------------------------------- terrain
test('terrain deterministik & landai (amplitudo terbatas)', () => {
  for (const [x, z] of [[0, 0], [100, -200], [-400, 300], [511, 511]]) {
    assert.equal(terrainHeight(x, z), terrainHeight(x, z));
    assert.ok(Math.abs(terrainHeight(x, z)) <= 8, 'tinggi harus dalam ±8 m');
    assert.ok(terrainSlope(x, z) <= 0.35, 'lereng harus landai');
  }
});

test('insideWorld menolak koordinat di luar batas', () => {
  assert.equal(insideWorld(0, 0), true);
  assert.equal(insideWorld(WORLD.HALF, 0), false);
  assert.equal(insideWorld(0, -WORLD.HALF), false);
});

// ----------------------------------------------------------------- dunia
test('dunia memenuhi syarat minimum spesifikasi', () => {
  const w = getWorld();
  assert.ok(w.houses.length >= 12, `rumah ${w.houses.length} < 12`);
  assert.ok(w.pois.length >= 8, `POI ${w.pois.length} < 8`);
  assert.ok(w.spawns.length >= SPAWN.MIN_CANDIDATES, `spawn ${w.spawns.length}`);
  assert.ok(w.loot.length > 0);
  assert.ok(w.colliders.length > 0);
});

test('validateWorld tidak menemukan masalah (spawn tidak di dalam bangunan/lereng)', () => {
  assert.deepEqual(validateWorld(), []);
});

test('world generation deterministik antar pemanggilan', () => {
  const a = buildHouses();
  const b = buildHouses();
  assert.deepEqual(a.map((h) => [h.id, h.x, h.z]), b.map((h) => [h.id, h.x, h.z]));
  const p1 = buildPois();
  const p2 = buildPois();
  assert.deepEqual(p1.map((p) => p.id), p2.map((p) => p.id));
  const s1 = buildSpawnCandidates();
  const s2 = buildSpawnCandidates();
  assert.deepEqual(s1.map((s) => s.x), s2.map((s) => s.x));
});

test('setiap rumah punya ID stabil unik & dapat dimasuki', () => {
  const houses = getWorld().houses;
  const ids = new Set(houses.map((h) => h.id));
  assert.equal(ids.size, houses.length);
  for (const h of houses) assert.equal(h.enterable, true);
});

// --------------------------------------------------------------- movement
test('input diagonal tidak lebih cepat dari lurus', () => {
  const straight = normalizeMoveInput(0, 1);
  const diag = normalizeMoveInput(1, 1);
  assert.ok(Math.hypot(diag.x, diag.z) <= 1.0001);
  assert.ok(Math.abs(Math.hypot(diag.x, diag.z) - 1) < 1e-6);
  assert.equal(Math.hypot(straight.x, straight.z), 1);
});

test('input nol tetap nol', () => {
  const r = normalizeMoveInput(0, 0);
  assert.deepEqual(r, { x: 0, z: 0 });
});

test('sprint lebih cepat dari jalan; prone paling lambat', () => {
  assert.ok(effectiveSpeed({ sprint: true }) > effectiveSpeed({}));
  assert.ok(effectiveSpeed({ prone: true }) < effectiveSpeed({}));
});

test('sprint & jump diblok saat prone atau mati', () => {
  assert.equal(canSprint({ prone: true }), false);
  assert.equal(canJump({ prone: true }), false);
  assert.equal(canSprint({ dead: true }), false);
  assert.equal(canSprint({}), true);
  assert.equal(canJump({}), true);
});

test('prone diblok saat mati', () => {
  assert.equal(canProne({ dead: true }), false);
  assert.equal(canProne({}), true);
});

test('cameraRelativeMove: yaw 0 + maju => +Z', () => {
  const m = cameraRelativeMove(0, 0, 1);
  assert.ok(Math.abs(m.x) < 1e-9);
  assert.ok(Math.abs(m.z - 1) < 1e-9);
});

test('cameraRelativeMove: yaw 90deg + maju => +X', () => {
  const m = cameraRelativeMove(Math.PI / 2, 0, 1);
  assert.ok(Math.abs(m.x - 1) < 1e-9);
  assert.ok(Math.abs(m.z) < 1e-9);
});

// Arah STRAFE: kesalahan tanda di sini bikin joystick terasa kebalik di layar.
// Patokan geometri (bukan selera): kamera berdiri di belakang pemain
// (camPos = focus − forward·dist) dan menghadap +forward. Di ruang tangan-kanan,
// right × up = −forward, sehingga right = (−cos yaw, +sin yaw).
// yaw=0 → forward +Z → KANAN LAYAR = −X.
test('cameraRelativeMove: geser KANAN (moveX>0) => −X saat yaw=0 (kanan layar)', () => {
  const m = cameraRelativeMove(0, 1, 0);
  assert.ok(Math.abs(m.x + 1) < 1e-9, `x=${m.x} harus −1 (kanan layar saat hadap +Z)`);
  assert.ok(Math.abs(m.z) < 1e-9);
});

test('cameraRelativeMove: geser KIRI (moveX<0) => +X saat yaw=0', () => {
  const m = cameraRelativeMove(0, -1, 0);
  assert.ok(Math.abs(m.x - 1) < 1e-9, `x=${m.x} harus +1`);
});

test('cameraRelativeMove: hadap +X (yaw 90deg), geser kanan => +Z', () => {
  const m = cameraRelativeMove(Math.PI / 2, 1, 0);
  assert.ok(Math.abs(m.z - 1) < 1e-9, `z=${m.z} harus +1`);
});

// --------------------------------------------------------------- collision
test('circleVsObb mendeteksi tabrakan dan jarak aman', () => {
  const wall = { id: 'w', cx: 0, cz: 0, hx: 2, hz: 0.25, rotY: 0 };
  assert.equal(circleVsObb(0, 0, PLAYER.RADIUS, wall), true, 'di tengah dinding');
  assert.equal(circleVsObb(0, 3, PLAYER.RADIUS, wall), false, 'jauh dari dinding');
});

test('OBB berotasi tetap mendeteksi tabrakan', () => {
  const wall = { id: 'w', cx: 0, cz: 0, hx: 2, hz: 0.25, rotY: Math.PI / 2 };
  // setelah rotasi 90°, dinding memanjang di sumbu Z
  assert.equal(circleVsObb(0, 1.5, PLAYER.RADIUS, wall), true);
  assert.equal(circleVsObb(3, 0, PLAYER.RADIUS, wall), false);
});

test('collider grid menemukan collider di sekitar titik', () => {
  const grid = buildColliderGrid(getWorld().colliders);
  const house = getWorld().houses[0];
  const found = grid.map.get(`${Math.floor(house.x / WORLD.GRID_CELL)},${Math.floor(house.z / WORLD.GRID_CELL)}`);
  assert.ok(found && found.length > 0, 'minimal satu collider di sel rumah');
});

// Bug nyata (laporan pemain): dinding depan dibuat satu blok penuh di collider
// sehingga pintu tidak bisa dilewati. Harus: semua rumah dapat dimasuki lewat
// bukaan pintu (mesh sudah punya gap, collider ikut).
test('SEMUA rumah bisa dimasuki lewat pintu (collider tidak menutup)', () => {
  const world = getWorld();
  const grid = buildColliderGrid(world.colliders);
  const blockedAt = (x, z) => nearbyColliders(grid, x, z, PLAYER.RADIUS)
    .some((c) => circleVsObb(x, z, PLAYER.RADIUS, c));
  let ok = 0;
  const gagal = [];
  for (const h of world.houses) {
    const cos = Math.cos(h.rotY), sin = Math.sin(h.rotY);
    // rintis garis dari luar (t=-2) ke dalam (t=+2) lewat tengah pintu
    let masuk = false;
    for (let t = -2; t <= 2; t += 0.2) {
      const px = h.x - (h.d / 2 + t) * sin;
      const pz = h.z + (h.d / 2 + t) * cos;
      if (!blockedAt(px, pz) && t > 0.2) { masuk = true; break; }
    }
    if (masuk) ok++; else gagal.push(h.id);
  }
  assert.equal(gagal.length, 0, `tertutup: ${gagal.join(', ')}`);
  assert.ok(ok === world.houses.length, `masuk ${ok}/${world.houses.length}`);
});

test('resolveMove menolak menembus dinding tapi tetap bisa bergerak', () => {
  const grid = buildColliderGrid(getWorld().colliders);
  const wall = { id: 'w1', cx: 0, cz: 0, hx: 3, hz: 0.3, rotY: 0 };
  const g2 = buildColliderGrid([wall]);
  // dari z=-2 mencoba ke z=+2 (menembus dinding)
  const blocked = resolveMove(g2, 0, -2, 0, 2, 0.45);
  assert.ok(blocked.hit === true, 'tabrakan terdeteksi');
  assert.ok(Math.abs(blocked.z) < 2, 'tidak sampai menembus');
});

test('clampToWorld menahan pemain di dalam batas', () => {
  const c = clampToWorld(WORLD.HALF + 500, -WORLD.HALF - 500);
  assert.ok(insideWorld(c.x, c.z));
});

// ----------------------------------------------------- anti-teleport server
test('validateStep menolak lompatan melampaui kecepatan maksimum', () => {
  const dt = 1 / 20;
  const from = { x: 0, y: 0, z: 0 };
  const sprintMax = maxDistancePerTick(dt, { sprint: true });
  // lompatan 50 m dalam satu tick = curang
  const bad = validateStep(from, { x: 50, y: 0, z: 0 }, dt, { sprint: true });
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, 'TOO_FAR');
  // langkah wajar
  const good = validateStep(from, { x: sprintMax * 0.5, y: 0, z: 0 }, dt, { sprint: true });
  assert.equal(good.ok, true);
});

test('validateStep menolak keluar batas dunia', () => {
  const dt = 1 / 20;
  const r = validateStep({ x: 0, y: 0, z: 0 }, { x: WORLD.HALF + 10, y: 0, z: 0 }, dt * 1000, {});
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'OUT_OF_BOUNDS');
});

// ------------------------------------------------------------- konstanta
test('damage 20 & 5 hit mematikan (tanpa armor)', () => {
  assert.equal(WEAPONS.unarmed.damage, 20);
  assert.equal(WEAPONS.sword.damage, 20);
  assert.equal(WEAPONS.bow.damage, 20);
  assert.equal(WEAPONS.thrown.damage, 20);
  assert.equal(PLAYER.HP_MAX / COMBAT.DAMAGE_PER_HIT, 5);
  assert.equal(COMBAT.HITS_TO_KILL, 5);
});

test('range senjata sesuai spesifikasi', () => {
  assert.equal(WEAPONS.unarmed.range, 1.6);
  assert.equal(WEAPONS.sword.range, 3.0);
  assert.equal(WEAPONS.bow.range, 10.0);
  assert.equal(WEAPONS.thrown.range, 8.0);
});
