// player.js — karakter L/P dengan animasi prosedural sederhana + fisika gerak.
// prompt.md §3.2: third-person over-shoulder, tampilkan badan pemain.

import * as THREE from 'three';
import { PLAYER, WORLD } from '../shared/constants.js';
import { terrainHeight } from '../shared/terrain.js';
import {
  effectiveSpeed, canSprint, canJump, canProne, cameraRelativeMove, normalizeMoveInput,
} from '../shared/movement.js';
import { getMaterials } from '../world/materials.js';

export class Player {
  constructor(character = 'male') {
    this.character = character === 'female' ? 'female' : 'male';

    this.position = new THREE.Vector3(0, 0, 0);
    this.velocityY = 0;
    this.onGround = true;

    this.yaw = 0;          // arah hadap karakter
    this.pitch = 0;
    this.speed = 0;

    this.prone = false;
    this.sprint = false;
    this.dead = false;
    this.hp = PLAYER.HP_MAX;

    this.invulnUntil = 0;
    this.animPhase = 0;

    this.group = new THREE.Group();
    this.group.name = 'player';
    this._buildBody();
  }

  get object3D() { return this.group; }

  _buildBody() {
    const mats = getMaterials();
    const isF = this.character === 'female';
    const H = PLAYER.HEIGHT;

    const skin = mats.skin;
    const cloth = isF ? mats.clothFemale : mats.clothMale;

    // Proporsi: total tinggi H.
    const legH = H * 0.46;
    const torsoH = H * 0.32;
    const headR = H * 0.095;

    // Pinggul (root gerak)
    this.hip = new THREE.Group();
    this.hip.position.y = legH;
    this.group.add(this.hip);

    // Kaki
    const legGeo = new THREE.BoxGeometry(0.17, legH, 0.19);
    this.legL = new THREE.Mesh(legGeo, cloth);
    this.legL.position.set(-0.12, -legH / 2, 0);
    this.legL.castShadow = true;
    this.hip.add(this.legL);

    this.legR = new THREE.Mesh(legGeo, cloth);
    this.legR.position.set(0.12, -legH / 2, 0);
    this.legR.castShadow = true;
    this.hip.add(this.legR);

    // Torso
    const torsoW = isF ? 0.42 : 0.5;
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(torsoW, torsoH, 0.28), cloth);
    this.torso.position.y = torsoH / 2;
    this.torso.castShadow = true;
    this.hip.add(this.torso);

    // Bahu
    this.shoulder = new THREE.Group();
    this.shoulder.position.y = torsoH * 0.92;
    this.hip.add(this.shoulder);

    // Lengan
    const armH = H * 0.30;
    const armGeo = new THREE.BoxGeometry(0.13, armH, 0.14);
    this.armL = new THREE.Mesh(armGeo, skin);
    this.armL.position.set(-(torsoW / 2 + 0.08), -armH / 2, 0);
    this.armL.castShadow = true;
    this.shoulder.add(this.armL);

    this.armR = new THREE.Mesh(armGeo, skin);
    this.armR.position.set(torsoW / 2 + 0.08, -armH / 2, 0);
    this.armR.castShadow = true;
    this.shoulder.add(this.armR);

