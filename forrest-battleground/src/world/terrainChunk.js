// terrainChunk.js — mesh terrain per chunk 64x64 m, dibuat dari heightfield shared.
// Deterministik: heightfield identik di client & server (prompt.md §3.1).

import * as THREE from 'three';
import { WORLD } from '../shared/constants.js';
import { buildChunkHeights } from '../shared/terrain.js';
import { getMaterials } from './materials.js';

const SEGS = 16; // 64m / 16 = 4m per segmen — cukup halus, hemat vertex

export function createTerrainChunk(chunkX, chunkZ) {
  const mats = getMaterials();
  const size = WORLD.CHUNK_SIZE;
  const heights = buildChunkHeights(chunkX, chunkZ, SEGS);
  const geo = new THREE.PlaneGeometry(size, size, SEGS, SEGS);
  geo.rotateX(-Math.PI / 2);

  // Terapkan tinggi ke vertex. PlaneGeometry sudah dirotasi; posisi y = index.
  const pos = geo.attributes.position;
  const originX = chunkX * size;
  const originZ = chunkZ * size;
  const stride = SEGS + 1;

  for (let iz = 0; iz < stride; iz++) {
    for (let ix = 0; ix < stride; ix++) {
      const vi = iz * stride + ix;
      const h = heights[vi];
      pos.setY(vi, h);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, mats.grass);
  mesh.position.set(originX + size / 2, 0, originZ + size / 2);
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();

  mesh.userData.chunkKey = `${chunkX},${chunkZ}`;
  mesh.userData.isTerrain = true;
  return mesh;
}
