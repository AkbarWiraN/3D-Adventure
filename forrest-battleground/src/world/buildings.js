// buildings.js — rumah/gubuk & POI dari world.js (deterministik, sama dengan server).
// prompt.md §3.1: >=12 rumah dapat dimasuki, >=8 POI, collider konsisten.

import * as THREE from 'three';
import { getMaterials } from './materials.js';
import { getWorld } from '../shared/world.js';

/** Bangun satu rumah lengkap: 4 dinding dengan bukaan pintu + atap + lantai. */
export function createHouse(h) {
  const mats = getMaterials();
  const group = new THREE.Group();
  group.position.set(h.x, h.y, h.z);
  group.rotation.y = h.rotY;
  group.userData.houseId = h.id;

  const { w, d, wallH, door } = h;
  const halfW = w / 2;
  const halfD = d / 2;
  const thick = 0.28;

  const wallMat = h.type === 'ruin_house' ? mats.stoneWall : mats.wood;
  const isRuin = h.type === 'ruin_house';

  // Lantai
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), mats.dirt);
  floor.position.y = 0.06;
  floor.receiveShadow = true;
  group.add(floor);

  // Dinding belakang & samping (utuh)
  const back = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, thick), wallMat);
  back.position.set(0, wallH / 2, -halfD);
  back.castShadow = back.receiveShadow = true;
  group.add(back);

  const left = new THREE.Mesh(new THREE.BoxGeometry(thick, wallH, d), wallMat);
  left.position.set(-halfW, wallH / 2, 0);
  left.castShadow = left.receiveShadow = true;
  group.add(left);

  const right = new THREE.Mesh(new THREE.BoxGeometry(thick, wallH, d), wallMat);
  right.position.set(halfW, wallH / 2, 0);
  right.castShadow = right.receiveShadow = true;
  group.add(right);

  // Dinding depan dengan BUKAAN PINTU di tengah (bisa dimasuki)
  const sideW = (w - door) / 2;
  if (sideW > 0.1) {
    const frontL = new THREE.Mesh(new THREE.BoxGeometry(sideW, wallH, thick), wallMat);
    frontL.position.set(-(door / 2 + sideW / 2), wallH / 2, halfD);
    frontL.castShadow = frontL.receiveShadow = true;
    group.add(frontL);

    const frontR = new THREE.Mesh(new THREE.BoxGeometry(sideW, wallH, thick), wallMat);
    frontR.position.set(door / 2 + sideW / 2, wallH / 2, halfD);
    frontR.castShadow = frontR.receiveShadow = true;
    group.add(frontR);

    // Ambang atas pintu
    const lintelH = Math.max(0.25, wallH - 2.0);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(door, lintelH, thick), wallMat);
    lintel.position.set(0, wallH - lintelH / 2, halfD);
    lintel.castShadow = true;
    group.add(lintel);
  }

  // Atap (kecuali ruin)
  if (!isRuin) {
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, 1.6, 4), mats.thatch);
    roof.position.y = wallH + 0.75;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);
  } else {
    // Reruntuhan: sebagian atap runtuh
    const beam = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.22, 0.3), mats.woodDark);
    beam.position.set(0.4, wallH - 0.3, 0);
    beam.rotation.z = 0.28;
    beam.castShadow = true;
    group.add(beam);
  }

  return group;
}

/** POI non-rumah: bentuk sederhana tapi mudah dikenali (readability). */
export function createPoi(p) {
  const mats = getMaterials();
  const group = new THREE.Group();
  group.position.set(p.x, p.y, p.z);
  group.rotation.y = p.rotY;
  group.userData.poiId = p.id;

  switch (p.type) {
    case 'ruins':
    case 'stonecircle': {
      const n = p.type === 'stonecircle' ? 8 : 5;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = p.radius * 0.55;
        const hgt = 1.2 + (i % 3) * 0.9;
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.7, hgt, 0.7), mats.stoneWall);
        pillar.position.set(Math.cos(a) * r, hgt / 2, Math.sin(a) * r);
        pillar.rotation.y = a;
        pillar.castShadow = pillar.receiveShadow = true;
        group.add(pillar);
      }
      break;
    }
    case 'camp': {
      const tent = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.0, 4), mats.thatch);
      tent.position.y = 1.0;
      tent.rotation.y = Math.PI / 4;
      tent.castShadow = true;
      group.add(tent);
      const fire = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.22, 6), mats.ember);
      fire.position.set(2.6, 0.11, 0.3);
      group.add(fire);
      break;
    }
    case 'shrine': {
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 2.2), mats.stoneWall);
      base.position.y = 0.25;
      base.castShadow = base.receiveShadow = true;
      group.add(base);
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, 1.2), mats.rockDark);
      top.position.y = 1.4;
      top.castShadow = top.receiveShadow = true;
      group.add(top);
      break;
    }
    case 'watchtower': {
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 4.6, 5), mats.woodDark);
        leg.position.set(sx * 1.4, 2.3, sz * 1.4);
        leg.castShadow = true;
        group.add(leg);
      }
      const deck = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.24, 3.4), mats.wood);
      deck.position.y = 4.6;
      deck.castShadow = deck.receiveShadow = true;
      group.add(deck);
      break;
    }
    case 'woodpile': {
      for (let i = 0; i < 6; i++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 2.4, 6), mats.bark);
        log.rotation.z = Math.PI / 2;
        log.position.set(0, 0.24 + Math.floor(i / 3) * 0.44, (i % 3) * 0.5 - 0.5);
        log.castShadow = true;
        group.add(log);
      }
      break;
    }
    case 'graveyard': {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const r = 2 + (i % 3);
        const stone = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.16), mats.rockDark);
        stone.position.set(Math.cos(a) * r, 0.55, Math.sin(a) * r);
        stone.rotation.y = a + Math.PI / 2;
        stone.castShadow = true;
        group.add(stone);
      }
      break;
    }
    case 'clearing':
    default: {
      const fire = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.18, 8), mats.rockDark);
      fire.position.y = 0.09;
      fire.receiveShadow = true;
      group.add(fire);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const seat = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.4, 0.4), mats.woodDark);
        seat.position.set(Math.cos(a) * 1.9, 0.2, Math.sin(a) * 1.9);
        seat.rotation.y = -a;
        seat.castShadow = true;
        group.add(seat);
      }
      break;
    }
  }
  return group;
}

/** Bangun semua bangunan & POI sekali di awal (world kecil, tidak per-chunk). */
export function buildStructures() {
  const world = getWorld();
  const group = new THREE.Group();
  group.name = 'structures';
  for (const h of world.houses) group.add(createHouse(h));
  for (const p of world.pois) group.add(createPoi(p));
  return group;
}
