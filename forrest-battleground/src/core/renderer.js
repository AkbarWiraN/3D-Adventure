// renderer.js — WebGL setup + handler error/context lost (prompt.md §2.5 butir 8).
import * as THREE from 'three';
import { CONFIG, tier } from '../config.js';
import { emit } from './bus.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.clock = new THREE.Clock();
    this.contextLost = false;

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

    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9fb3c8);
    this.scene.fog = new THREE.Fog(0xa89a86, 90, tier().viewDistance);

    this.camera = new THREE.PerspectiveCamera(
      CONFIG.camera.fovNormal,
      window.innerWidth / window.innerHeight,
      CONFIG.camera.near,
      CONFIG.camera.far
    );

    // Context lost/restored — jangan biarkan game diam-diam rusak.
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
      emit('gl:lost');
    }, false);
    canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      emit('gl:restored');
    }, false);
    canvas.addEventListener('webglcontextcreationerror', () => {
      emit('gl:failed', 'Konteks WebGL tidak dapat dibuat');
    }, false);
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
    if (this.contextLost) return;
    this.renderer.info.reset();
    this.renderer.render(this.scene, this.camera);
  }

  get drawCalls() { return this.renderer.info.render.calls; }
  get triangles() { return this.renderer.info.render.triangles; }
  get textures() { return this.renderer.info.memory.textures; }
  get geometries() { return this.renderer.info.memory.geometries; }

  dispose() {
    this.renderer.dispose();
  }
}