    // Kepala
    this.head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.24), skin);
    this.head.position.y = torsoH + headR + 0.02;
    this.head.castShadow = true;
    this.hip.add(this.head);

    // Rambut (pembeda visual L/P)
    const hairMat = mats.woodDark;
    const hair = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, isF ? 0.3 : 0.12, 0.26),
      hairMat
    );
    hair.position.y = isF ? 0.06 : 0.11;
    hair.castShadow = true;
    this.head.add(hair);

    if (isF) {
      // Rambut panjang — penanda kosmetik perempuan
      const ponytail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 0.14), hairMat);
      ponytail.position.set(0, -0.12, -0.16);
      ponytail.castShadow = true;
      this.head.add(ponytail);
    }

    // Senjata di tangan kanan (disetel oleh SistemSenjata)
    this.weaponMount = new THREE.Group();
    this.weaponMount.position.set(0, -armH + 0.06, 0.04);
    this.armR.add(this.weaponMount);
    this._weaponMesh = null;   // mesh pedang/busur yang sedang dipegang
    this._attackT = 0;         // progres animasi serang (0 = idle)

    // Skala sedikit lebih kecil untuk pemain perempuan (kosmetik saja)
    if (isF) this.group.scale.setScalar(0.94);
  }

  /** Tampilkan senjata yang dipegang (dipanggil saat inventory/slot berubah). */
  setWeaponMesh(type) {
    if (this._weaponMesh) {
      this.weaponMount.remove(this._weaponMesh);
      this._weaponMesh.geometry?.dispose();
      this._weaponMesh.material?.dispose();
      this._weaponMesh = null;
    }
    if (!type || type === 'unarmed' || type === 'arrows') return;
    let m;
    if (type === 'sword') {
      m = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.72, 0.02),
        new THREE.MeshStandardMaterial({ color: 0xc7cbd0, metalness: 0.55, roughness: 0.4 })
      );
      m.position.set(0, -0.28, 0.02);
      m.rotation.z = 0.12;
    } else { // bow
      m = new THREE.Mesh(
        new THREE.TorusGeometry(0.34, 0.03, 5, 10, Math.PI * 1.2),
        new THREE.MeshStandardMaterial({ color: 0x9d642e })
      );
      m.position.set(0, -0.1, 0.02);
      m.rotation.z = Math.PI / 2;
    }
    m.castShadow = true;
    this._weaponMesh = m;
    this.weaponMount.add(m);
  }

  /** Picu animasi serang (nebas pedang / lepas panah) — jalan walau tak kena musuh. */
  playAttack(type) {
    this._attackT = 1;
    this._attackKind = type;
  }

  /** Posisikan di titik spawn (server-authoritative di multiplayer). */
  spawnAt(spawn) {
    this.position.set(spawn.x, terrainHeight(spawn.x, spawn.z), spawn.z);
    this.velocityY = 0;
    this.onGround = true;
    this.dead = false;
    this.hp = PLAYER.HP_MAX;
    this.prone = false;
    this.sprint = false;
    this.group.position.copy(this.position);
  }

  /**
   * Update fisika gerak.
   * @param dt detik (fixed step dari game loop)
   * @param input {moveX, moveZ, sprint, jump, prone, cameraYaw}
   */
  update(dt, input) {
    if (this.dead) return;

    const wantSprint = input.sprint && canSprint({ prone: this.prone, dead: this.dead });
    this.sprint = wantSprint;

    if (input.proneToggled && canProne({ dead: this.dead })) {
      this.prone = !this.prone;
      if (this.prone) this.sprint = false;
    }

    // Gerak horizontal, relatif kamera.
    const dir = cameraRelativeMove(input.cameraYaw, input.moveX, input.moveZ);
    const mag = Math.hypot(dir.x, dir.z);
    const speed = effectiveSpeed({ sprint: this.sprint, prone: this.prone });

    if (mag > 1e-5) {
      this.position.x += dir.x * speed * dt;
      this.position.z += dir.z * speed * dt;
      // Hadap karakter mengikuti arah gerak (smooth).
      const targetYaw = Math.atan2(dir.x, dir.z);
      this.yaw = lerpAngle(this.yaw, targetYaw, Math.min(1, dt * 12));
    }

    // Batas dunia — tidak bisa lolos.
    const lim = WORLD.HALF - WORLD.BOUNDARY_MARGIN;
    this.position.x = Math.max(-lim, Math.min(lim, this.position.x));
    this.position.z = Math.max(-lim, Math.min(lim, this.position.z));

    // Lompat & gravitasi.
    const canJ = canJump({ prone: this.prone, dead: this.dead });
    if (input.jump && this.onGround && canJ) {
      this.velocityY = PLAYER.JUMP_SPEED;
      this.onGround = false;
    }
    const groundY = terrainHeight(this.position.x, this.position.z);
    if (!this.onGround) {
      this.velocityY += PLAYER.GRAVITY * dt;
      this.position.y += this.velocityY * dt;
      if (this.position.y <= groundY) {
        this.position.y = groundY;
        this.velocityY = 0;
        this.onGround = true;
      }
    } else {
      this.position.y = groundY;
    }

    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
    // Tiarap: badan horizontal MENGHADAP arah gerak (bukan tengkurap terbalik),
    // kaki sedikit menekuk, tinggi grup diturunkan agar tak melayang.
    if (this.prone) {
      this.group.rotation.x = -Math.PI / 2 + 0.12; // hampir rata, sedikit angkat kepala
      this.group.position.y += 0.18;               // lebih rendah dari sebelumnya (0.35 terlalu melayang)
      this.legL.rotation.x = 0.35;
      this.legR.rotation.x = -0.25;
      this.armL.rotation.x = -1.9;                 // lengan menopang depan
      if (!this.aiming) this.armR.rotation.x = -1.9;
    } else {
      this.group.rotation.x = 0;
    }

    this._animate(dt, mag > 1e-5 ? speed : 0);
  }

  /** Animasi prosedural — tanpa file model, hemat bandwidth & storage. */
  _animate(dt, speed) {
    const moving = speed > 0.05;
    const rate = this.sprint ? 11 : (this.prone ? 2 : 7);
    if (moving) this.animPhase += dt * rate;

    // Saat tiarap, pose kaki/lengan sudah di-set di update() — jangan ditimpa swing jalan.
    if (this.prone) { this._tickAttack(dt); return; }

    // Animasi serang MENANG atas swing jalan (lengan kanan).
    if (this._attackT > 0) { this._tickAttack(dt); return; }

    const swing = moving ? Math.sin(this.animPhase) * (this.sprint ? 0.85 : 0.5) : 0;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.75;
    if (!this.aiming) this.armR.rotation.x = swing * 0.75;

    // Napas idle halus.
    if (!moving) {
      const b = Math.sin(performance.now() / 900) * 0.02;
      this.torso.position.y = this.torsoH0 ?? (this.torsoH0 = this.torso.position.y);
      this.torso.position.y += b;
    }
  }

  /** Dipakai sistem senjata saat membidik. */
  setAiming(on) {
    this.aiming = on;
    this.armR.rotation.x = on ? -1.45 : 0;
  }

  /** Animasi serang prosedural: pedang = tebasan horizontal, busur = tarik-lepas. */
  _tickAttack(dt) {
    if (this._attackT <= 0) return;
    this._attackT = Math.max(0, this._attackT - dt * 3.2); // ~0.31 s per ayunan
    const t = 1 - this._attackT; // 0 → 1 selama animasi
    if (this._attackKind === 'bow') {
      // Tarik (lengan ke belakang) lalu lepas cepat ke depan.
      const pull = t < 0.45 ? t / 0.45 : 1;
      const release = t < 0.45 ? 0 : (t - 0.45) / 0.55;
      this.armR.rotation.x = -1.2 - pull * 0.5 + release * 1.4;
      this.armR.rotation.z = -0.15 + release * 0.15;
      if (this._attackT === 0) this.armR.rotation.z = 0;
    } else {
      // Pedang/tangan kosong: tebasan horizontal dari kanan ke kiri.
      const swing = Math.sin(t * Math.PI); // naik lalu turun
      this.armR.rotation.x = -1.5 * swing;
      this.armR.rotation.z = -0.9 + t * 1.6; // sapuan ke kiri
      if (this._attackT === 0) { this.armR.rotation.z = 0; }
    }
  }

  takeDamage(amount, nowMs) {
    if (this.dead) return false;
    if (nowMs < this.invulnUntil) return false; // spawn protection
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp === 0) this.dead = true;
    return true;
  }

  heal() {
    this.hp = PLAYER.HP_MAX;
    this.dead = false;
  }
}

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
