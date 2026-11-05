// vegetation.js — pohon/semak/rumput/batu dengan InstancedMesh.
// prompt.md §2.5 butir 5: InstancedMesh wajib untuk vegetasi.
// Instancing dibagi per chunk supaya bisa dibuang tanpa membuang seluruh dunia.

import * as THREE from 'three';
import { WORLD } from '../shared/constants.js';
import { terrainHeight, terrainSlope } from '../shared/terrain.js';
import { rngAt, randRange, randInt } from '../shared/rng.js';
import { getMaterials } from './materials.js';
import { tier } from '../config.js';

// Geometri dibuat SEKALI dan dipakai ulang semua chunk.
let GEO = null;
function geometries() {
  if (GEO) return GEO;
  GEO = {
    trunk: new THREE.CylinderGeometry(0.22, 0.34, 1, 6, 1),
    canopyLow: new THREE.IcosahedronGeometry(1, 0),
    canopyMid: new THREE.ConeGeometry(1, 1.6, 6, 1),
    bush: new THREE.IcosahedronGeometry(1, 0),
    grassBlade: new THREE.ConeGeometry(0.06, 1, 3, 1),
    rockLarge: new THREE.DodecahedronGeometry(1, 0),
    rockMed: new THREE.DodecahedronGeometry(0.6, 0),
    rockSmall: new THREE.DodecahedronGeometry(0.3, 0),
    log: new THREE.CylinderGeometry(0.3, 0.36, 1, 6, 1),
  };
  return GEO;
}

/** Jumlah objek per chunk, diskalakan dengan tier grafis. */
function densityFor(t) {
  const d = t.grassDensity;
  const tr = t.treeDensity;
  return {
    trees: Math.round(14 * tr),
    bushes: Math.round(9 * tr),
    grass: Math.round(160 * d),
    rocksSmall: Math.round(8 * tr),
    rocksMed: Math.round(3 * tr),
  };
}

/**
 * Buat satu group vegetasi untuk chunk.
 * Deterministik per chunk -> hasil sama tiap kali chunk dimuat ulang.
 */
