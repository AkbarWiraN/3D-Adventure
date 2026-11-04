// materials.js — material & texture dibuat SEKALI lalu dipakai ulang.
// prompt.md §2.5 butir 5: material reuse, hindari duplikasi.

import * as THREE from 'three';
import { markShared } from '../utils/dispose.js';

let cache = null;

function std(color, opts = {}) {
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.9,
    metalness: opts.metalness ?? 0,
    flatShading: opts.flat ?? true,
    side: opts.side ?? THREE.FrontSide,
  });
  m.name = opts.name || 'shared';
  return m;
}

/** Semua material shared. Dipanggil sekali; aman dipanggil berulang. */
export function getMaterials() {
  if (cache) return cache;
  cache = {
    // ground / jalan
    grass: std(0x4a6b3a, { roughness: 1, name: 'grass' }),
    dirt: std(0x6b5740, { roughness: 1, name: 'dirt' }),
    path: std(0x7a6549, { roughness: 1, name: 'path' }),
    rock: std(0x6e6a63, { roughness: .95, name: 'rock' }),
    rockDark: std(0x4f4b45, { roughness: .95, name: 'rockDark' }),
    // vegetasi
    bark: std(0x4a3826, { roughness: 1, name: 'bark' }),
    barkLight: std(0x6b5238, { roughness: 1, name: 'barkLight' }),
    leafDark: std(0x2f4a26, { roughness: 1, name: 'leafDark' }),
    leafMid: std(0x3d6130, { roughness: 1, name: 'leafMid' }),
    leafLight: std(0x4e7a3c, { roughness: 1, name: 'leafLight' }),
    bush: std(0x364f2b, { roughness: 1, name: 'bush' }),
    grassBlade: std(0x5a7d42, { roughness: 1, name: 'grassBlade' }),
    // bangunan
    wood: std(0x6d5334, { roughness: 1, name: 'wood' }),
    woodDark: std(0x46341f, { roughness: 1, name: 'woodDark' }),
    thatch: std(0x8a7245, { roughness: 1, name: 'thatch' }),
    stoneWall: std(0x77716a, { roughness: 1, name: 'stoneWall' }),
    // karakter
    skin: std(0xc99b74, { roughness: .85, name: 'skin' }),
    clothMale: std(0x3b5a6b, { roughness: .95, name: 'clothMale' }),
    clothFemale: std(0x7b3f52, { roughness: .95, name: 'clothFemale' }),
    leather: std(0x4a3826, { roughness: .95, name: 'leather' }),
    // senjata
    steel: std(0xb8bcc0, { roughness: .35, metalness: .75, flat: false, name: 'steel' }),
    bowWood: std(0x7a5c33, { roughness: .9, name: 'bowWood' }),
    // misc
    ember: std(0xd9843f, { roughness: .6, name: 'ember' }),
    markerSelf: new THREE.MeshBasicMaterial({ color: 0xd9843f }),
    markerEnemy: new THREE.MeshBasicMaterial({ color: 0xc4453a }),
    markerPoi: new THREE.MeshBasicMaterial({ color: 0x8fa9c4 }),
  };

  // Semua ditandai shared supaya tidak ikut ter-dispose saat chunk dibuang.
  markShared(...Object.values(cache).filter((m) => m && m.isMaterial));
  return cache;
}

export function disposeMaterials() {
  if (!cache) return;
  for (const m of Object.values(cache)) m?.dispose?.();
  cache = null;
}
