// lighting.js — pencahayaan sore: sun directional + hemisphere + ambient tipis.
// prompt.md §3.1: tanpa awan/hujan/siklus siang-malam.

import * as THREE from 'three';
import { tier } from '../config.js';

export function buildLighting(scene) {
  const t = tier();

  // Sore hari: matahari rendah, hangat.
  const sun = new THREE.DirectionalLight(0xffd9a8, 2.0);
  sun.position.set(-140, 90, 110);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = t.shadow;
  if (t.shadow) {
    sun.shadow.mapSize.set(t.shadowMapSize, t.shadowMapSize);
    const s = 90; // kamera bayangan mengikuti pemain (di-update tiap frame)
    sun.shadow.camera.left = -s;
    sun.shadow.camera.right = s;
    sun.shadow.camera.top = s;
    sun.shadow.camera.bottom = -s;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 320;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.03;
  }
  scene.add(sun);
  scene.add(sun.target);

  // Cahaya langit: biru dingin di atas, hijau tanah di bawah.
  const hemi = new THREE.HemisphereLight(0xa8c4e0, 0x3b4a2c, 0.85);
  scene.add(hemi);

  // Ambient kecil supaya bayangan tidak pekat mati.
  const amb = new THREE.AmbientLight(0xfff0dd, 0.22);
  scene.add(amb);

  return { sun, hemi, amb };
}

/** Bayangan mengikuti pemain supaya resolusi tetap tajam di map 1 km. */
export function updateSunFollow(sun, playerPos) {
  if (!sun.castShadow) return;
  sun.position.set(playerPos.x - 140, playerPos.y + 90, playerPos.z + 110);
  sun.target.position.set(playerPos.x, playerPos.y, playerPos.z);
  sun.target.updateMatrixWorld();
}
