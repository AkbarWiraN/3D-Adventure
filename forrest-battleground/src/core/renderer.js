// renderer.js — WebGL setup + handler error/context lost (prompt.md §2.5 butir 8).
//
// PENTING (leak nyata yang ditemukan uji 20x exit): SATU WebGLRenderer per halaman.
// Membuat THREE.WebGLRenderer baru di canvas/konteks yang sama tiap sesi membuat
// cache internal lama (WebGLProgram/Textures/Uniforms/State) tidak pernah dilepas
// — terukur ~130 KB per sesi yang bertahan setelah GC. Scene & kamera tetap dibuat
// per sesi (murah, dan memang dibuang saat keluar).
import * as THREE from 'three';
import { CONFIG, tier } from '../config.js';
import { emit } from './bus.js';

let shared = null; // { renderer } — dipakai ulang lintas sesi
let listenersBound = false;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.clock = new THREE.Clock();
    this.contextLost = false;

    if (!shared) {
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: CONFIG.resolvedTier !== 'low',
          powerPreference: 'high-performance',
          alpha: false,
          stencil: false,
        });
      } catch (err) {
        throw new Error('WEBGL_INIT_FAILED');
      }
      if (!renderer || !renderer.getContext()) throw new Error('WEBGL_INIT_FAILED');

      const t = tier();
      renderer.setPixelRatio(Math.min(t.pixelRatio, window.devicePixelRatio || 1));
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      renderer.shadowMap.enabled = t.shadow;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.02;
      renderer.info.autoReset = false;
      shared = { renderer };
    }

    this.renderer = shared.renderer;

    // Handler konteks hanya sekali per halaman (bukan per sesi).
    if (!listenersBound) {
      listenersBound = true;
      canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        if (shared) shared.lost = true;
        emit('gl:lost');
      }, false);
      canvas.addEventListener('webglcontextrestored', () => {
        if (shared) shared.lost = false;
        emit('gl:restored');
      }, false);
      canvas.addEventListener('webglcontextcreationerror', () => {
        emit('gl:failed', 'Konteks WebGL tidak dapat dibuat');
      }, false);
    }

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9fb3c8);
    this.scene.fog = new THREE.Fog(0xa89a86, 90, tier().viewDistance);

    this.camera = new THREE.PerspectiveCamera(
      CONFIG.camera.fovNormal,
      window.innerWidth / window.innerHeight,
      CONFIG.camera.near,
      CONFIG.camera.far
    );
  }

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(tier().pixelRatio, window.devicePixelRatio || 1));
    this.renderer.setSize(w, h, false);
  }

  render() {
    if (shared?.lost) return;
    this.renderer.info.reset();
    this.renderer.render(this.scene, this.camera);
  }

  get drawCalls() { return this.renderer.info.render.calls; }
  get triangles() { return this.renderer.info.render.triangles; }
  get textures() { return this.renderer.info.memory.textures; }
  get geometries() { return this.renderer.info.memory.geometries; }

  /**
   * Akhir sesi: lepas cache render-list & daftar objek scene, JANGAN bunuh
   * WebGLRenderer (dipakai sesi berikutnya; membunuhnya justru sumber leak).
   */
  dispose() {
    this.renderer.renderLists.dispose();
    this.scene.clear();
  }
}
