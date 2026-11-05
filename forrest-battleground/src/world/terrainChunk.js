// terrainChunk.js — mesh terrain per chunk 64x64 m, dibuat dari heightfield shared.
// Deterministik: heightfield identik di client & server (prompt.md §3.1).

import * as THREE from 'three';
import { WORLD } from '../shared/constants.js';
import { buildChunkHeights } from '../shared/terrain.js';
import { getWorld, distanceToPath } from '../shared/world.js';
import { getMaterials } from './materials.js';

const SEGS = 16; // 64m / 16 = 4m per segmen — cukup halus, hemat vertex
const PATH_WIDTH = 3.0; // setengah lebar jalan setapak (m)

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

  // Jalan setapak: warna vertex tanah, bukan mesh terpisah — nol draw call tambahan.
  const segs = getWorld().paths;
  const grass = new THREE.Color(0x4a6b3a);
  const dirt = new THREE.Color(0x7a6549);
  const colors = new Float32Array(stride * stride * 3);
  const tmp = new THREE.Color();
  for (let iz = 0; iz < stride; iz++) {
    for (let ix = 0; ix < stride; ix++) {
      const vi = iz * stride + ix;
      const wx = originX + (ix / SEGS) * size;
      const wz = originZ + (iz / SEGS) * size;
      const d = distanceToPath(wx, wz, segs);
      // Tepi jalan di-fade supaya transisinya tidak bergerigi.
      const t = d <= PATH_WIDTH ? 1 : d >= PATH_WIDTH + 2.5 ? 0 : 1 - (d - PATH_WIDTH) / 2.5;
      tmp.copy(grass).lerp(dirt, t * 0.9);
      colors[vi * 3] = tmp.r;
      colors[vi * 3 + 1] = tmp.g;
      colors[vi * 3 + 2] = tmp.b;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mesh = new THREE.Mesh(geo, mats.terrain);
  mesh.position.set(originX + size / 2, 0, originZ + size / 2);
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();

  mesh.userData.chunkKey = `${chunkX},${chunkZ}`;
  mesh.userData.isTerrain = true;
  return mesh;
}
