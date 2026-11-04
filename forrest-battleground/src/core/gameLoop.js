// gameLoop.js — fixed timestep untuk logika, render mengikuti layar.
// prompt.md §2.5 butir 6: JANGAN ikat logika ke FPS.

export class GameLoop {
  constructor({ update, render, fixedHz = 60, maxCatchUp = 5 }) {
    this.update = update;
    this.render = render;
    this.fixedDt = 1 / fixedHz;
    this.maxCatchUp = maxCatchUp;

    this.running = false;
    this.accumulator = 0;
    this.lastTime = 0;
    this.rafId = null;

    // Metrik
    this.fps = 0;
    this.frameMs = 0;
    this.ticksThisFrame = 0;
    this._fpsAccum = 0;
    this._fpsFrames = 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this._frame = this._frame.bind(this);
    this.rafId = requestAnimationFrame(this._frame);
  }

  stop() {
    this.running = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  _frame(now) {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this._frame);

    const frameStart = now;
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // Tab tidak aktif / frame panjang: buang waktu berlebih (hindari spiral of death).
    if (dt > 0.25) dt = 0.25;
    this.accumulator += dt;

    let ticks = 0;
    while (this.accumulator >= this.fixedDt && ticks < this.maxCatchUp) {
      this.update(this.fixedDt);
      this.accumulator -= this.fixedDt;
      ticks++;
    }
    // Sisa accumulator yang menumpuk dibuang supaya tidak meledak.
    if (this.accumulator > this.fixedDt * this.maxCatchUp) this.accumulator = 0;
    this.ticksThisFrame = ticks;

    this.render(dt);

    // FPS rata-rata per detik.
    this._fpsAccum += dt;
    this._fpsFrames++;
    if (this._fpsAccum >= 0.5) {
      this.fps = this._fpsFrames / this._fpsAccum;
      this._fpsAccum = 0;
      this._fpsFrames = 0;
    }
    this.frameMs = performance.now() - frameStart;
  }
}