export function createVegetationChunk(chunkX, chunkZ) {
  const mats = getMaterials();
  const g = geometries();
  const t = tier();
  const counts = densityFor(t);
  const size = WORLD.CHUNK_SIZE;
  const originX = chunkX * size;
  const originZ = chunkZ * size;
  const rng = rngAt(WORLD.SEED, chunkX, chunkZ, 0x56454747);

  const group = new THREE.Group();
  group.userData.chunkKey = `${chunkX},${chunkZ}`;

  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();

  // Helper: buat InstancedMesh dengan matrix terisi.
  function makeInstanced(geo, mat, count, place, opts = {}) {
    if (count <= 0) return null;
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.castShadow = opts.cast ?? false;
    mesh.receiveShadow = opts.receive ?? false;
    let used = 0;
    for (let i = 0; i < count; i++) {
      const p = place(i);
      if (!p) continue;
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rx || 0, p.ry || 0, p.rz || 0);
      dummy.scale.set(p.sx, p.sy, p.sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(used, dummy.matrix);
      if (opts.color) {
        tmpColor.setHex(opts.color).offsetHSL(
          (rng() - 0.5) * 0.05,
          (rng() - 0.5) * 0.12,
          (rng() - 0.5) * 0.18
        );
        mesh.setColorAt(used, tmpColor);
      }
      used++;
    }
    mesh.count = used;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = true;
    return mesh;
  }

  // --- Pohon varian 1: pohon purba tinggi, tajuk ikosahedron lebar
  const tree1 = makeInstanced(g.trunk, mats.bark, counts.trees, () => {
    const x = originX + rng() * size;
    const z = originZ + rng() * size;
    if (terrainSlope(x, z) > 0.22) return null;
    const h = randRange(rng, 5.5, 9.5);
    return {
      x, z, y: terrainHeight(x, z) + h / 2,
      ry: rng() * Math.PI * 2,
      sx: randRange(rng, .85, 1.2), sy: h, sz: randRange(rng, .85, 1.2),
    };
  }, { cast: true });
  if (tree1) group.add(tree1);

  // Kanopi pohon 1 (dipisah supaya scaling tidak merusak bentuk)
  const canopy1 = makeInstanced(g.canopyLow, mats.leafDark, counts.trees, (i) => {
    // Ambil posisi dari instanced trunk yang sudah dibuat (deterministik diulang)
    const m = new THREE.Matrix4();
    if (!tree1 || i >= tree1.count) return null;
    tree1.getMatrixAt(i, m);
    const p = new THREE.Vector3().setFromMatrixPosition(m);
    const h = new THREE.Vector3().setFromMatrixScale(m).y;
    return {
      x: p.x, z: p.z, y: p.y + h * 0.42,
      ry: rng() * Math.PI * 2,
      sx: randRange(rng, 2.4, 3.6), sy: randRange(rng, 2.0, 2.9), sz: randRange(rng, 2.4, 3.6),
    };
  }, { cast: true, color: 0x2f4a26 });
  if (canopy1 && canopy1.count) group.add(canopy1);

  // --- Pohon varian 2: konifer ramping (kerucut)
  const tree2Count = Math.round(counts.trees * 0.45);
  const t2rng = rngAt(WORLD.SEED, chunkX, chunkZ, 0x434f4e49);
  const trunk2 = makeInstanced(g.trunk, mats.barkLight, tree2Count, () => {
    const x = originX + t2rng() * size;
    const z = originZ + t2rng() * size;
    if (terrainSlope(x, z) > 0.24) return null;
    const h = randRange(t2rng, 4.0, 6.5);
    return { x, z, y: terrainHeight(x, z) + h / 2, ry: t2rng() * 6.283, sx: .8, sy: h, sz: .8 };
  }, { cast: true });
  if (trunk2) group.add(trunk2);

  const cone2 = makeInstanced(g.canopyMid, mats.leafMid, tree2Count, (i) => {
    const m = new THREE.Matrix4();
    if (!trunk2 || i >= trunk2.count) return null;
    trunk2.getMatrixAt(i, m);
    const p = new THREE.Vector3().setFromMatrixPosition(m);
    const h = new THREE.Vector3().setFromMatrixScale(m).y;
    return {
      x: p.x, z: p.z, y: p.y + h * 0.30,
      ry: t2rng() * 6.283,
      sx: randRange(t2rng, 1.6, 2.2), sy: randRange(t2rng, 2.4, 3.4), sz: randRange(t2rng, 1.6, 2.2),
    };
  }, { cast: true, color: 0x3d6130 });
  if (cone2 && cone2.count) group.add(cone2);

  // --- Pohon varian 3: pohon mati/kerdil (batang miring tanpa tajuk lebat).
  // Melengkapi syarat "pohon >=3 varian" (prompt.md §F1 checklist butir 5).
  const tree3Count = Math.round(counts.trees * 0.30);
  const t3rng = rngAt(WORLD.SEED, chunkX, chunkZ, 0x534e4147);
  const snag3 = makeInstanced(g.log, mats.barkDark, tree3Count, () => {
    const x = originX + t3rng() * size;
    const z = originZ + t3rng() * size;
    if (terrainSlope(x, z) > 0.26) return null;
    const h = randRange(t3rng, 3.0, 5.0);
    return {
      x, z, y: terrainHeight(x, z) + h / 2,
      rx: (t3rng() - 0.5) * 0.28, rz: (t3rng() - 0.5) * 0.28, ry: t3rng() * 6.283,
      sx: randRange(t3rng, .8, 1.3), sy: h, sz: randRange(t3rng, .8, 1.3),
    };
  }, { cast: true });
  if (snag3) group.add(snag3);

  const snagTop3 = makeInstanced(g.canopyLow, mats.leafLight, tree3Count, (i) => {
    const m = new THREE.Matrix4();
    if (!snag3 || i >= snag3.count) return null;
    snag3.getMatrixAt(i, m);
    const p = new THREE.Vector3().setFromMatrixPosition(m);
    const h = new THREE.Vector3().setFromMatrixScale(m).y;
    return {
      x: p.x, z: p.z, y: p.y + h * 0.45,
      ry: t3rng() * 6.283,
      sx: randRange(t3rng, .9, 1.5), sy: randRange(t3rng, .6, 1.0), sz: randRange(t3rng, .9, 1.5),
    };
  }, { cast: true, color: 0x4e7a3c });
  if (snagTop3 && snagTop3.count) group.add(snagTop3);

  // --- Semak
  const bush = makeInstanced(g.bush, mats.bush, counts.bushes, () => {
    const x = originX + rng() * size;
    const z = originZ + rng() * size;
    if (terrainSlope(x, z) > 0.3) return null;
    const s = randRange(rng, 0.55, 1.15);
    return { x, z, y: terrainHeight(x, z) + s * 0.5, ry: rng() * 6.283, sx: s, sy: s * randRange(rng, .7, 1.1), sz: s };
  }, { cast: true });
  if (bush) group.add(bush);

  // --- Rumput (2 ketinggian). Tidak punya collider (prompt.md §3.1).
  const grassPlace = () => {
    const x = originX + rng() * size;
    const z = originZ + rng() * size;
    if (terrainSlope(x, z) > 0.34) return null;
    const tall = rng() > 0.55;
    const h = tall ? randRange(rng, 0.55, 1.0) : randRange(rng, 0.22, 0.45);
    return {
      x, z, y: terrainHeight(x, z) + h / 2,
      ry: rng() * 6.283, rz: (rng() - 0.5) * 0.22,
      sx: tall ? 1.2 : 1.0, sy: h, sz: tall ? 1.2 : 1.0,
    };
  };
  const grass = makeInstanced(g.grassBlade, mats.grassBlade, counts.grass, grassPlace, { color: 0x5a7d42 });
  if (grass) group.add(grass);

  // --- Batu kecil & sedang (tanpa collider untuk yang kecil)
  const rockS = makeInstanced(g.rockSmall, mats.rock, counts.rocksSmall, () => {
    const x = originX + rng() * size;
    const z = originZ + rng() * size;
    const s = randRange(rng, .5, 1.1);
    return { x, z, y: terrainHeight(x, z) + s * .15, ry: rng() * 6.283, sx: s, sy: s * .7, sz: s };
  }, { cast: true });
  if (rockS) group.add(rockS);

  const rockM = makeInstanced(g.rockMed, mats.rockDark, counts.rocksMed, () => {
    const x = originX + rng() * size;
    const z = originZ + rng() * size;
    const s = randRange(rng, .8, 1.5);
    return { x, z, y: terrainHeight(x, z) + s * .3, ry: rng() * 6.283, sx: s, sy: s * .8, sz: s };
  }, { cast: true });
  if (rockM) group.add(rockM);

  return group;
}

/** Batu besar (punya collider di server) — dipisah karena jumlahnya sedikit. */
export function createLargeRock(rock) {
  const mats = getMaterials();
  const g = geometries();
  const geo = new THREE.DodecahedronGeometry(rock.scale, 0);
  const mesh = new THREE.Mesh(geo, mats.rock);
  mesh.position.set(rock.x, rock.y, rock.z);
  mesh.rotation.set(rock.rx || 0, rock.ry || 0, rock.rz || 0);
  mesh.scale.y = 0.75;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function disposeGeometryCache() {
  if (!GEO) return;
  for (const g of Object.values(GEO)) g.dispose();
  GEO = null;
}
