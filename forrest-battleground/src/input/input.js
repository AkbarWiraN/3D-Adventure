// input.js — keyboard + mouse (desktop) dan joystick/look (mobile portrait).
// Pelajaran GHOSTDASH: joystick TIDAK boleh terbalik; arah harus dites,
// dan pointercancel/pointerleave wajib di-reset supaya karakter tidak
// terus berjalan saat jari keluar area (prompt.md §3.2).

import { emit } from '../core/bus.js';

export class InputManager {
  constructor(canvas, { lookZone, joystickZone, joystickKnob }) {
    this.canvas = canvas;
    this.lookZone = lookZone;
    this.joystickZone = joystickZone;
    this.joystickKnob = joystickKnob;

    // State gerak ternormalisasi (-1..1)
    this.moveX = 0;
    this.moveZ = 0;
    this.sprint = false;
    this.jump = false;
    this.jumpQueued = false;
    this.proneToggled = false;
    this.prone = false;
    this.aiming = false;

    // Kunci keyboard
    this.keys = new Set();
    this.enabled = false;

    // Pointer mobile
    this.joyPointerId = null;
    this.joyOrigin = { x: 0, y: 0 };
    this.lookPointerId = null;
    this.lastLook = { x: 0, y: 0 };

    this._bound = [];
    this._install();
  }

  _add(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    this._bound.push([target, type, fn, opts]);
  }

  _install() {
    const onKey = (e, down) => {
      if (!this.enabled) return;
      const k = e.key.toLowerCase();
      // Cegah scroll halaman dari Space/arrow.
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();

      if (down) {
        if (!this.keys.has(k)) {
          if (k === ' ') this.jumpQueued = true;
          if (k === 'z') this.proneToggled = true;   // toggle sekali per tekan
          if (k === 'm') emit('ui:toggleMap');
          if (k === 'escape') emit('ui:togglePause');
          if (k === 'e') emit('input:interact');
          if (k === 'g') emit('input:drop');
          if (k === 't') emit('input:throw');
          if (k === '1') emit('input:slot', 0);
          if (k === '2') emit('input:slot', 1);
        }
        this.keys.add(k);
      } else {
        this.keys.delete(k);
      }
      this._recomputeKeys();
    };

    this._add(window, 'keydown', (e) => onKey(e, true));
    this._add(window, 'keyup', (e) => onKey(e, false));

    // Kehilangan fokus: lepas semua tombol supaya karakter tidak jalan terus.
    this._add(window, 'blur', () => this.releaseAll());

    // ---------------------------------------------------- mouse (desktop)
    this._add(this.canvas, 'mousedown', (e) => {
      if (!this.enabled) return;
      if (e.button === 0) { emit('input:attack'); }
      if (e.button === 2) { this.aiming = true; emit('input:aim', true); }
    });
    this._add(this.canvas, 'mouseup', (e) => {
      if (e.button === 2) { this.aiming = false; emit('input:aim', false); }
    });
    this._add(this.canvas, 'contextmenu', (e) => e.preventDefault());

    // Look dengan pointer lock opsional
    this._add(this.canvas, 'mousemove', (e) => {
      if (!this.enabled) return;
      const dx = e.movementX || 0;
      const dy = e.movementY || 0;
      if (dx || dy) emit('input:look', { dx, dy });
    });

    // -------------------------------------------------- touch (mobile)
    if (this.joystickZone) {
      this._add(this.joystickZone, 'pointerdown', (e) => this._joyDown(e));
      this._add(this.joystickZone, 'pointermove', (e) => this._joyMove(e));
      this._add(this.joystickZone, 'pointerup', (e) => this._joyUp(e));
      this._add(this.joystickZone, 'pointercancel', (e) => this._joyUp(e));
      this._add(this.joystickZone, 'pointerleave', (e) => this._joyUp(e));
    }
    if (this.lookZone) {
      this._add(this.lookZone, 'pointerdown', (e) => {
        if (!this.enabled) return;
        this.lookPointerId = e.pointerId;
        this.lastLook = { x: e.clientX, y: e.clientY };
        this.lookZone.setPointerCapture?.(e.pointerId);
      });
      this._add(this.lookZone, 'pointermove', (e) => {
        if (e.pointerId !== this.lookPointerId) return;
        const dx = e.clientX - this.lastLook.x;
        const dy = e.clientY - this.lastLook.y;
        this.lastLook = { x: e.clientX, y: e.clientY };
        // KOREKSI PENTING (pelajaran GHOSTDASH): jari ke kanan = kamera ke kanan.
        emit('input:look', { dx: -dx, dy: -dy });
      });
      const endLook = (e) => {
        if (e.pointerId === this.lookPointerId) {
          this.lookPointerId = null;
          this.lookZone.releasePointerCapture?.(e.pointerId);
        }
      };
      this._add(this.lookZone, 'pointerup', endLook);
      this._add(this.lookZone, 'pointercancel', endLook);
      this._add(this.lookZone, 'pointerleave', endLook);
    }
  }

