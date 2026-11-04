// session.js — satu sesi permainan Solo. Composition root kecil:
// membuat dunia, pemain, kamera, kendali; dispose semuanya saat keluar.
// prompt.md §2.5 butir 1: jangan satu file monolitik.

import * as THREE from 'three';
import { Renderer } from '../core/renderer.js';
import { GameLoop } from '../core/gameLoop.js';
import { emit, on } from '../core/bus.js';
import { WorldManager } from '../world/worldManager.js';
import { buildStructures } from '../world/buildings.js';
import { buildLighting, updateSunFollow } from '../world/lighting.js';
import { getMaterials } from '../world/materials.js';
import { Player } from '../entities/player.js';
import { CameraRig } from '../entities/cameraRig.js';
import { InputManager } from '../input/input.js';
import { Hud } from '../ui/hud.js';
import { Minimap } from '../ui/minimap.js';
import { randomSpawn } from '../gameplay/spawn.js';
import { getWorld } from '../shared/world.js';
import { buildColliderGrid } from '../shared/movement.js';
import { terrainHeight } from '../shared/terrain.js';
import { PLAYER } from '../shared/constants.js';
import { disposeGroup } from '../utils/dispose.js';

export class SoloSession {
  constructor({ canvas, screens, character = 'male' }) {
    this.canvas = canvas;
    this.screens = screens;
    this.character = character;
    this.disposed = false;
    this.paused = false;

    // GPU resources milik sesi ini (dibuang saat keluar).
    this.owned = [];

    this.renderer = new Renderer(canvas);
    this.scene = this.renderer.scene;
    this.camera = this.renderer.camera;

    this.lighting = buildLighting(this.scene);
    this.worldManager = new WorldManager(this.scene);

    // Bangunan & POI: objek statis seluruh peta (kecil, cukup sekali).
    this.structures = buildStructures();
    this.scene.add(this.structures);
    this.owned.push(this.structures);

    this.player = new Player(character);
    this.scene.add(this.player.object3D);

    // Collider grid (sumber sama dengan server).
    const world = getWorld();
    this.colliderGrid = buildColliderGrid(world.colliders);

    this.cameraRig = new CameraRig(this.camera, this.colliderGrid);

    this.input = new InputManager(canvas, {
      joystickZone: document.getElementById('joystick-zone'),
      joystickKnob: document.getElementById('joystick-knob'),
      lookZone: document.getElementById('look-zone'),
    });

    this.hud = new Hud();
    this.minimap = new Minimap(
      document.getElementById('minimap'),
      document.getElementById('bigmap')
    );

    this._unsubs = [];
    this._mouseLook = { x: 0 };
    this._installEvents();
    this._spawn();
  }

  _installEvents() {
    // Look dari mouse / sentuh
    this._unsubs.push(on('input:look', ({ dx, dy }) => this.cameraRig.addLook(dx, dy)));

    // Aim
    this._unsubs.push(on('input:aim', (on_) => {
      this.cameraRig.setAiming(on_);
      this.player.setAiming(on_);
      this.hud.setCrosshair(on_ || false);
    }));

    // Peta penuh
    this._unsubs.push(on('ui:toggleMap', () => {
      if (this.screens.isMapOpen()) this.screens.hideMap();
      else { this.screens.showMap(); this.minimap.renderBig(this.player.position); }
    }));

    // Jeda
    this._unsubs.push(on('ui:togglePause', () => emit('ui:pause')));
  }

  _spawn() {
    // Spawn acak dari kandidat yang sudah divalidasi (>=40 titik).
    const pos = randomSpawn();
    this.player.spawnAt(pos);
    this.cameraRig._init = false;
    return pos;
  }

  start() {
    this.hud.show(true);
    this.hud.setMobileControls(isTouchDevice());
    this.hud.setFpsVisible(false);
    this.input.enable(true);

    this.loop = new GameLoop({
      fixedHz: 60,
      update: (dt) => this._update(dt),
      render: (dt) => this._render(dt),
    });
    this.loop.start();
    this.screens.hideLoading();
    this._resize();
  }

  _update(dt) {
    if (this.paused || this.disposed) return;

    const inputSnap = this.input.snapshot();
    // Yaw kamera sebelum update (dipakai untuk gerak relatif kamera).
    const cameraYaw = this.cameraRig.yaw + this.cameraRig.userYawOffset;

    this.player.update(dt, { ...inputSnap, cameraYaw });
  }

  _render(dt) {
    if (this.disposed) return;
    const p = this.player.position;

    // Streaming chunk mengikuti pemain.
    this.worldManager.update(p.x, p.z);

    // Kamera mengikuti pemain.
    const finalYaw = this.cameraRig.update(
      { position: p, yaw: this.player.yaw, moving: Math.hypot(this.player.speed, 0) > 0 || isMoving(this.input) },
      dt
    );

    // Sun mengikuti pemain supaya bayangan tetap tajam.
    updateSunFollow(this.lighting.sun, p);

    this.renderer.render();

    // HUD di-update dengan diff (bukan rebuild DOM).
    this.hud.setHp(this.player.hp, PLAYER.HP_MAX);
    this.hud.setWeapon('Tangan Kosong', null);
    this.hud.setCooldown(true);

    // Minimap 8 Hz.
    this.minimap.update({ x: p.x, z: p.z, yaw: finalYaw }, []);

    // Peta penuh ikut update bila terbuka.
    if (this.screens.isMapOpen()) this.minimap.renderBig({ x: p.x, z: p.z, yaw: finalYaw });

    this.hud.setFps(this.loop.fps);
  }

  setPaused(on) {
    this.paused = on;
    this.input.enable(!on);
  }

  _resize() {
    this.renderer.onResize();
  }

  /** Keluar: buang SEMUA resource & listener (prompt.md §2.5 butir 4). */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;

    this.loop?.stop();
    this.input.dispose();
    for (const un of this._unsubs) un();
    this._unsubs = [];

    this.hud.clearTransient();
    this.hud.show(false);

    // Dunia chunk
    this.worldManager.disposeAll();

    // Pemain + bangunan
    disposeGroup(this.player.object3D);
    this.scene.remove(this.player.object3D);
    for (const obj of this.owned) {
      disposeGroup(obj);
      this.scene.remove(obj);
    }
    this.owned = [];

    // Lampu
    this.scene.remove(this.lighting.sun);
    this.scene.remove(this.lighting.sun.target);
    this.scene.remove(this.lighting.hemi);
    this.scene.remove(this.lighting.amb);

    this.renderer.dispose();
    this.screens.hideMap();
  }

  /** Metrik untuk laporan QA (bukan klaim). */
  metrics() {
    return {
      fps: Math.round(this.loop?.fps ?? 0),
      frameMs: +(this.loop?.frameMs ?? 0).toFixed(2),
      drawCalls: this.renderer.drawCalls,
      triangles: this.renderer.triangles,
      textures: this.renderer.textures,
      geometries: this.renderer.geometries,
      chunks: this.worldManager.stats.loaded,
      chunksCreated: this.worldManager.stats.created,
      chunksDisposed: this.worldManager.stats.disposed,
    };
  }

  /** Dipakai test otomatis browser (tanpa mengubah perilaku normal). */
  teleport(x, z) {
    this.player.position.set(x, terrainHeight(x, z), z);
    this.player.group.position.copy(this.player.position);
  }
}

function isMoving(input) {
  return Math.hypot(input.moveX, input.moveZ) > 0.05;
}

export function isTouchDevice() {
  return window.matchMedia('(hover: none)').matches || navigator.maxTouchPoints > 1;
}
