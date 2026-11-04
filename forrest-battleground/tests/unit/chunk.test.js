// chunk.test.js — chunk terrain deterministik & konsisten client/server.
// prompt.md §3.1: heightfield 1024 m, chunk 64 m, seed tetap.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  terrainHeight, terrainNormal, terrainSlope, insideWorld, buildChunkHeights,
} from '../../src/shared/terrain.js';
import { WORLD } from '../../src/shared/constants.js';

const SEGS = 16;

describe('terrain & chunk', () => {
  test('tinggi terrain deterministik untuk koordinat yang sama', () => {
    for (const [x, z] of [[0, 0], [123.4, -567.8], [-500, 500], [511, 511]]) {
      assert.equal(terrainHeight(x, z), terrainHeight(x, z));
    }
  });

  test('tinggi terrain kontinu — tidak ada lompatan tajam antar 1 cm', () => {
    let maxDelta = 0;
    for (let i = 0; i < 500; i++) {
      const x = -400 + i * 1.6;
      const z = (i * 7.3) % 800 - 400;
      const d = Math.abs(terrainHeight(x, z) - terrainHeight(x + 0.01, z));
      maxDelta = Math.max(maxDelta, d);
    }
    // Slope landai (prompt.md): perubahan 1 cm tidak boleh > 0.5 m.
    assert.ok(maxDelta < 0.5, `lompatan tinggi ${maxDelta.toFixed(3)} m terlalu tajam`);
  });

  test('normal permukaan selalu vektor satuan menghadap atas', () => {
    for (let i = 0; i < 300; i++) {
      const x = (i * 13.7) % 1000 - 500;
      const z = (i * 29.1) % 1000 - 500;
      const n = terrainNormal(x, z);
      const len = Math.hypot(n.x, n.y, n.z);
      assert.ok(Math.abs(len - 1) < 1e-6, `normal tidak satuan: ${len}`);
      assert.ok(n.y > 0, 'normal harus menghadap atas');
    }
  });

  test('slope dalam radian dan wajar (landai)', () => {
    let maxSlope = 0;
    for (let i = 0; i < 500; i++) {
      const x = (i * 11.3) % 1000 - 500;
      const z = (i * 17.9) % 1000 - 500;
      const s = terrainSlope(x, z);
      assert.ok(s >= 0 && s <= Math.PI / 2, `slope tidak valid: ${s}`);
      maxSlope = Math.max(maxSlope, s);
    }
    // < 45° supaya bisa dilalui kaki (bukan tebing).
    assert.ok(maxSlope < Math.PI / 4, `slope maksimum ${(maxSlope * 180 / Math.PI).toFixed(1)}° terlalu curam`);
  });

  test('insideWorld menolak di luar batas dan margin', () => {
    const lim = WORLD.HALF - WORLD.BOUNDARY_MARGIN;
    assert.equal(lim, 488, 'margin 24 m dari tepi 512 m');
    assert.equal(insideWorld(0, 0), true);
    assert.equal(insideWorld(lim, lim), true);
    assert.equal(insideWorld(lim + 0.1, 0), false);
    assert.equal(insideWorld(0, -lim - 0.1), false);
    assert.equal(insideWorld(WORLD.HALF, WORLD.HALF), false, 'di luar margin harus ditolak');
  });

  test('buildChunkHeights menghasilkan grid (segs+1)^2 deterministik', () => {
    const a = buildChunkHeights(0, 0, SEGS);
    const b = buildChunkHeights(0, 0, SEGS);
    const expected = (SEGS + 1) * (SEGS + 1);
    assert.equal(a.length, expected);
    assert.deepEqual(a, b, 'chunk harus deterministik (client & server sama)');
  });

  test('chunk bersebelahan menyambung tanpa celah (shared edge)', () => {
    const left = buildChunkHeights(0, 0, SEGS);
    const right = buildChunkHeights(1, 0, SEGS);
    const stride = SEGS + 1;

    // Tepi kanan chunk kiri harus sama dengan tepi kiri chunk kanan.
    for (let r = 0; r < stride; r++) {
      const a = left[r * stride + SEGS];
      const b = right[r * stride + 0];
      assert.ok(Math.abs(a - b) < 1e-9, `celah di baris ${r}: ${a} vs ${b}`);
    }
  });

  test('chunk berbeda memberi data berbeda (bukan kebetulan konstan)', () => {
    const a = buildChunkHeights(0, 0, SEGS);
    const b = buildChunkHeights(3, -2, SEGS);
    const same = a.every((v, i) => v === b[i]);
    assert.equal(same, false, 'chunk jauh tidak boleh identik');
  });

  test('jumlah chunk yang dibutuhkan menutupi seluruh dunia', () => {
    const perSide = WORLD.SIZE / WORLD.CHUNK_SIZE;
    assert.equal(perSide, 16);
    assert.equal(perSide * perSide, 256, 'total chunk dunia');
  });
});