  // ------------------------------------------------------------ joystick
  _joyDown(e) {
    if (!this.enabled) return;
    e.preventDefault();
    this.joyPointerId = e.pointerId;
    const rect = this.joystickZone.getBoundingClientRect();
    // Origin = titik sentuh pertama (lebih nyaman daripada pusat tetap).
    this.joyOrigin = { x: e.clientX, y: e.clientY };
    this.joystickZone.setPointerCapture?.(e.pointerId);
    this._updateJoy(e.clientX, e.clientY, rect);
  }

  _joyMove(e) {
    if (e.pointerId !== this.joyPointerId) return;
    e.preventDefault();
    const rect = this.joystickZone.getBoundingClientRect();
    this._updateJoy(e.clientX, e.clientY, rect);
  }

  _joyUp(e) {
    if (e.pointerId !== this.joyPointerId) return;
    this.joyPointerId = null;
    this.moveX = 0;
    this.moveZ = 0;
    this.sprint = false;
    if (this.joystickKnob) this.joystickKnob.style.transform = 'translate(0px, 0px)';
    this.joystickZone.releasePointerCapture?.(e.pointerId);
  }

  _updateJoy(clientX, clientY, rect) {
    const maxR = Math.min(rect.width, rect.height) * 0.34;
    let dx = clientX - this.joyOrigin.x;
    let dy = clientY - this.joyOrigin.y;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) { dx = (dx / dist) * maxR; dy = (dy / dist) * maxR; }

    if (this.joystickKnob) {
      this.joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    }

    // KRITIS & diuji unit: layar +Y ke bawah, dunia +Z ke depan.
    // Jari ke ATAS (dy negatif) harus MAJU (+moveZ).
    this.moveX = dx / maxR;
    this.moveZ = -dy / maxR;

    // Sprint: dorong joystick sampai tepi (deadzone 0.9).
    const mag = Math.hypot(this.moveX, this.moveZ);
    this.sprint = mag > 0.9;
  }

  // ------------------------------------------------------- keyboard state
  _recomputeKeys() {
    const k = this.keys;
    let x = 0;
    let z = 0;
    if (k.has('w') || k.has('arrowup')) z += 1;
    if (k.has('s') || k.has('arrowdown')) z -= 1;
    if (k.has('d') || k.has('arrowright')) x += 1;
    if (k.has('a') || k.has('arrowleft')) x -= 1;
    // Keyboard menimpa joystick hanya bila tombol ditekan.
    if (x || z) { this.moveX = x; this.moveZ = z; }
    else if (this.joyPointerId === null) { this.moveX = 0; this.moveZ = 0; }
    this.sprint = k.has('shift');
    this.jump = k.has(' ');
  }

  /** Konsumsi jump sekali pakai (edge-trigger). */
  consumeJump() {
    const j = this.jumpQueued || this.jump;
    this.jumpQueued = false;
    return j;
  }

  consumeProneToggle() {
    const p = this.proneToggled;
    this.proneToggled = false;
    return p;
  }

  /** Snapshot input untuk satu langkah fisika. */
  snapshot() {
    return {
      moveX: this.moveX,
      moveZ: this.moveZ,
      sprint: this.sprint,
      jump: this.consumeJump(),
      proneToggled: this.consumeProneToggle(),
    };
  }

  releaseAll() {
    this.keys.clear();
    this.moveX = 0;
    this.moveZ = 0;
    this.sprint = false;
    this.jump = false;
    this.aiming = false;
    this.joyPointerId = null;
    this.lookPointerId = null;
  }

  enable(on = true) {
    this.enabled = on;
    if (!on) this.releaseAll();
  }

  dispose() {
    for (const [t, type, fn, opts] of this._bound) t.removeEventListener(type, fn, opts);
    this._bound = [];
  }
}
