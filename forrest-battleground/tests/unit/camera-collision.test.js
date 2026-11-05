// camera-collision.test.js — kamera tidak boleh tembus dinding/batu (prompt.md §3.2).
// Murni & deterministik: clampCameraAgainstColliders + world nyata.
// (Rig penuh butuh three.js yang hanya ada sebagai import map browser.)
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getWorld } from '../../src/shared/world.js';
import {
  buildColliderGrid, nearbyColliders, circleVsObb, clampCameraAgainstColliders,
} from '../../src/shared/movement.js';
import { CONFIG } from '../../src/config.js';

const world = getWorld();
const grid = buildColliderGrid(world.colliders);
const CAM_DIST = CONFIG.camera.distance;
const PLAYER_R = 0.45; // CONFIG.camera.collideRadius

/** Ada collider yang menutupi titik ini? (toleransi kecil) */
const insideAny = (x, z, r = 0.05) =>
  nearbyColliders(grid, x, z, r + 1).some((c) => circleVsObb(x, z, r, c));

/** Kumpulkan titik berdiri yang MEMANG boleh diduduki pemain. */
function standingSpots() {
  const out = [];
  for (const s of world.spawns || []) out.push({ x: s.x, z: s.z, tag: 'spawn' });
  for (const h of world.houses || []) {
    for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      for (const d of [3.5, 4.5]) {
        const x = h.x + Math.sin(a) * d;
        const z = h.z + Math.cos(a) * d;
        if (!insideAny(x, z, PLAYER_R)) out.push({ x, z, tag: 'dekat-rumah' });
      }
    }
  }
  for (const r of world.largeRocks || []) {
    for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      const rad = 1.6 * r.scale;
      const x = r.x + Math.sin(a) * rad;
      const z = r.z + Math.cos(a) * rad;
      if (!insideAny(x, z, PLAYER_R)) out.push({ x, z, tag: 'dekat-batu' });
    }
  }
  return out;
}

test('kamera tidak masuk collider dari titik berdiri valid × 4 arah', () => {
  const spots = standingSpots();
  assert.ok(spots.length >= 40, `titik uji memadai (${spots.length})`);

  let cases = 0;
  let blocked = 0;
  const bad = [];
  for (const s of spots) {
    for (const yaw of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      const camX = s.x + Math.sin(yaw) * CAM_DIST;
      const camZ = s.z + Math.cos(yaw) * CAM_DIST;
      const cc = clampCameraAgainstColliders(grid, s.x, s.z, camX, camZ);
      cases++;
      if (cc.hit) blocked++;
      if (insideAny(cc.x, cc.z)) {
        bad.push(`${s.tag}@${yaw.toFixed(2)} (${cc.x.toFixed(1)},${cc.z.toFixed(1)})`);
      }
    }
  }
  assert.ok(cases >= 160, `kasus diuji ${cases}`);
  // Harus ada yang memang terhalang — 0 berarti collision tidak pernah aktif.
  assert.ok(blocked > 0, 'tidak ada kamera terhalang: collision tampak mati');
  // Clamp tidak boleh SELALU aktif (itu berarti kamera selalu ditempel ke pemain).
  assert.ok(blocked < cases, `clamp selalu aktif (${blocked}/${cases}): kamera menempel ke pemain`);
  assert.equal(bad.length, 0, `kamera tembus collider: ${bad.slice(0, 5).join(' | ')}`);
});

test('tanpa grid: posisi tidak berubah, tidak crash', () => {
  const cc = clampCameraAgainstColliders(null, 0, 0, 10, 10);
  assert.equal(cc.x, 10);
  assert.equal(cc.z, 10);
  assert.equal(cc.hit, false);
});

test('di ruang terbuka kamera dibiarkan apa adanya', () => {
  const cc = clampCameraAgainstColliders(grid, -400, -400, -400, -403);
  assert.equal(cc.hit, false);
  assert.equal(cc.z, -403);
});
