// minimap.js — Canvas 2D, di-update TERPISAH dari render 3D (prompt.md §2.1).
// Throttled 8 Hz; tidak ada alokasi DOM per frame.

import { WORLD } from '../shared/constants.js';
import { getWorld } from '../shared/world.js';

const REFRESH_MS = 125; // 8 Hz

export class Minimap {
  constructor(canvas, bigCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.bigCanvas = bigCanvas;
    this.bigCtx = bigCanvas?.getContext('2d') || null;

    this.lastDraw = 0;
    this.world = getWorld();
    this.showFps = false;

    // Peta penuh: zoom & pan
    this.zoom = 1;
    this.panX = 0;
    this.panZ = 0;
    this._staticCache = null;
  }

  /** Gambar terrain + POI sekali ke offscreen, dipakai ulang (bukan tiap frame). */
  _buildStatic(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');

    // Latar hutan
    g.fillStyle = '#24331d';
    g.fillRect(0, 0, size, size);

    const toPx = (v) => ((v + WORLD.HALF) / WORLD.SIZE) * size;

    // Rumah
    for (const h of this.world.houses) {
      const s = Math.max(2, (Math.max(h.w, h.d) / WORLD.SIZE) * size);
      g.fillStyle = '#8a6a3f';
      g.fillRect(toPx(h.x) - s / 2, toPx(h.z) - s / 2, s, s);
    }
    // POI
    for (const p of this.world.pois) {
      g.fillStyle = '#6f8ba8';
      g.beginPath();
      g.arc(toPx(p.x), toPx(p.z), Math.max(1.5, (p.radius / WORLD.SIZE) * size), 0, Math.PI * 2);
      g.fill();
    }
    return c;
  }

  /**
   * @param player {x, z, yaw}
   * @param enemies array {x, z} (anonymous — tanpa username/HP)
   */
  update(player, enemies = [], now = performance.now()) {
    if (now - this.lastDraw < REFRESH_MS) return;
    this.lastDraw = now;

    const W = this.canvas.width;
    const H = this.canvas.height;
    const g = this.ctx;
    const viewSize = 170; // meter yang terlihat di minimap

    g.clearRect(0, 0, W, H);

    // Clip lingkaran? Tidak — kotak lebih cepat & jelas.
    g.fillStyle = '#1b2717';
    g.fillRect(0, 0, W, H);

    const scale = W / viewSize;
    const toMapX = (wx) => (wx - player.x) * scale + W / 2;
    const toMapZ = (wz) => (wz - player.z) * scale + H / 2;

    // Rumah
    for (const h of this.world.houses) {
      const x = toMapX(h.x);
      const z = toMapZ(h.z);
      if (x < -12 || x > W + 12 || z < -12 || z > H + 12) continue;
      const s = Math.max(3, Math.max(h.w, h.d) * scale);
      g.fillStyle = '#8a6a3f';
      g.fillRect(x - s / 2, z - s / 2, s, s);
    }
    // POI
    for (const p of this.world.pois) {
      const x = toMapX(p.x);
      const z = toMapZ(p.z);
      if (x < -8 || x > W + 8 || z < -8 || z > H + 8) continue;
      g.fillStyle = '#6f8ba8';
      g.beginPath();
      g.arc(x, z, 3, 0, Math.PI * 2);
      g.fill();
    }

    // Musuh: marker anonim (tanpa nama/HP) — prompt.md §3.5
    g.fillStyle = '#c4453a';
    for (const e of enemies) {
      const x = toMapX(e.x);
      const z = toMapZ(e.z);
      if (x < 0 || x > W || z < 0 || z > H) continue;
      g.beginPath();
      g.arc(x, z, 3, 0, Math.PI * 2);
      g.fill();
    }

    // Pemain: panah menghadap yaw
    const cx = W / 2;
    const cz = H / 2;
    g.save();
    g.translate(cx, cz);
    g.rotate(-player.yaw + Math.PI);
    g.fillStyle = '#d9843f';
    g.beginPath();
    g.moveTo(0, -7);
    g.lineTo(5, 5);
    g.lineTo(0, 2.5);
    g.lineTo(-5, 5);
    g.closePath();
    g.fill();
    g.strokeStyle = '#1a1209';
    g.lineWidth = 1;
    g.stroke();
    g.restore();

    // Bingkai
    g.strokeStyle = 'rgba(232,221,208,.22)';
    g.lineWidth = 1;
    g.strokeRect(0.5, 0.5, W - 1, H - 1);
  }

  /** Peta penuh dengan zoom/pan. */
  renderBig(player) {
    if (!this.bigCtx) return;
    const W = this.bigCanvas.width;
    const H = this.bigCanvas.height;
    const g = this.bigCtx;

    if (!this._staticCache) this._staticCache = this._buildStatic(1024);

    g.clearRect(0, 0, W, H);
    g.save();

    // Zoom & pan di sekitar posisi pemain
    const scale = this.zoom;
    g.translate(W / 2, H / 2);
    g.scale(scale, scale);
    const toPxX = (wx) => ((wx + WORLD.HALF) / WORLD.SIZE) * 1024 - 512 + this.panX;
    const toPxZ = (wz) => ((wz + WORLD.HALF) / WORLD.SIZE) * 1024 - 512 + this.panZ;
    g.translate(-(toPxX(player.x)), -(toPxZ(player.z)));

    g.drawImage(this._staticCache, -512, -512, 1024, 1024);

    // Grid ringan
    g.strokeStyle = 'rgba(232,221,208,.06)';
    g.lineWidth = 1 / scale;
    for (let i = -512; i <= 512; i += 128) {
      g.beginPath(); g.moveTo(i, -512); g.lineTo(i, 512); g.stroke();
      g.beginPath(); g.moveTo(-512, i); g.lineTo(512, i); g.stroke();
    }

    // Pemain
    g.save();
    g.translate(toPxX(player.x), toPxZ(player.z));
    g.rotate(-player.yaw + Math.PI);
    g.fillStyle = '#d9843f';
    g.beginPath();
    g.moveTo(0, -9 / scale);
    g.lineTo(6 / scale, 6 / scale);
    g.lineTo(0, 3 / scale);
    g.lineTo(-6 / scale, 6 / scale);
    g.closePath();
    g.fill();
    g.restore();

    g.restore();

    // Label
    g.fillStyle = 'rgba(232,221,208,.75)';
    g.font = '14px ui-sans-serif, system-ui, sans-serif';
    g.fillText(`Zoom ${this.zoom.toFixed(1)}×`, 12, 22);
  }

  zoomBy(factor) {
    this.zoom = Math.max(0.6, Math.min(6, this.zoom * factor));
  }

  panBy(dx, dz) {
    this.panX += dx;
    this.panZ += dz;
  }

  resetView() {
    this.zoom = 1;
    this.panX = 0;
    this.panZ = 0;
  }
}
