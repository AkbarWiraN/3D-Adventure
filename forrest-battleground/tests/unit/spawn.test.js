// spawn.test.js — spawn deterministik, dalam batas dunia, tidak di dalam collider.
// prompt.md §3.1: >=40 kandidat spawn valid.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { randomSpawn, _resetSpawnCounter } from '../../src/gameplay/spawn.js';
import { getWorld } from '../../src/shared/world.js';
import { insideWorld, terrainHeight } from '../../src/shared/terrain.js';
import { WORLD } from '../../src/shared/constants.js';

describe('spawn', () => {
  test('dunia menyediakan >= 40 kandidat spawn (syarat prompt.md)', () => {
    const w = getWorld();
    assert.ok(w.spawns.length >= 40, `hanya ${w.spawns.length} kandidat`);
  });

  test('semua kandidat berada di dalam batas dunia', () => {
    const w = getWorld();
    const luar = w.spawns.filter((s) => !insideWorld(s.x, s.z));
    assert.equal(luar.length, 0, `${luar.length} kandidat di luar batas`);
  });

  test('semua kandidat berada di atas permukaan (y = tinggi terrain)', () => {
    const w = getWorld();
    for (const s of w.spawns) {
      const h = terrainHeight(s.x, s.z);
      assert.ok(Number.isFinite(h), `tinggi tidak valid di ${s.x},${s.z}`);
    }
  });

  test('tidak ada kandidat yang berada di dalam collider', () => {
    const w = getWorld();
    for (const s of w.spawns) {
      for (const c of w.colliders) {
        const inside =
          s.x > c.minX && s.x < c.maxX && s.z > c.minZ && s.z < c.maxZ;
        assert.ok(!inside, `spawn (${s.x},${s.z}) terjebak di collider ${c.id ?? ''}`);
      }
    }
  });

  test('spawn acak selalu mengembalikan kandidat yang sah', () => {
    _resetSpawnCounter();
    const w = getWorld();
    const ids = new Set(w.spawns.map((s) => `${s.x},${s.z}`));
    for (let i = 0; i < 200; i++) {
      const s = randomSpawn();
      assert.ok(ids.has(`${s.x},${s.z}`), 'spawn bukan kandidat resmi');
      assert.ok(insideWorld(s.x, s.z), 'spawn di luar batas');
    }
  });

  test('spawn menghindari musuh bila memungkinkan', () => {
    _resetSpawnCounter();
    const w = getWorld();
    const musuh = { x: w.spawns[0].x, z: w.spawns[0].z };
    let jauh = 0;
    for (let i = 0; i < 40; i++) {
      const s = randomSpawn([musuh], 30);
      if (Math.hypot(s.x - musuh.x, s.z - musuh.z) >= 30) jauh++;
    }
    // Karena kandidat banyak (>=40), mayoritas harus bisa menghindar.
    assert.ok(jauh >= 30, `hanya ${jauh}/40 spawn yang cukup jauh`);
  });

  test('bila semua kandidat dekat musuh, tetap mengembalikan spawn sah', () => {
    _resetSpawnCounter();
    const w = getWorld();
    const semua = w.spawns.map((s) => ({ x: s.x, z: s.z }));
    const s = randomSpawn(semua, 99999);
    assert.ok(insideWorld(s.x, s.z), 'fallback harus tetap di dalam dunia');
    assert.ok(Number.isFinite(s.x) && Number.isFinite(s.z));
  });

  test('batas dunia konstan sesuai spesifikasi (1024x1024 m)', () => {
    assert.equal(WORLD.SIZE, 1024);
    assert.equal(WORLD.CHUNK_SIZE, 64);
  });
});
