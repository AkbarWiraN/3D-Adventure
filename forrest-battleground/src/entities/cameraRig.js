// cameraRig.js — kamera third-person over-shoulder dengan smoothing +
// auto-follow saat berbelok + camera collision (prompt.md §3.2,
// pelajaran GHOSTDASH: jangan inline trig, satu helper).

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { terrainHeight } from '../shared/terrain.js';
import { clampCameraAgainstColliders } from '../shared/movement.js';

export class CameraRig {
  constructor(camera, colliderGrid = null) {
    this.camera = camera;
    this.grid = colliderGrid;

    this.yaw = Math.PI;       // arah pandang horizontal (kamera di belakang pemain)
    this.pitch = 0.16;
    this.userYawOffset = 0;   // dari input manual (kanan layar / mouse)
    this._autoFollowEnabled = true;

    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this.aiming = false;

    this.distance = CONFIG.camera.distance;
    this._init = false;
  }

  /** Input manual look (mouse/touch). */
  addLook(dx, dy) {
    const s = CONFIG.sensitivity;
    this.userYawOffset -= dx * 0.0024 * s;
    this.pitch -= dy * 0.0024 * s * (CONFIG.invertY ? -1 : 1);
    this.pitch = Math.max(CONFIG.camera.pitchMin, Math.min(CONFIG.camera.pitchMax, this.pitch));
  }

  setAiming(on) {
    this.aiming = on;
    this.camera.fov = on ? CONFIG.camera.fovAim : CONFIG.camera.fovNormal;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Update tiap frame.
   * @param playerState {position, yaw, moving}
   * @param dt detik
   */
  update(playerState, dt) {
    const { position, yaw, moving } = playerState;
    const C = CONFIG.camera;

    // Auto-follow: kamera berbelok halus mengikuti arah gerak karakter,
    // HANYA saat bergerak maju — supaya strafe tidak membuat kamera berputar aneh.
    if (moving && this._autoFollowEnabled) {
      const target = yaw;
      let diff = target - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      // userYawOffset menyusut perlahan saat auto-follow mengambil alih.
      const followRate = C.yawLerp * dt;
      this.yaw += diff * Math.min(1, followRate);
      this.userYawOffset *= Math.max(0, 1 - dt * 1.5);
    }

    const finalYaw = this.yaw + this.userYawOffset;
    const cosP = Math.cos(this.pitch);
    const dirX = Math.sin(finalYaw) * cosP;
    const dirY = Math.sin(this.pitch);
    const dirZ = Math.cos(finalYaw) * cosP;

    const dist = this.aiming ? C.aimDistance : this.distance;
    const shoulder = this.aiming ? C.shoulderOffset : 0;

    // Target: titik di belakang pemain.
    const focusX = position.x;
    const focusY = position.y + C.height;
    const focusZ = position.z;

    let camX = focusX - dirX * dist;
    let camY = focusY - dirY * dist + 0.15;
    let camZ = focusZ - dirZ * dist;

    // Geser ke bahu kanan.
    if (shoulder) {
      const rightX = Math.cos(finalYaw);
      const rightZ = -Math.sin(finalYaw);
      camX += rightX * shoulder;
      camZ += rightZ * shoulder;
    }

    // Camera collision (dinding/batu) — logika bersama di src/shared/movement.js.
    const cc = clampCameraAgainstColliders(this.grid, focusX, focusZ, camX, camZ);
    if (cc.hit) {
      const sx = (cc.x - focusX) / (camX - focusX || 1);
      const sz = (cc.z - focusZ) / (camZ - focusZ || 1);
      const k = Math.min(sx, sz);
      camX = focusX + (camX - focusX) * k;
      camY = focusY + (camY - focusY) * k;
      camZ = focusZ + (camZ - focusZ) * k;
    }

    // Camera collision: jangan biarkan kamera masuk tanah.
    const minY = terrainHeight(camX, camZ) + 0.55;
    if (camY < minY) camY = minY;

    // Smoothing posisi (hindari kamera "melompat").
    if (!this._init) {
      this._pos.set(camX, camY, camZ);
      this._init = true;
    } else {
      const k = Math.min(1, C.followLerp * dt);
      this._pos.x += (camX - this._pos.x) * k;
      this._pos.y += (camY - this._pos.y) * k;
      this._pos.z += (camZ - this._pos.z) * k;
    }

    this.camera.position.copy(this._pos);

    // Titik pandang: sedikit di depan & atas karakter.
    const lookX = focusX + dirX * 4;
    const lookY = focusY - dirY * 1.5;
    const lookZ = focusZ + dirZ * 4;
    this._look.set(lookX, lookY, lookZ);
    this.camera.lookAt(this._look);

    return finalYaw;
  }

  /** Arah tembak yang dipakai sistem senjata (dari kamera ke titik pandang). */
  aimDirection() {
    // Ambil orientasi kamera SEKARANG (bukan _look tersimpan): setelah gerak
    // cepat/teleport, _look masih dari frame render lama dan bidikan meleset.
    this.camera.updateMatrixWorld();
    const d = new THREE.Vector3();
    this.camera.getWorldDirection(d);
    return { x: d.x, y: d.y, z: d.z };
  }

  disableAutoFollow() { this._autoFollowEnabled = false; }
  enableAutoFollow() { this._autoFollowEnabled = true; }
}
