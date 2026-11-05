// worldManager.js — streaming chunk: aktifkan ring di sekitar pemain,
// buang chunk jauh + dispose resource (prompt.md §3.1 & §2.5 butir 4).

import * as THREE from 'three';
import { WORLD } from '../shared/constants.js';
import { tier } from '../config.js';
import { createTerrainChunk } from './terrainChunk.js';
import { createVegetationChunk } from './vegetation.js';
import { disposeGroup } from '../utils/dispose.js';

export class WorldManager {
  constructor(scene) {
    this.scene = scene;
    this.chunks = new Map();       // key -> { terrain, vegetation, group }
    this.pending = [];             // antrean pembuatan (dibatasi per frame)
    this.lastCenter = { cx: NaN, cz: NaN };

    this.root = new THREE.Group();
    this.root.name = 'world-chunks';
    scene.add(this.root);

    this.stats = { loaded: 0, created: 0, disposed: 0 };
  }

  key(cx, cz) { return `${cx},${cz}`; }

  chunkOf(x, z) {
    return {
      cx: Math.floor(x / WORLD.CHUNK_SIZE),
      cz: Math.floor(z / WORLD.CHUNK_SIZE),
    };
  }

  /**
   * Panggil tiap frame. Membuat/membuang chunk sesuai posisi pemain.
   * Dibuat bertahap (budget per frame) agar tidak ada frame drop besar.
   */
  update(playerX, playerZ, budgetPerFrame = 2) {
    const { cx, cz } = this.chunkOf(playerX, playerZ);
    if (cx !== this.lastCenter.cx || cz !== this.lastCenter.cz) {
      this.lastCenter = { cx, cz };
      this._recomputeDesired(cx, cz);
    }

    // Buat chunk yang belum ada, dibatasi budget.
    let made = 0;
    while (this.pending.length && made < budgetPerFrame) {
      const { cx: px, cz: pz } = this.pending.shift();
      const k = this.key(px, pz);
      if (this.chunks.has(k)) continue;
      this._createChunk(px, pz);
      made++;
    }
    // upgrade/downgrade detail vegetasi chunk yang sudah ada.
    this._refreshLOD(cx, cz);
  }

  /**
   * Chunk yang dulu dibangun detail-rendah harus dinaikkan detailnya saat
   * pemain mendekat (dan sebaliknya). Dilakukan lazy di sini, 1 chunk/frame.
   */
  _refreshLOD(cx, cz) {
    for (const [k, entry] of this.chunks) {
      const [px, pz] = k.split(',').map(Number);
      const near = Math.hypot(px - cx, pz - cz) <= 1.5;
      const want = near ? 'near' : 'far';
      if (entry.detail === want || !entry.vegetation) continue;
      // ganti hanya grup vegetasi, terrain dibiarkan (mahal & tak berubah)
      this.root.remove(entry.vegetation);
      disposeGroup(entry.vegetation);
      const veg = createVegetationChunk(px, pz, want);
      entry.group.add(veg);
      entry.vegetation = veg;
      entry.detail = want;
      this.stats.rebuilt = (this.stats.rebuilt || 0) + 1;
      return; // satu per frame, jaga frame time
    }
  }

  _recomputeDesired(cx, cz) {
    const ring = tier().activeRing;
    const want = new Set();
    for (let dz = -ring; dz <= ring; dz++) {
      for (let dx = -ring; dx <= ring; dx++) {
        // Bentuk bulat, bukan kotak, supaya tidak boros di sudut.
        if (Math.hypot(dx, dz) > ring + 0.35) continue;
        want.add(this.key(cx + dx, cz + dz));
      }
    }

    // Buang yang jauh.
    for (const [k, entry] of [...this.chunks]) {
      if (want.has(k)) continue;
      disposeGroup(entry.group);
      this.root.remove(entry.group);
      this.chunks.delete(k);
      this.stats.disposed++;
    }
    this.stats.loaded = this.chunks.size;

    // Antri yang baru. Chunk yang SEPENUHNYA di luar peta (origin bergeser
    // -512..+512 -> koordinat dunia [cx*64, cx*64+64]) dilewati: tanpa filter
    // ini spawn di dekat tepi membangun hingga 4 chunk kosong di luar dunia
    // (jumlah plane terrain jadi tergantung posisi spawn acak — flake test leak).
    const LIM = WORLD.HALF; // 512
    for (const k of want) {
      if (this.chunks.has(k)) continue;
      const [px, pz] = k.split(',').map(Number);
      if (px * WORLD.CHUNK_SIZE >= LIM || (px + 1) * WORLD.CHUNK_SIZE <= -LIM ||
          pz * WORLD.CHUNK_SIZE >= LIM || (pz + 1) * WORLD.CHUNK_SIZE <= -LIM) continue;
      this.pending.push({ cx: px, cz: pz });
    }
    // Prioritas: yang paling dekat dibuat lebih dulu.
    this.pending.sort((a, b) =>
      (Math.hypot(a.cx - cx, a.cz - cz) - Math.hypot(b.cx - cx, b.cz - cz)));
  }

  _createChunk(cx, cz) {
    const group = new THREE.Group();
    const terrain = createTerrainChunk(cx, cz);
    group.add(terrain);

    // LOD jarak, bukan radius tetap: chunk yang jauh dari pemain dibangun
    // dengan detail rendah (tanpa rumput/semak, pohon lebih sedikit).
    // Sudah dihitung saat dibangun -> nol biaya per frame.
    const dist = Math.hypot(cx - this.lastCenter.cx, cz - this.lastCenter.cz);
    const near = dist <= 1.5;
    let vegetation = null;
    if (dist <= 2.5) {
      vegetation = createVegetationChunk(cx, cz, near ? 'near' : 'far');
      group.add(vegetation);
    }

    this.root.add(group);
    this.chunks.set(this.key(cx, cz), { group, terrain, vegetation, detail: vegetation ? (near ? 'near' : 'far') : null });
    this.stats.created++;
    this.stats.loaded = this.chunks.size;
  }

  /** Buang seluruh dunia (dipakai saat keluar Solo). */
  disposeAll() {
    for (const [, entry] of this.chunks) {
      disposeGroup(entry.group);
      this.root.remove(entry.group);
    }
    this.chunks.clear();
    this.pending = [];
    this.lastCenter = { cx: NaN, cz: NaN };
    this.scene.remove(this.root);
  }
}
