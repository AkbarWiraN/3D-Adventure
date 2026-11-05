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

/** Ada collider yang menutupi titik ini? (toleransi kecil) */
const insideAny = (x, z, r = 0.05) =>
  nearbyColliders(grid, x, z, r + 1).some((c) => circleVsObb(x, z, r, c));

test('kamera tidak masuk collider dari titik berdiri valid × 4 arah', () => {
  // Titik uji = posisi yang MEMANG bisa diduduki pemain:
  //  - spawn candidates (dijamin bebas collider), dan
  //  - 4 titik di luar tiap rumah (2.6 m dari pusat, di luar dinding 2.25 m).
  const around = [];
  for (const h of world.houses || []) {
    for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      around.push({ x: h.x + Math.sin(a) * 2.6, z: h.z + Math.cos(a) * 2.6, tag: 'luar-rumah' });
    }
  }
  const spots = [...(world.spawnCandidates || []).map((s) => ({ x: s.x, z: s.z, tag: 'spawn' })), ...around];
  assert.ok(spots.length >= 30, `titik uji memadai (${spots.length})`);

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
  assert.ok(cases >= 120, `kasus diuji ${cases}`);
  // Harus ada yang memang terhalang — 0 berarti collision tidak pernah aktif.
  assert.ok(blocked > 0, 'tidak ada kamera terhalang: collision tampak mati');
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
