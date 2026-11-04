/* GHOSTDASH — Pasar Malam Arwah
 * FASE 1: fondasi dunia + eksplorasi 360°
 * Struktur: CONFIG → Utils → Input → Audio → Scene → World → Entities → Systems → UI → Save → Loop
 */
(function () {
  'use strict';

  /* ============================ 1. CONFIG ============================ */
  var CONFIG = {
    world: { radius: 70, fogNear: 20, fogFar: 95, groundY: 0 },
    player: { walk: 5.0, run: 8.5, radius: 0.5, accel: 14, turn: 12 },
    camera: { fov: 65, dist: 6, distMin: 3, distMax: 10, pitchMin: -10, pitchMax: 60, smooth: 8, sens: 1, follow: 3.2, followDead: 0.12, followMax: 1.6 },
    ui: { toastMs: 2200 },
    interact: { stall: 2.2, customer: 2.5 },
    order: { minDist: 25, gap: 25, expiryGrace: 0 },
    rating: { start: 5, fail: 2.0, onTime: 0.05, fast: 0.08, trick: -0.3, expire: -0.4, wrongSmall: 0.02 },
    score: { perItem: 100, tipMax: 50, comboStep: 0.25, comboMax: 16, fireflyScore: 10, fireflyBonus: 2, gradeS: { 1: 120000, 2: 260000, 3: 450000 } },
    wrongGive: { successChance: 0.35, rewardScale: 0.5 },
    fireflyCollect: { radius: 1.6, total: 40, magnet: 5 },
    night: { durM1: 180, durM2: 240, durM3: 300, demoCycle: true },
    fireflies: 40,
    decorFireflies: 90,
    lanterns: { count: 64, pointLights: 4 },
    quality: { maxPixelRatio: 1.75, shadowMap: 1024, lowPixelRatio: 1.0 },
    colors: {
      skyTopNight: 0x0b1026, skyBottomNight: 0x2a1b4d,
      skyBottomDawn: 0xffd9a0, skyTopDawn: 0x5a3f7a,
      horizonDawn: 0xff8a5b,
      neonMagenta: 0xff3da5, neonCyan: 0x3df2ff, amber: 0xffc24d, mint: 0x7cffb2,
      ground: 0x1b1a2e, path: 0x3a2f4b, text: 0xf5f3ff
    },
    spawn: { x: 0, z: 56 },
    debug: /[?&]debug=1/.test(location.search)
  };

  function isMobileTablet() {
    return navigator.maxTouchPoints > 0 || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }
  function updateRotateGate() {
    var gate = document.getElementById('rotate-gate');
    if (gate) gate.style.display = isMobileTablet() && window.innerHeight > window.innerWidth ? 'grid' : 'none';
  }

  var LANDMARKS = [
    { id: 1, name: 'Gapura Masuk', x: 0, z: 60 },
    { id: 2, name: 'Pohon Beringin', x: 0, z: 0 },
    { id: 3, name: 'Panggung Wayang', x: 0, z: -12 },
    { id: 4, name: 'Pos Ronda', x: -40, z: 10 },
    { id: 5, name: 'Jembatan Bambu', x: 0, z: -45 },
    { id: 6, name: 'Sawah Cahaya', x: 45, z: -10 },
    { id: 7, name: 'Gang Gelap', x: -35, z: -30 },
    { id: 8, name: 'Kolam Teratai', x: 35, z: -35 },
    { id: 9, name: 'Bangku Taman', x: -20, z: 30 },
    { id: 10, name: 'Menara Air', x: 30, z: 25 },
    { id: 11, name: 'Warung Pojok', x: 50, z: 35 },
    { id: 12, name: 'Tikungan Lampion', x: -48, z: -8 }
  ];

  var ITEMS = [
    { id: 'esteh', name: 'Es Teh Jumbo', icon: '🧋' },
    { id: 'sate', name: 'Sate Ayam', icon: '🍢' },
    { id: 'martabak', name: 'Martabak Manis', icon: '🥞' },
    { id: 'kopi', name: 'Kopi Tubruk', icon: '☕' },
    { id: 'bakso', name: 'Bakso Urat', icon: '🍜' }
  ];
  var STALL_DEFS = [
    { no: 1, item: 0 }, { no: 2, item: 1 }, { no: 3, item: 2 }, { no: 4, item: 3 },
    { no: 5, item: 4 }, { no: 6, item: 0 }, { no: 7, item: 1 }, { no: 8, item: 4 }
  ];

  var SKY = {
    topNight: new THREE.Color(CONFIG.colors.skyTopNight),
    topDawn: new THREE.Color(CONFIG.colors.skyTopDawn),
    botNight: new THREE.Color(CONFIG.colors.skyBottomNight),
    botDawn: new THREE.Color(CONFIG.colors.skyBottomDawn),
    fogNight: new THREE.Color(0x181030),
    fogDawn: new THREE.Color(0xd98f63),
    groundNight: new THREE.Color(0x0d0b1c),
    groundDawn: new THREE.Color(0x4a3550)
  };

  /* ============================ 2. Utils ============================ */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function damp(a, b, lambda, dt) { return lerp(a, b, 1 - Math.exp(-lambda * dt)); }
  function lerpAngle(a, b, t) {
    var d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }
  function normAngle(d) {
    d = d % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }
  /* Gerak relatif kamera. Kamera duduk di +（sin yaw, cos yaw) dari pemain,
   * jadi "depan" pemain = -(sin yaw, cos yaw). mz < 0 = maju (W / stik ke atas). */
  function camRelativeMove(yaw, mx, mz) {
    var fx = Math.sin(yaw), fz = Math.cos(yaw);
    return { x: fx * mz + fz * mx, z: fz * mz - fx * mx };
  }
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function colorLerp(out, a, b, t) { out.copy(a).lerp(b, t); return out; }
  function distXZ(ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }
  function distSqXZ(ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }
  function fmtRp(v) { return 'Rp ' + Math.round(v).toLocaleString('id-ID'); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  var rng = mulberry32(20261104);

  /* ---------- canvas texture helpers ---------- */
  function canvasTex(size, draw) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'), size);
    var t = new THREE.CanvasTexture(c);
    t.needsUpdate = true;
    return t;
  }
  var TEX = {
    glow: canvasTex(128, function (g, s) {
      var r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      r.addColorStop(0, 'rgba(255,255,255,1)');
      r.addColorStop(0.25, 'rgba(255,255,255,0.55)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, s, s);
    }),
    stripes: canvasTex(64, function (g, s) {
      g.fillStyle = '#7a2f3f'; g.fillRect(0, 0, s, s);
      g.fillStyle = '#ffd9a0';
      for (var i = 0; i < s; i += 16) g.fillRect(0, i, s, 8);
    }),
    ground: canvasTex(128, function (g, s) {
      g.fillStyle = '#1b1a2e'; g.fillRect(0, 0, s, s);
      for (var i = 0; i < 420; i++) {
        var v = 18 + Math.floor(Math.random() * 34);
        g.fillStyle = 'rgba(' + v + ',' + (v - 4) + ',' + (v + 22) + ',0.55)';
        g.fillRect(Math.random() * s, Math.random() * s, 2, 2);
      }
    })
  };
  function textSprite(text, color, bg, w, h, fontSize) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
    g.font = 'bold ' + (fontSize || 40) + 'px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 18;
    g.fillStyle = color;
    g.fillText(text, w / 2, h / 2);
    var t = new THREE.CanvasTexture(c);
    var m = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false });
    var sp = new THREE.Sprite(m);
    sp.scale.set(w / 100, h / 100, 1);
    return sp;
  }
  function glowSprite(color, size, opacity) {
    var m = new THREE.SpriteMaterial({
      map: TEX.glow, color: color, transparent: true, opacity: opacity === undefined ? 0.85 : opacity,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    var s = new THREE.Sprite(m);
    s.scale.set(size, size, 1);
    return s;
  }

  /* ============================ 3. Input ============================ */
  var Input = {
    keys: {}, move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, zoom: 0,
    running: false, touch: false, actionPressed: false, wrongPressed: false,
    dashPressed: false, lanternPressed: false,
    _joy: null, _lookId: null, _lookLast: { x: 0, y: 0 }, _runToggle: false,

    init: function (canvas, lookEl) {
      var self = this;
      window.addEventListener('keydown', function (e) {
        if (e.repeat) { e.preventDefault(); return; }
        self.keys[e.code] = true;
        if (e.code === 'KeyE') self.actionPressed = true;
        if (e.code === 'KeyQ') self.wrongPressed = true;
        if (e.code === 'Space') self.dashPressed = true;
        if (e.code === 'KeyF') self.lanternPressed = true;
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0) e.preventDefault();
      });
      window.addEventListener('keyup', function (e) { self.keys[e.code] = false; });
      window.addEventListener('blur', function () { self.keys = {}; self.move.x = self.move.y = 0; });

      canvas.addEventListener('mousedown', function (e) {
        if (e.button === 0 && document.pointerLockElement !== canvas && !self.touch) {
          if (canvas.requestPointerLock) canvas.requestPointerLock();
        }
      });
      document.addEventListener('mousemove', function (e) {
        var locked = document.pointerLockElement === canvas;
        // yaw bertambah = kamera berputar ke KIRI, jadi gerak mouse ke kanan harus MENGURANGI yaw.
        if (locked) {
          self.look.x -= e.movementX * 0.0022 * CONFIG.camera.sens;
          self.look.y += e.movementY * 0.0022 * CONFIG.camera.sens;
        } else if (self._drag) {
          self.look.x -= (e.clientX - self._drag.x) * 0.004 * CONFIG.camera.sens;
          self.look.y += (e.clientY - self._drag.y) * 0.004 * CONFIG.camera.sens;
          self._drag.x = e.clientX; self._drag.y = e.clientY;
        }
      });
      canvas.addEventListener('mousedown', function (e) { if (e.button === 0) self._drag = { x: e.clientX, y: e.clientY }; });
      window.addEventListener('mouseup', function () { self._drag = null; });
      canvas.addEventListener('wheel', function (e) { self.zoom += Math.sign(e.deltaY) * 0.5; e.preventDefault(); }, { passive: false });
      canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

      this.initTouch();
    },

    initTouch: function () {
      var self = this;
      var joy = document.getElementById('joystick');
      var knob = document.getElementById('joystick-knob');
      var look = document.getElementById('lookzone');
      var enabled = isMobileTablet();
      this.touch = enabled;
      if (!enabled) return;
      document.getElementById('touch').classList.remove('hidden');

      joy.addEventListener('pointerdown', function (e) {
        joy.setPointerCapture(e.pointerId); self._joy = e.pointerId; self._joyMove(e, joy, knob);
      });
      joy.addEventListener('pointermove', function (e) { if (self._joy === e.pointerId) self._joyMove(e, joy, knob); });
      var joyEnd = function (e) {
        if (self._joy !== e.pointerId) return;
        self._joy = null; self.move.x = 0; self.move.y = 0;
        knob.style.transform = '';
      };
      joy.addEventListener('pointerup', joyEnd);
      joy.addEventListener('pointercancel', joyEnd);

      look.addEventListener('pointerdown', function (e) {
        look.setPointerCapture(e.pointerId); self._lookId = e.pointerId;
        self._lookLast = { x: e.clientX, y: e.clientY };
      });
      look.addEventListener('pointermove', function (e) {
        if (self._lookId !== e.pointerId) return;
        // Geser ke kanan = kamera berotasi kanan = kurangi yaw.
        self.look.x -= (e.clientX - self._lookLast.x) * 0.004 * CONFIG.camera.sens;
        self.look.y += (e.clientY - self._lookLast.y) * 0.004 * CONFIG.camera.sens;
        self._lookLast = { x: e.clientX, y: e.clientY };
      });
      var lookEnd = function (e) { if (self._lookId === e.pointerId) self._lookId = null; };
      look.addEventListener('pointerup', lookEnd);
      look.addEventListener('pointercancel', lookEnd);

      var hold = function (id, on, off) {
        var el = document.getElementById(id);
        el.addEventListener('pointerdown', function (e) { el.setPointerCapture(e.pointerId); on(); });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
          el.addEventListener(ev, function () { off(); });
        });
      };
      hold('tb-run', function () { self._runToggle = true; self.running = true; }, function () { self._runToggle = false; self.running = false; });
      hold('tb-dash', function () { self.dashPressed = true; }, function () {});
      hold('tb-lantern', function () { self.lanternPressed = true; }, function () {});
      hold('tb-action', function () { self.actionPressed = true; }, function () {});
      hold('tb-wrong', function () { self.wrongPressed = true; }, function () {});
    },

    _joyMove: function (e, joy, knob) {
      var r = joy.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2);
      var len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      this.move.x = dx; this.move.y = dy;
      knob.style.transform = 'translate(' + (dx * 34) + 'px,' + (dy * 34) + 'px)';
    },

    update: function () {
      if (!this._joy) {
        var x = 0, y = 0;
        if (this.keys.KeyA || this.keys.ArrowLeft) x -= 1;
        if (this.keys.KeyD || this.keys.ArrowRight) x += 1;
        if (this.keys.KeyW || this.keys.ArrowUp) y -= 1;
        if (this.keys.KeyS || this.keys.ArrowDown) y += 1;
        var l = Math.hypot(x, y);
        if (l > 1) { x /= l; y /= l; }
        this.move.x = x; this.move.y = y;
      }
      if (this.keys.ShiftLeft || this.keys.ShiftRight) this.running = true;
      else if (!this._runToggle) this.running = false;
    },
    consume: function (name) {
      if (!this[name]) return false;
      this[name] = false; return true;
    }
  };

  /* ============================ 4. Audio (inti) ============================ */
  var AudioEngine = {
    ctx: null, master: null, muted: false, started: false, ambGain: null, _nodes: [],
    init: function () {
      if (this.started) return;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = Settings.volume;
      this.master.connect(this.ctx.destination);
      this.started = true;
      this.startAmbience();
    },
    resume: function () { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
    setVolume: function (v) { if (this.master) this.master.gain.value = v; },
    toggleMute: function () {
      this.muted = !this.muted;
      if (this.master) this.master.gain.value = this.muted ? 0 : Settings.volume;
      return this.muted;
    },
    noiseBuffer: function () {
      if (this._nb) return this._nb;
      var len = this.ctx.sampleRate * 2;
      var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._nb = buf; return buf;
    },
    startAmbience: function () {
      var ctx = this.ctx;
      var src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer(); src.loop = true;
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3800; bp.Q.value = 1.2;
      var g = ctx.createGain(); g.gain.value = 0.012;
      src.connect(bp); bp.connect(g); g.connect(this.master);
      src.start();
      var lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
      var lg = ctx.createGain(); lg.gain.value = 0.01;
      lfo.connect(lg); lg.connect(g.gain); lfo.start();
      this.ambGain = g; this._nodes.push(src, lfo);
    },
    beep: function (freq, dur, type, vol) {
      if (!this.started) return;
      var ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.value = 0.0001;
      var t = ctx.currentTime;
      g.gain.exponentialRampToValueAtTime(vol || 0.14, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
    },
    playSfx: function (name) {
      if (!this.started) return;
      if (name === 'step') this.beep(120 + Math.random() * 30, 0.05, 'triangle', 0.05);
      else if (name === 'ui') this.beep(520, 0.09, 'square', 0.08);
      else if (name === 'pick') { this.beep(660, 0.1, 'triangle'); setTimeout(function () { AudioEngine.beep(880, 0.12, 'triangle'); }, 70); }
      else if (name === 'success') { [523, 659, 784].forEach(function (f, i) { setTimeout(function () { AudioEngine.beep(f, 0.16, 'triangle'); }, i * 80); }); }
      else if (name === 'prank') this.beep(200, 0.3, 'sawtooth', 0.12);
      else if (name === 'notify') { this.beep(740, 0.1, 'sine'); setTimeout(function () { AudioEngine.beep(988, 0.14, 'sine'); }, 110); }
      else if (name === 'firefly') this.beep(1300 + Math.random() * 500, 0.09, 'sine', 0.09);
    }
  };

  /* ============================ 5. Settings & Save ============================ */
  var Save = {
    read: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    write: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage bisa diblokir */ } }
  };
  var Settings = {
    volume: Save.read('gd_volume', 0.7),
    sens: Save.read('gd_sens', 1),
    reducedMotion: Save.read('gd_reduced', false),
    quality: Save.read('gd_quality', 'auto'),
    apply: function () {
      CONFIG.camera.sens = this.sens;
      AudioEngine.setVolume(this.volume);
      Save.write('gd_volume', this.volume);
      Save.write('gd_sens', this.sens);
      Save.write('gd_reduced', this.reducedMotion);
      Save.write('gd_quality', this.quality);
    }
  };

  /* ============================ 6. Collision ============================ */
  var Collision = {
    cell: 10, circles: [], boxes: [], grid: new Map(),
    key: function (cx, cz) { return cx + ',' + cz; },
    clear: function () { this.circles = []; this.boxes = []; this.grid = new Map(); },
    addCircle: function (x, z, r) {
      var c = { x: x, z: z, r: r }; this.circles.push(c); this._insert(c.x, c.z, c); return c;
    },
    addBox: function (minX, minZ, maxX, maxZ) {
      var b = { minX: minX, minZ: minZ, maxX: maxX, maxZ: maxZ };
      this.boxes.push(b); this._insert((minX + maxX) / 2, (minZ + maxZ) / 2, b); return b;
    },
    _insert: function (x, z, obj) {
      var k = this.key(Math.floor(x / this.cell), Math.floor(z / this.cell));
      if (!this.grid.has(k)) this.grid.set(k, []);
      this.grid.get(k).push(obj);
    },
    near: function (x, z, out) {
      out.length = 0;
      var cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
      for (var i = -1; i <= 1; i++) for (var j = -1; j <= 1; j++) {
        var arr = this.grid.get(this.key(cx + i, cz + j));
        if (arr) for (var n = 0; n < arr.length; n++) out.push(arr[n]);
      }
      return out;
    },
    /* dorong keluar + sliding */
    resolve: function (pos, radius) {
      var near = this.near(pos.x, pos.z, this._buf || (this._buf = []));
      for (var i = 0; i < near.length; i++) {
        var o = near[i];
        if (o.r !== undefined) {
          var dx = pos.x - o.x, dz = pos.z - o.z;
          var d = Math.hypot(dx, dz), min = o.r + radius;
          if (d < min) {
            if (d < 1e-4) { dx = 1; dz = 0; d = 1; }
            pos.x = o.x + (dx / d) * min;
            pos.z = o.z + (dz / d) * min;
          }
        } else {
          var nx = clamp(pos.x, o.minX, o.maxX), nz = clamp(pos.z, o.minZ, o.maxZ);
          var ddx = pos.x - nx, ddz = pos.z - nz;
          var dd = Math.hypot(ddx, ddz);
          if (dd < radius) {
            if (dd < 1e-4) {
              var left = pos.x - o.minX, right = o.maxX - pos.x, up = pos.z - o.minZ, down = o.maxZ - pos.z;
              var m = Math.min(left, right, up, down);
              if (m === left) pos.x = o.minX - radius;
              else if (m === right) pos.x = o.maxX + radius;
              else if (m === up) pos.z = o.minZ - radius;
              else pos.z = o.maxZ + radius;
            } else {
              pos.x = nx + (ddx / dd) * radius;
              pos.z = nz + (ddz / dd) * radius;
            }
          }
        }
      }
      var dc = Math.hypot(pos.x, pos.z);
      if (dc > CONFIG.world.radius - 1) {
        pos.x = (pos.x / dc) * (CONFIG.world.radius - 1);
        pos.z = (pos.z / dc) * (CONFIG.world.radius - 1);
      }
    }
  };

  /* ============================ 7. Renderer / Scene ============================ */
  var renderer, scene, camera, canvas;
  var qualityTier = 3; // 3=high 2=mid 1=low
  var fog, hemi, moonLight, skyMesh, skyUni, stars, moonMesh, sunMesh, horizonGlow;
  var lanternLights = [], lanternPositions = [], lanternMeshes = [];

  function initRenderer() {
    canvas = document.getElementById('gl');
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.quality.maxPixelRatio));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    if (Settings.quality === 'low') { qualityTier = 1; renderer.setPixelRatio(1); }
    else if (Settings.quality === 'mid') qualityTier = 2;

    scene = new THREE.Scene();
    fog = new THREE.Fog(0x181030, CONFIG.world.fogNear, CONFIG.world.fogFar);
    scene.fog = fog;

    camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, window.innerWidth / window.innerHeight, 0.1, 400);
    camera.position.set(0, 8, 70);

    hemi = new THREE.HemisphereLight(0x4a3f7a, 0x0d0b1c, 0.55);
    scene.add(hemi);

    moonLight = new THREE.DirectionalLight(0xbcd0ff, 0.85);
    moonLight.position.set(-30, 60, -20);
    if (qualityTier >= 2) {
      moonLight.castShadow = true;
      var sm = CONFIG.quality.shadowMap * (qualityTier >= 3 ? 1 : 0.5);
      moonLight.shadow.mapSize.width = moonLight.shadow.mapSize.height = sm;
      moonLight.shadow.camera.near = 1; moonLight.shadow.camera.far = 90;
      moonLight.shadow.camera.left = -22; moonLight.shadow.camera.right = 22;
      moonLight.shadow.camera.top = 22; moonLight.shadow.camera.bottom = -22;
      moonLight.shadow.bias = -0.0012;
    }
    scene.add(moonLight);
    scene.add(moonLight.target);

    for (var i = 0; i < CONFIG.lanterns.pointLights; i++) {
      var pl = new THREE.PointLight(0xffc24d, 1.1, 16, 2);
      pl.visible = false;
      scene.add(pl);
      lanternLights.push(pl);
    }

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', function () { setTimeout(onResize, 250); });
    updateRotateGate();
    window.addEventListener('resize', updateRotateGate);
    window.addEventListener('orientationchange', function () { setTimeout(updateRotateGate, 250); });
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  /* ---------- sky ---------- */
  function initSky() {
    skyUni = {
      topColor: { value: SKY.topNight.clone() },
      bottomColor: { value: SKY.botNight.clone() },
      offset: { value: 12 }, exponent: { value: 0.75 }
    };
    skyMesh = new THREE.Mesh(
      new THREE.SphereGeometry(190, 32, 20),
      new THREE.ShaderMaterial({
        uniforms: skyUni, side: THREE.BackSide, depthWrite: false, fog: false,
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent; varying vec3 vP;' +
          'void main(){ float h = normalize(vP + vec3(0.0, offset, 0.0)).y; gl_FragColor = vec4(mix(bottomColor, topColor, pow(max(h,0.0), exponent)), 1.0); }'
      })
    );
    skyMesh.renderOrder = -10;
    scene.add(skyMesh);

    // bintang
    var N = 900, pos = new Float32Array(N * 3);
    for (var i = 0; i < N; i++) {
      var u = rng() * Math.PI * 2, v = rng() * 0.55;
      var r = 170, phi = Math.acos(1 - v);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(u);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(u);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    stars = new THREE.Points(g, new THREE.PointsMaterial({
      color: 0xffffff, size: 1.5, sizeAttenuation: true, transparent: true, opacity: 1, depthWrite: false, fog: false
    }));
    scene.add(stars);

    moonMesh = new THREE.Mesh(new THREE.SphereGeometry(6, 18, 14),
      new THREE.MeshBasicMaterial({ color: 0xfff3d0, fog: false }));
    scene.add(moonMesh);
    var moonGlow = glowSprite(0xfff0c8, 34, 0.5);
    moonMesh.add(moonGlow);

    sunMesh = new THREE.Mesh(new THREE.SphereGeometry(9, 18, 14),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false }));
    sunMesh.visible = false;
    scene.add(sunMesh);

    horizonGlow = glowSprite(0xff8a5b, 200, 0);
    horizonGlow.position.set(0, 8, -120);
    scene.add(horizonGlow);
  }

  function updateSky(p, t) {
    colorLerp(skyUni.topColor.value, SKY.topNight, SKY.topDawn, clamp(p * 1.05, 0, 1));
    colorLerp(skyUni.bottomColor.value, SKY.botNight, SKY.botDawn, clamp((p - 0.35) / 0.65, 0, 1));
    stars.material.opacity = clamp(1 - p * 1.5, 0, 1);
    colorLerp(fog.color, SKY.fogNight, SKY.fogDawn, clamp((p - 0.45) / 0.55, 0, 1));
    scene.fog.near = CONFIG.world.fogNear * (1 - p * 0.35);
    scene.fog.far = CONFIG.world.fogFar * (1 + p * 0.5);

    var ang = lerp(Math.PI * 0.35, -Math.PI * 0.55, p);
    moonMesh.position.set(Math.cos(ang) * 120, Math.sin(ang) * 90 + 10, -110);
    sunMesh.visible = p > 0.82;
    if (sunMesh.visible) {
      var sp = (p - 0.82) / 0.18;
      sunMesh.position.set(0, lerp(-4, 26, sp), -150);
      horizonGlow.material.opacity = sp * 0.85;
      horizonGlow.position.set(0, lerp(2, 16, sp), -120);
    } else horizonGlow.material.opacity = 0;

    colorLerp(hemi.color, SKY.topNight, new THREE.Color(0xffb98a), clamp((p - 0.5) / 0.5, 0, 1));
    hemi.intensity = lerp(0.55, 1.05, clamp((p - 0.55) / 0.45, 0, 1));
    colorLerp(moonLight.color, new THREE.Color(0xbcd0ff), new THREE.Color(0xffd0a0), clamp((p - 0.6) / 0.4, 0, 1));
    moonLight.intensity = lerp(0.85, 1.35, clamp((p - 0.6) / 0.4, 0, 1));

    for (var i = 0; i < lanternMeshes.length; i++) {
      var lm = lanternMeshes[i];
      if (lm) lm.material.emissiveIntensity = lerp(1.2, 0.35, clamp((p - 0.7) / 0.3, 0, 1));
    }
  }

  /* ============================ 8. World ============================ */
  var World = {
    group: null, fireflies: null, fireflyData: [], animatedLanterns: [], cats: [], bats: [],
    build: function () {
      Collision.clear();
      this.group = new THREE.Group();
      scene.add(this.group);
      buildGround(this.group);
      buildRingRoad(this.group);
      buildFence(this.group);
      LANDMARKS.forEach(function (lm) { buildLandmark(lm, World.group); });
      STALL_DEFS.forEach(function (def, i) {
        var a = (i / STALL_DEFS.length) * Math.PI * 2;
        buildStall(def, Math.sin(a) * 24, Math.cos(a) * 24, World.group);
      });
      buildLanternRing(this.group);
      buildRiver(this.group);
      buildRiceField(this.group);
      buildLotusPond(this.group);
      buildAnimals(this.group);
      this.buildFireflies();
      buildAmbientLanterns(this.group);
    },

    buildFireflies: function () {
      var N = CONFIG.decorFireflies, pos = new Float32Array(N * 3);
      this.fireflyData = [];
      for (var i = 0; i < N; i++) {
        var a = rng() * Math.PI * 2, r = 12 + rng() * 50;
        var x = Math.sin(a) * r, z = Math.cos(a) * r;
        if (distXZ(x, z, 45, -10) > 34 && rng() < 0.5) { x = 45 + (rng() - 0.5) * 16; z = -10 + (rng() - 0.5) * 16; }
        var y = 0.6 + rng() * 3.4;
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
        this.fireflyData.push({ x: x, y: y, z: z, ph: rng() * 6.28, sp: 0.4 + rng() * 0.7 });
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.fireflies = new THREE.Points(g, new THREE.PointsMaterial({
        color: CONFIG.colors.mint, size: 0.42, transparent: true, opacity: 0.95,
        blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
      }));
      scene.add(this.fireflies);
    },

    update: function (dt, t) {
      // kunang-kunang dekor: naik-turun halus
      var arr = this.fireflies.geometry.attributes.position.array;
      for (var i = 0; i < this.fireflyData.length; i++) {
        var f = this.fireflyData[i];
        arr[i * 3] = f.x + Math.sin(t * f.sp + f.ph) * 0.7;
        arr[i * 3 + 1] = f.y + Math.sin(t * f.sp * 1.7 + f.ph) * 0.5;
        arr[i * 3 + 2] = f.z + Math.cos(t * f.sp * 0.8 + f.ph) * 0.7;
      }
      this.fireflies.geometry.attributes.position.needsUpdate = true;

      // lampion bergoyang
      for (var j = 0; j < this.animatedLanterns.length; j++) {
        var L = this.animatedLanterns[j];
        L.mesh.rotation.z = Math.sin(t * 0.9 + L.ph) * 0.12;
        L.mesh.position.y = L.baseY + Math.sin(t * 1.3 + L.ph) * 0.06;
      }
      // kucing menoleh
      for (var c = 0; c < this.cats.length; c++) {
        var cat = this.cats[c];
        cat.group.rotation.y = lerpAngle(cat.group.rotation.y, Math.atan2(Player.pos.x - cat.group.position.x, Player.pos.z - cat.group.position.z), 1 - Math.exp(-2 * dt));
      }
    }
  };

  function buildGround(parent) {
    var g = new THREE.CircleGeometry(CONFIG.world.radius + 6, 72);
    g.rotateX(-Math.PI / 2);
    var m = new THREE.MeshStandardMaterial({ map: TEX.ground, color: CONFIG.colors.ground, roughness: 0.95, metalness: 0 });
    m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping;
    m.map.repeat.set(28, 28);
    var mesh = new THREE.Mesh(g, m);
    mesh.receiveShadow = qualityTier >= 2;
    parent.add(mesh);
  }

  function buildRingRoad(parent) {
    var g = new THREE.RingGeometry(20, 28, 64);
    g.rotateX(-Math.PI / 2);
    var m = new THREE.MeshStandardMaterial({ color: CONFIG.colors.path, roughness: 1, side: THREE.DoubleSide });
    var ring = new THREE.Mesh(g, m);
    ring.position.y = 0.02;
    parent.add(ring);
    // jalur dari/ke gapura
    var pathG = new THREE.PlaneGeometry(6, 26);
    pathG.rotateX(-Math.PI / 2);
    var path = new THREE.Mesh(pathG, m);
    path.position.set(0, 0.02, 40);
    parent.add(path);
  }

  function buildFence(parent) {
    var count = 120, post = new THREE.CylinderGeometry(0.13, 0.16, 3.2, 6);
    var inst = new THREE.InstancedMesh(post, new THREE.MeshStandardMaterial({ color: 0x5a4632, flatShading: true, roughness: 1 }), count);
    var mtx = new THREE.Matrix4();
    for (var i = 0; i < count; i++) {
      var a = (i / count) * Math.PI * 2, x = Math.sin(a) * (CONFIG.world.radius + 1.5), z = Math.cos(a) * (CONFIG.world.radius + 1.5);
      mtx.makeTranslation(x, 1.6, z);
      inst.setMatrixAt(i, mtx);
    }
    inst.instanceMatrix.needsUpdate = true;
    parent.add(inst);
    // pepohonan gelap di luar batas
    var treeGeo = new THREE.IcosahedronGeometry(3.4, 0);
    var treeMat = new THREE.MeshStandardMaterial({ color: 0x14203a, flatShading: true, roughness: 1 });
    var trees = new THREE.InstancedMesh(treeGeo, treeMat, 70);
    for (var t = 0; t < 70; t++) {
      var ang = (t / 70) * Math.PI * 2 + rng() * 0.05;
      var rr = CONFIG.world.radius + 4 + rng() * 12;
      mtx.compose(
        new THREE.Vector3(Math.sin(ang) * rr, 2 + rng() * 5, Math.cos(ang) * rr),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rng(), rng(), rng())),
        new THREE.Vector3(1, 1.2 + rng(), 1)
      );
      trees.setMatrixAt(t, mtx);
    }
    trees.instanceMatrix.needsUpdate = true;
    parent.add(trees);
  }

  function buildRiver(parent) {
    var g = new THREE.PlaneGeometry(140, 10, 1, 1);
    g.rotateX(-Math.PI / 2);
    var mat = new THREE.MeshStandardMaterial({
      color: 0x0d2a4a, roughness: 0.25, metalness: 0.5, transparent: true, opacity: 0.9
    });
    var river = new THREE.Mesh(g, mat);
    river.position.set(0, -0.35, -54);
    parent.add(river);
    // pagar bambu sisi utara sungai
    var rails = [];
    for (var i = -1; i <= 1; i += 0.08) {
      rails.push(new THREE.Vector3(i * 30, 1, -60));
    }
    var rg = new THREE.BoxGeometry(0.12, 0.12, 1);
    var inst = new THREE.InstancedMesh(rg, new THREE.MeshStandardMaterial({ color: 0x6b5a3a, flatShading: true }), rails.length);
    var mtx = new THREE.Matrix4();
    for (var r = 0; r < rails.length; r++) {
      mtx.makeTranslation(rails[r].x, 1.2, -60);
      mtx.multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
      inst.setMatrixAt(r, mtx);
    }
    inst.instanceMatrix.needsUpdate = true;
    parent.add(inst);
  }

  function buildRiceField(parent) {
    var blade = new THREE.PlaneGeometry(0.35, 1.5);
    blade.translate(0, 0.75, 0);
    var mat = new THREE.MeshStandardMaterial({ color: 0x4e7f3a, side: THREE.DoubleSide, roughness: 1, flatShading: true });
    var count = 380;
    var inst = new THREE.InstancedMesh(blade, mat, count);
    var mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
    var i = 0;
    for (var gx = -1; gx <= 1; gx++) for (var gz = -1; gz <= 1; gz++) {
      for (var k = 0; k < 42 && i < count; k++, i++) {
        var x = 45 + gx * 4 + (rng() - 0.5) * 3.4, z = -10 + gz * 4 + (rng() - 0.5) * 3.4;
        if (distXZ(x, z, 45, -10) > 9) { i--; continue; }
        q.setFromEuler(new THREE.Euler(0, rng() * 3.14, (rng() - 0.5) * 0.3));
        mtx.compose(new THREE.Vector3(x, 0, z), q, s);
        inst.setMatrixAt(i, mtx);
      }
    }
    for (; i < count; i++) { mtx.makeTranslation(0, -20, 0); inst.setMatrixAt(i, mtx); }
    inst.instanceMatrix.needsUpdate = true;
    parent.add(inst);
    Collision.addCircle(45, -10, 8.6);
  }

  function buildLotusPond(parent) {
    var g = new THREE.CircleGeometry(9, 32);
    g.rotateX(-Math.PI / 2);
    var water = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
      color: 0x0a3a44, emissive: 0x0b5a63, emissiveIntensity: 0.35, roughness: 0.2, metalness: 0.4
    }));
    water.position.set(35, 0.03, -35);
    parent.add(water);
    var lily = new THREE.CircleGeometry(1.1, 12);
    lily.rotateX(-Math.PI / 2);
    var inst = new THREE.InstancedMesh(lily, new THREE.MeshStandardMaterial({ color: 0x2e6b52, side: THREE.DoubleSide, flatShading: true }), 14);
    var mtx = new THREE.Matrix4();
    for (var i = 0; i < 14; i++) {
      var a = rng() * 6.28, r = rng() * 7;
      mtx.makeTranslation(35 + Math.sin(a) * r, 0.06, -35 + Math.cos(a) * r);
      inst.setMatrixAt(i, mtx);
    }
    inst.instanceMatrix.needsUpdate = true;
    parent.add(inst);
    Collision.addCircle(35, -35, 8.6);
  }

  function buildLanternRing(parent) {
    // cincin lampion di bawah Beringin
    for (var i = 0; i < 12; i++) {
      var a = (i / 12) * Math.PI * 2;
      addLantern(parent, Math.sin(a) * 9, 4.4, Math.cos(a) * 9, false);
    }
  }

  function addLantern(parent, x, y, z, animate) {
    var geo = new THREE.SphereGeometry(0.36, 10, 8);
    var mat = new THREE.MeshBasicMaterial({ color: 0xffc24d });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    var glow = glowSprite(0xffc24d, 3.4, 0.6);
    mesh.add(glow);
    parent.add(mesh);
    lanternPositions.push(new THREE.Vector3(x, y, z));
    lanternMeshes.push(mesh);
    if (animate) World.animatedLanterns.push({ mesh: mesh, ph: rng() * 6.28, baseY: y });
    return mesh;
  }

  function buildAmbientLanterns(parent) {
    // sebar lampion sepanjang jalur & titik acak
    for (var i = 0; i < CONFIG.lanterns.count - 12; i++) {
      var a = rng() * Math.PI * 2, r = 10 + rng() * 55;
      var x = Math.sin(a) * r, z = Math.cos(a) * r;
      addLantern(parent, x, 3.2 + rng() * 2.2, z, true);
    }
  }

  /* ---------- landmark builders ---------- */
  function woodMat() { return new THREE.MeshStandardMaterial({ color: 0x5a4632, flatShading: true, roughness: 1 }); }
  function block(w, h, d, color, flat) {
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: color, flatShading: flat !== false, roughness: 0.85 }));
  }
  function place(mesh, x, y, z, ry) { mesh.position.set(x, y, z); if (ry) mesh.rotation.y = ry; return mesh; }

  function buildLandmark(lm, parent) {
    var g = new THREE.Group();
    g.position.set(lm.x, 0, lm.z);
    parent.add(g);
    switch (lm.id) {
      case 1: { // Gapura Masuk
        g.add(place(block(0.7, 7, 0.7, 0x4b3a28), -4, 3.5, 0));
        g.add(place(block(0.7, 7, 0.7, 0x4b3a28), 4, 3.5, 0));
        var beam = block(9.4, 0.8, 0.9, 0x3d2f20); g.add(place(beam, 0, 7.2, 0));
        g.add(place(textSprite('GHOSTDASH', '#FF3DA5', null, 512, 128, 78), 0, 8.8, 0));
        addLantern(g, -4, 6.2, 0, true); addLantern(g, 4, 6.2, 0, true);
        Collision.addBox(lm.x - 4.5, lm.z - 0.6, lm.x - 3.5, lm.z + 0.6);
        Collision.addBox(lm.x + 3.5, lm.z - 0.6, lm.x + 4.5, lm.z + 0.6);
        break;
      }
      case 2: { // Pohon Beringin
        var trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.4, 9, 9), woodMat());
        g.add(place(trunk, 0, 4.5, 0));
        var canopyGeo = new THREE.IcosahedronGeometry(4.2, 0);
        for (var i = 0; i < 7; i++) {
          var a = (i / 7) * Math.PI * 2;
          var leaf = new THREE.Mesh(canopyGeo, new THREE.MeshStandardMaterial({
            color: i % 2 ? 0x1f4a34 : 0x245a3d, flatShading: true, roughness: 1
          }));
          g.add(place(leaf, Math.sin(a) * 3.6, 10 + (i % 3) * 1.6, Math.cos(a) * 3.6));
        }
        // sulur menjuntai
        for (var s = 0; s < 14; s++) {
          var sa = (s / 14) * Math.PI * 2;
          var vine = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.05, 4 + rng() * 3, 5), woodMat());
          g.add(place(vine, Math.sin(sa) * 5.2, 7.4, Math.cos(sa) * 5.2));
        }
        Collision.addCircle(lm.x, lm.z, 2.6);
        break;
      }
      case 3: { // Panggung Wayang
        var base = block(8, 1, 5, 0x3a2d3f); g.add(place(base, 0, 0.5, 0));
        var screen = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.4),
          new THREE.MeshBasicMaterial({ color: 0xf0e3c0, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
        g.add(place(screen, 0, 2.8, -2.2));
        var frame = block(6.8, 0.35, 0.3, 0x2a1f2f); g.add(place(frame, 0, 4.65, -2.2));
        g.add(place(glowSprite(0xffe6a8, 9, 0.4), 0, 2.8, -2));
        Collision.addBox(lm.x - 4, lm.z - 2.6, lm.x + 4, lm.z + 2.6);
        break;
      }
      case 4: { // Pos Ronda
        var hut = block(3.4, 2.6, 3.4, 0x4a3b28); g.add(place(hut, 0, 1.3, 0));
        var roof = new THREE.Mesh(new THREE.ConeGeometry(3.1, 1.8, 4), new THREE.MeshStandardMaterial({ color: 0x3a2f1e, flatShading: true }));
        g.add(place(roof, 0, 3.5, 0, Math.PI / 4));
        var lt = new THREE.PointLight(0xffd27a, 0.9, 10, 2); g.add(place(lt, 0, 2.6, 0));
        var kentongan = block(0.3, 1.4, 0.3, 0x6b5a3a); g.add(place(kentongan, 1.9, 0.7, 1.6));
        Collision.addBox(lm.x - 1.9, lm.z - 1.9, lm.x + 1.9, lm.z + 1.9);
        break;
      }
      case 5: { // Jembatan Bambu
        var deck = block(4, 0.3, 12, 0x8a7346); g.add(place(deck, 0, 0.5, 0));
        var rail;
        for (var r = -1; r <= 1; r += 2) {
          rail = block(0.16, 0.16, 12, 0x6b5a3a); g.add(place(rail, r * 1.9, 1.5, 0));
          for (var p = -5; p <= 5; p += 2.5) g.add(place(block(0.16, 1.1, 0.16, 0x6b5a3a), r * 1.9, 1, p));
        }
        Collision.addBox(lm.x - 2, lm.z - 6, lm.x - 1.7, lm.z + 6);
        Collision.addBox(lm.x + 1.7, lm.z - 6, lm.x + 2, lm.z + 6);
        break;
      }
      case 6: { // Sawah Cahaya — padi dibuat di buildRiceField, di sini penanda
        g.add(place(textSprite('SAWAH CAHAYA', '#7CFFB2', null, 512, 128, 54), 0, 4, 0));
        break;
      }
      case 7: { // Gang Gelap
        g.add(place(block(6, 5, 14, 0x2a2536), -3.5, 2.5, 0));
        g.add(place(block(6, 5, 14, 0x2a2536), 3.5, 2.5, 0));
        for (var l = -5; l <= 5; l += 5) addLantern(g, 0, 4, l, true);
        Collision.addBox(lm.x - 6.5, lm.z - 7, lm.x - 0.5, lm.z + 7);
        Collision.addBox(lm.x + 0.5, lm.z - 7, lm.x + 6.5, lm.z + 7);
        break;
      }
      case 8: { // Kolam Teratai — air di buildLotusPond
        g.add(place(textSprite('KOLAM TERATAI', '#3DF2FF', null, 512, 128, 54), 0, 4.5, 0));
        break;
      }
      case 9: { // Bangku Taman
        var seat = block(3, 0.25, 0.9, 0x5a4632); g.add(place(seat, 0, 0.9, 0));
        g.add(place(block(3, 0.8, 0.25, 0x5a4632), 0, 1.4, -0.35));
        g.add(place(block(0.25, 0.9, 0.9, 0x4b3a28), -1.3, 0.45, 0));
        g.add(place(block(0.25, 0.9, 0.9, 0x4b3a28), 1.3, 0.45, 0));
        var lamp = new THREE.PointLight(0xffe0a0, 0.7, 8, 2); g.add(place(lamp, 2.6, 3, 0));
        var pole = block(0.18, 3.4, 0.18, 0x33404f); g.add(place(pole, 2.6, 1.7, 0));
        g.add(place(glowSprite(0xfff0c0, 3, 0.5), 2.6, 3, 0));
        g.userData.flicker = lamp;
        World.flicker = g;
        Collision.addBox(lm.x - 1.6, lm.z - 0.6, lm.x + 1.6, lm.z + 0.6);
        break;
      }
      case 10: { // Menara Air
        for (var lg = -1; lg <= 1; lg += 2) for (var lz = -1; lz <= 1; lz += 2) {
          g.add(place(block(0.35, 7, 0.35, 0x4a5568), lg * 2.2, 3.5, lz * 2.2));
        }
        var tank = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 3, 14),
          new THREE.MeshStandardMaterial({ color: 0x7c8aa0, flatShading: true, metalness: 0.3, roughness: 0.6 }));
        g.add(place(tank, 0, 8.6, 0));
        Collision.addBox(lm.x - 2.6, lm.z - 2.6, lm.x + 2.6, lm.z + 2.6);
        break;
      }
      case 11: { // Warung Pojok
        var body = block(4, 2.4, 3, 0x4b3a2a); g.add(place(body, 0, 1.2, 0));
        var roof2 = block(5, 0.3, 4, 0x7a2f3f); g.add(place(roof2, 0, 2.7, 0));
        g.add(place(textSprite('BUKA 24 JAM (ARWAH)', '#FFC24D', null, 1024, 180, 60), 0, 3.6, 0));
        addLantern(g, -1.6, 2.4, 1.6, true); addLantern(g, 1.6, 2.4, 1.6, true);
        Collision.addBox(lm.x - 2.2, lm.z - 1.8, lm.x + 2.2, lm.z + 1.8);
        break;
      }
      case 12: { // Tikungan Lampion
        for (var k = 0; k < 9; k++) {
          var ka = (k / 9) * Math.PI * 1.1 - 0.4;
          addLantern(g, Math.sin(ka) * 7, 3.6, Math.cos(ka) * 7, true);
        }
        break;
      }
    }
    // papan nama landmark (kecuali yang sudah punya teks besar)
    if ([6, 8, 11].indexOf(lm.id) < 0) {
      var name = textSprite(lm.name, '#F5F3FF', null, 512, 96, 46);
      name.position.set(0, 2.4, 0);
      name.scale.multiplyScalar(1.6);
      g.add(name);
    }
  }

  function buildStall(def, x, z, parent) {
    var item = ITEMS[def.item];
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = Math.atan2(-x, -z);
    parent.add(g);

    var base = block(4.4, 0.35, 3, 0x33263f); g.add(place(base, 0, 0.5, 0));
    var table = block(3.6, 0.2, 1.4, 0x6b4f36); g.add(place(table, 0, 1.15, 0.6));
    g.add(place(block(0.22, 1.4, 0.22, 0x4b3a28), -1.7, 0.7, 0.6));
    g.add(place(block(0.22, 1.4, 0.22, 0x4b3a28), 1.7, 0.7, 0.6));
    g.add(place(block(0.22, 2.2, 0.22, 0x4b3a28), -1.9, 1.1, -1.2));
    g.add(place(block(0.22, 2.2, 0.22, 0x4b3a28), 1.9, 1.1, -1.2));

    // atap miring bergaris
    var roof = new THREE.Mesh(new THREE.BoxGeometry(5, 0.25, 3.6),
      new THREE.MeshStandardMaterial({ map: TEX.stripes, flatShading: true, roughness: 0.9 }));
    roof.material.map.wrapS = roof.material.map.wrapT = THREE.RepeatWrapping;
    roof.material.map.repeat.set(3, 1);
    roof.position.set(0, 2.6, -0.2);
    roof.rotation.x = -0.22;
    g.add(roof);
    g.add(place(block(0.16, 0.16, 3.2, 0x4b3a28), -2.2, 3.1, -0.2));
    g.add(place(block(0.16, 0.16, 3.2, 0x4b3a28), 2.2, 3.1, -0.2));

    // papan nama neon
    var sign = textSprite(def.no + '. ' + item.name, '#3DF2FF', 'rgba(0,0,0,0.35)', 640, 128, 56);
    sign.position.set(0, 3.4, 0.4);
    g.add(sign);

    addLantern(g, -2.1, 2.5, 1.3, true);
    addLantern(g, 2.1, 2.5, 1.3, true);

    // cincin interaksi di tanah
    var ringGeo = new THREE.RingGeometry(1.7, 2.1, 36);
    ringGeo.rotateX(-Math.PI / 2);
    var ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      color: CONFIG.colors.neonCyan, transparent: true, opacity: 0.18, side: THREE.DoubleSide
    }));
    ring.position.set(0, 0.05, 1.8);
    g.add(ring);

    // uap
    var steam = new THREE.Points(steamGeometry(), new THREE.PointsMaterial({
      color: 0xffffff, size: 0.5, transparent: true, opacity: 0.16, depthWrite: false, sizeAttenuation: true
    }));
    steam.position.set(0, 1.3, 0.6);
    g.add(steam);

    var inward = new THREE.Vector2(-x, -z).normalize();
    var stall = {
      no: def.no, item: item, x: x, z: z, ring: ring, steam: steam,
      interactX: x + inward.x * 3.2, interactZ: z + inward.y * 3.2
    };
    Stalls.list.push(stall);
    Collision.addBox(x - 2.3, z - 1.6, x + 2.3, z + 1.6);
  }

  function steamGeometry() {
    var n = 18, arr = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      arr[i * 3] = (rng() - 0.5) * 1.4;
      arr[i * 3 + 1] = rng() * 2.4;
      arr[i * 3 + 2] = (rng() - 0.5) * 1.2;
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return g;
  }

  function buildAnimals(parent) {
    // kucing hitam di atap lapak
    for (var i = 0; i < 3; i++) {
      var s = Stalls.list[i * 3 % Stalls.list.length];
      if (!s) continue;
      var cat = new THREE.Group();
      var body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x0e0e14, flatShading: true }));
      body.scale.set(1, 0.8, 1.5);
      cat.add(body);
      var head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x0e0e14, flatShading: true }));
      head.position.set(0, 0.22, 0.42);
      cat.add(head);
      var eyeMat = new THREE.MeshBasicMaterial({ color: 0x7cffb2 });
      var e1 = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), eyeMat); e1.position.set(-0.09, 0.28, 0.56);
      var e2 = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), eyeMat); e2.position.set(0.09, 0.28, 0.56);
      cat.add(e1); cat.add(e2);
      cat.position.set(s.x + 1.2, 2.85, s.z - 0.4);
      cat.rotation.y = rng() * 6.28;
      parent.add(cat);
      World.cats.push({ group: cat });
    }
  }

  /* ============================ 9. Player ============================ */
  var Player = {
    group: null, pos: new THREE.Vector3(), vel: new THREE.Vector3(),
    facing: 0, walkPhase: 0, limbs: null, bag: null, bagLight: null,
    kind: 'raka', moving: false,

    build: function (kind) {
      if (this.group) scene.remove(this.group);
      this.kind = kind;
      var jacket = kind === 'nala' ? 0xff3da5 : 0xff8a3d;
      var g = new THREE.Group();

      var skin = new THREE.MeshStandardMaterial({ color: 0xd8a878, flatShading: true });
      var cloth = new THREE.MeshStandardMaterial({ color: jacket, flatShading: true });
      var pants = new THREE.MeshStandardMaterial({ color: 0x2a2a3d, flatShading: true });
      var dark = new THREE.MeshStandardMaterial({ color: 0x14141c, flatShading: true });

      var torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.7, 10), cloth);
      torso.position.y = 1.05; g.add(torso);

      var head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 12), skin);
      head.position.y = 1.6; g.add(head);
      var eyeMat = new THREE.MeshBasicMaterial({ color: 0x14141c });
      var eye1 = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), eyeMat); eye1.position.set(-0.1, 1.65, 0.26);
      var eye2 = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), eyeMat); eye2.position.set(0.1, 1.65, 0.26);
      g.add(eye1); g.add(eye2);

      if (kind === 'nala') {
        var hair = new THREE.Mesh(new THREE.SphereGeometry(0.31, 12, 10, 0, 6.28, 0, 1.5), dark);
        hair.position.y = 1.63; g.add(hair);
        var tail = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.5, 8), dark);
        tail.position.set(0, 1.42, -0.28); tail.rotation.x = 0.5; g.add(tail);
      } else {
        var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.16, 12), dark);
        cap.position.y = 1.78; g.add(cap);
        var brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 12), dark);
        brim.position.set(0, 1.72, 0.06); g.add(brim);
      }

      function limb(x, y, color) {
        var pivot = new THREE.Group();
        pivot.position.set(x, y, 0);
        var mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.62, 8), color);
        mesh.position.y = -0.31;
        pivot.add(mesh);
        g.add(pivot);
        return pivot;
      }
      var armL = limb(-0.36, 1.3, cloth), armR = limb(0.36, 1.3, cloth);
      var legL = limb(-0.16, 0.72, pants), legR = limb(0.16, 0.72, pants);

      // tas delivery menyala
      var bagGroup = new THREE.Group();
      var bagBox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x2b2f4a, emissive: 0x3df2ff, emissiveIntensity: 0.35, flatShading: true }));
      bagGroup.add(bagBox);
      var bagGlow = glowSprite(0x3df2ff, 1.9, 0.45);
      bagGroup.add(bagGlow);
      bagGroup.position.set(0, 1.05, -0.32);
      g.add(bagGroup);
      this.bag = bagGroup;
      this.bagLight = new THREE.PointLight(0x3df2ff, 0.5, 5, 2);
      bagGroup.add(this.bagLight);

      g.position.set(CONFIG.spawn.x, 0, CONFIG.spawn.z);
      // bayangan dinamis hanya dibutuhkan saat kualitas >= sedang
      if (qualityTier >= 2) {
        g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
      }
      this.limbs = { armL: armL, armR: armR, legL: legL, legR: legR, torso: torso, head: head };
      this.group = g;
      scene.add(g);
      this.pos.set(g.position.x, 0, g.position.z);
      this.facing = Math.PI;
      g.rotation.y = this.facing;
      return g;
    },

    update: function (dt) {
      var speed = Input.running ? CONFIG.player.run : CONFIG.player.walk;
      if (Prank.active === 'sticky') speed *= 0.6;
      var mx = Input.move.x, mz = Input.move.y;
      var mag = Math.hypot(mx, mz);
      var desiredX = 0, desiredZ = 0;
      if (mag > 0.02) {
        var d = camRelativeMove(Cam.yaw, mx, mz);
        desiredX = d.x * speed;
        desiredZ = d.z * speed;
        if (Prank.reversed) { desiredX = -desiredX; desiredZ = -desiredZ; }
      }
      this.vel.x = damp(this.vel.x, desiredX, CONFIG.player.accel, dt);
      this.vel.z = damp(this.vel.z, desiredZ, CONFIG.player.accel, dt);

      this.pos.x += this.vel.x * dt;
      this.pos.z += this.vel.z * dt;
      Collision.resolve(this.pos, CONFIG.player.radius);
      if (this.dashTime > 0) {
        this.pos.x += this.dashDir.x * this.dashSpeed * dt;
        this.pos.z += this.dashDir.z * this.dashSpeed * dt;
        this.dashTime = Math.max(0, this.dashTime - dt);
        Collision.resolve(this.pos, CONFIG.player.radius);
      }

      this.moving = Math.hypot(this.vel.x, this.vel.z) > 0.4;
      if (this.moving) {
        var target = Math.atan2(this.vel.x, this.vel.z);
        this.facing = lerpAngle(this.facing, target, 1 - Math.exp(-CONFIG.player.turn * dt));
      }
      this.group.position.set(this.pos.x, 0, this.pos.z);
      this.group.rotation.y = this.facing;

      // animasi
      var rate = (Input.running ? 13 : 8.5);
      this.walkPhase += dt * rate * (this.moving ? 1 : 0);
      var sw = this.moving ? Math.sin(this.walkPhase) * (Input.running ? 0.85 : 0.6) : 0;
      this.limbs.legL.rotation.x = sw;
      this.limbs.legR.rotation.x = -sw;
      this.limbs.armL.rotation.x = -sw * 0.8;
      this.limbs.armR.rotation.x = sw * 0.8;
      this.limbs.torso.rotation.x = Input.running && this.moving ? 0.16 : 0;
      this.group.position.y = Math.abs(Math.sin(this.walkPhase)) * (this.moving ? 0.06 : 0) + (this.jumpY || 0);
      this.bag.rotation.z = Math.sin(this.walkPhase * 0.5) * 0.06;
    },

    stepSound: function (dt) {
      if (!this.moving) { this._stepT = 0; return; }
      this._stepT = (this._stepT || 0) + dt * (Input.running ? 3.4 : 2.2);
      if (this._stepT >= 1) { this._stepT = 0; AudioEngine.playSfx('step'); }
    },
    dash: function () {
      var dx = this.vel.x, dz = this.vel.z, d = Math.hypot(dx, dz);
      if (d < 0.2) { dx = Math.sin(Cam.yaw); dz = -Math.cos(Cam.yaw); d = 1; }
      this.dashDir = { x: dx / d, z: dz / d };
      this.dashSpeed = 17; this.dashTime = 0.24;
    }
  };

  /* ============================ 10. Companion ============================ */
  var Companion = {
    group: null, t: 0, target: null,
    build: function () {
      var g = new THREE.Group();
      var core = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8),
        new THREE.MeshBasicMaterial({ color: CONFIG.colors.mint }));
      g.add(core);
      g.add(glowSprite(CONFIG.colors.mint, 1.5, 0.7));
      this.group = g;
      scene.add(g);
    },
    update: function (dt) {
      this.t += dt;
      var px = Player.pos.x, pz = Player.pos.z;
      var tx = px + Math.sin(this.t * 0.7) * 0.7, tz = pz + Math.cos(this.t * 0.6) * 0.7;
      var currentOrder = OrderSystem.active[0];
      this.target = currentOrder ? (currentOrder.picked ? currentOrder.target : { x: currentOrder.stall.interactX, z: currentOrder.stall.interactZ, name: 'Lapak ' + currentOrder.stall.no }) : null;
      if (this.target) {
        var dx = this.target.x - px, dz = this.target.z - pz;
        var d = Math.hypot(dx, dz) || 1;
        tx += (dx / d) * 1.5; tz += (dz / d) * 1.5;
      }
      var g = this.group;
      g.position.x = damp(g.position.x, tx, 4, dt);
      g.position.z = damp(g.position.z, tz, 4, dt);
      g.position.y = damp(g.position.y, 1.55 + Math.sin(this.t * 2.2) * 0.12, 3, dt);
    }
  };

  /* ============================ 11. Camera ============================ */
  var Cam = {
    // yaw = 0 → kamera di selatan pemain, menghadap pusat pasar (utara). Salah satu bug yang ditemukan saat uji.
    yaw: 0, pitch: 0.22, dist: CONFIG.camera.dist,
    shake: 0, tilt: 0, autoOrbit: false, autoSpeed: 0.12, targetPos: new THREE.Vector3(),
    _lastYaw: null, _follow: 0, _manualT: 0,
    update: function (dt, mode) {
      if (mode === 'title') {
        this.yaw += this.autoSpeed * dt;
        this.pitch = damp(this.pitch, 0.28, 2, dt);
        var r = 58;
        var cx = Math.sin(this.yaw) * r, cz = Math.cos(this.yaw) * r;
        var tx = cx, tz = cz;
        var ty = 14 + Math.sin(this.yaw * 0.6) * 3;
        camera.position.x = damp(camera.position.x, tx, 1.6, dt);
        camera.position.y = damp(camera.position.y, ty, 1.6, dt);
        camera.position.z = damp(camera.position.z, tz, 1.6, dt);
        camera.lookAt(0, 7, 0);
        return;
      }
      if (mode === 'end') {
        this.yaw += 0.18 * dt;
      } else {
        var manual = Input.look.x !== 0 || Input.look.y !== 0;
        this.yaw += Input.look.x;
        this.pitch += Input.look.y;
        Input.look.x = 0; Input.look.y = 0;
        // Jeda 0.7s setelah kamera digeser manual: jari berhenti bukan berarti
        // pemain melepas kamera.
        if (manual) this._manualT = 0.7;
        else if (this._manualT > 0) this._manualT = Math.max(0, this._manualT - dt);

        // Kamera mengikuti arah jalan pemain: lembut, ada dead-zone supaya
        // strafe kecil tidak bikin kamera melayang, dan mati saat manual.
        // Hanya aktif saat ada dorongan MAJU — kalau tidak, strafe A/D di
        // desktop berubah jadi belok terus (kamera mengejar arah hadap).
        var fwd = clamp(-Input.move.y, 0, 1);
        var wantFollow = (!manual && this._manualT === 0 && Game.state === 'PLAY' &&
          Player.moving && !Prank.reversed) ? fwd : 0;
        this._follow = damp(this._follow, wantFollow, 2.2, dt);
        // Koreksi hanya saat benar-benar maju. Tanpa gerbang fwd, sisa decay
        // _follow tetap memutar yaw ketika strafe/mundur -> jalur melengkung.
        if (this._follow > 0.01 && fwd > 0.15) {
          var delta = normAngle(Player.facing + Math.PI - this.yaw);
          if (Math.abs(delta) > CONFIG.camera.followDead) {
            var want = lerpAngle(this.yaw, Player.facing + Math.PI,
              1 - Math.exp(-CONFIG.camera.follow * this._follow * dt));
            // Batasi laju putar supaya W+D tidak jadi spiral tak berujung.
            var step = clamp(normAngle(want - this.yaw),
              -CONFIG.camera.followMax * dt, CONFIG.camera.followMax * dt);
            this.yaw += step;
          }
        }
      }
      this.pitch = clamp(this.pitch, CONFIG.camera.pitchMin * Math.PI / 180, CONFIG.camera.pitchMax * Math.PI / 180);
      this.dist = clamp(this.dist + Input.zoom, CONFIG.camera.distMin, CONFIG.camera.distMax);
      Input.zoom = 0;

      var t = Player.group ? Player.group.position : new THREE.Vector3();
      this.targetPos.set(t.x, t.y + 1.35, t.z);
      var hDist = Math.cos(this.pitch) * this.dist;
      var cx2 = this.targetPos.x + Math.sin(this.yaw) * hDist;
      var cz2 = this.targetPos.z + Math.cos(this.yaw) * hDist;
      var cy2 = this.targetPos.y + Math.sin(this.pitch) * this.dist + 0.6;
      cy2 = Math.max(cy2, 0.6);
      camera.position.x = damp(camera.position.x, cx2, CONFIG.camera.smooth, dt);
      camera.position.y = damp(camera.position.y, cy2, CONFIG.camera.smooth, dt);
      camera.position.z = damp(camera.position.z, cz2, CONFIG.camera.smooth, dt);
      camera.lookAt(this.targetPos);

      if (!Settings.reducedMotion && this.shake > 0) {
        this.shake = Math.max(0, this.shake - dt * 2);
        camera.position.x += (Math.random() - 0.5) * this.shake;
        camera.position.y += (Math.random() - 0.5) * this.shake;
      }
      if (!Settings.reducedMotion && this.tilt) camera.rotation.z += this.tilt;
    }
  };

  // Gameplay systems: delivery loop, pelanggan, kunang kolektibel, skor, tutorial.
  var Stalls = {
    list: [],
    nearest: function (x, z, radius) {
      var best = null, bd = radius * radius;
      for (var i = 0; i < this.list.length; i++) {
        var s = this.list[i];
        var d = distSqXZ(x, z, s.interactX, s.interactZ);
        if (d < bd) { bd = d; best = s; }
      }
      return best;
    },
    update: function (dt, t) {
      for (var i = 0; i < this.list.length; i++) {
        var s = this.list[i];
        var active = OrderSystem.stallHighlight.indexOf(s.no) >= 0;
        s.ring.material.opacity = active ? 0.48 + Math.sin(t * 3) * 0.16 : 0.12;
        s.ring.material.color.setHex(active ? CONFIG.colors.amber : CONFIG.colors.neonCyan);
        s.steam.position.y = 1.3 + Math.sin(t * 1.4 + i) * 0.12;
      }
    }
  };

  var Customers = {
    list: [],
    types: [
      { id: 'bocil', name: 'Bocil Gaib', color: 0x3df2ff, patience: 0.8, scale: 0.8, icon: '👻' },
      { id: 'om', name: 'Om Gembul', color: 0xffc24d, patience: 1.25, scale: 1.15, icon: '👻' }
    ],
    create: function (type, landmark, order) {
      var g = new THREE.Group(), c = type.color;
      var body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.48, 1.25, 10),
        new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.45, transparent: true, opacity: 0.78, flatShading: true }));
      body.position.y = 0.65; g.add(body);
      var head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 8),
        new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.35, transparent: true, opacity: 0.8, flatShading: true }));
      head.position.y = 1.35; g.add(head);
      var eyeMat = new THREE.MeshBasicMaterial({ color: 0x161328 });
      [-0.13, 0.13].forEach(function (x) {
        var eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), eyeMat);
        eye.position.set(x, 1.4, 0.32); g.add(eye);
      });
      g.scale.setScalar(type.scale);
      g.position.set(landmark.x, 0, landmark.z);
      scene.add(g);
      var bubble = textSprite(type.icon + '  ' + order.item.icon + '  ' + Math.ceil(order.time) + 's', '#F5F3FF', 'rgba(15,12,32,.82)', 420, 96, 36);
      bubble.position.set(landmark.x, 2.8 * type.scale, landmark.z);
      bubble.scale.set(4.2, 0.96, 1);
      scene.add(bubble);
      var customer = { group: g, bubble: bubble, type: type, landmark: landmark, order: order, phase: rng() * 6.28, alive: true };
      this.list.push(customer);
      order.customer = customer;
      order.target = landmark;
      return customer;
    },
    remove: function (c) {
      if (!c) return;
      scene.remove(c.group); scene.remove(c.bubble);
      c.alive = false;
      var i = this.list.indexOf(c); if (i >= 0) this.list.splice(i, 1);
    },
    update: function (dt, t) {
      for (var i = 0; i < this.list.length; i++) {
        var c = this.list[i];
        c.group.position.y = 0.12 + Math.sin(t * 2.2 + c.phase) * 0.15;
        c.group.rotation.y = Math.sin(t * 0.6 + c.phase) * 0.16;
        c.bubble.position.y = 2.8 * c.type.scale + Math.sin(t * 2 + c.phase) * 0.1;
        c.bubble.material.map.needsUpdate = true;
        // redraw timer text at a low rate in place; replace texture only when second changes
        var sec = Math.ceil(c.order.time);
        if (sec !== c._lastSec) {
          c._lastSec = sec;
          var canvasTexMap = c.bubble.material.map;
          var ctx = canvasTexMap.image.getContext('2d');
          ctx.clearRect(0, 0, 420, 96);
          ctx.fillStyle = 'rgba(15,12,32,.82)'; ctx.fillRect(0, 0, 420, 96);
          ctx.font = 'bold 36px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = '#F5F3FF'; ctx.fillText(c.type.icon + '  ' + c.order.item.icon + '  ' + Math.max(0, sec) + 's', 210, 48);
          canvasTexMap.needsUpdate = true;
        }
      }
    }
  };

  var OrderSystem = {
    active: [], stallHighlight: [], maxActive: 1, spawnTimer: 0, spawnGap: 25,
    reset: function () {
      this.active = []; this.stallHighlight = []; this.spawnTimer = 1.5;
      this.spawnGap = Game.night === 1 ? 25 : Game.night === 2 ? 18 : 12;
      this.maxActive = Game.night === 1 ? 1 : Game.night === 2 ? 2 : 3;
      Customers.list.slice().forEach(function (c) { Customers.remove(c); });
      UI.clearOrders();
    },
    create: function () {
      if (this.active.length >= this.maxActive) return false;
      var eligibleStalls = Stalls.list.filter(function (s) {
        return !OrderSystem.active.some(function (o) { return o.stall.no === s.no; });
      });
      if (!eligibleStalls.length) return false;
      var stall = eligibleStalls[Math.floor(rng() * eligibleStalls.length)];
      var candidates = LANDMARKS.filter(function (lm) {
        return !OrderSystem.active.some(function (o) { return o.target && o.target.id === lm.id; }) &&
          distXZ(stall.x, stall.z, lm.x, lm.z) >= CONFIG.order.minDist && lm.id !== 1 && lm.id !== 2;
      });
      if (!candidates.length) candidates = LANDMARKS.filter(function (lm) { return lm.id !== 1 && lm.id !== 2; });
      var target = candidates[Math.floor(rng() * candidates.length)];
      var type = Customers.types[Math.floor(rng() * Customers.types.length)];
      var distance = distXZ(stall.x, stall.z, target.x, target.z);
      var limit = clamp((distance / CONFIG.player.walk) * 1.6 + 15, 35, 90) * type.patience;
      var order = {
        id: 'O' + Math.floor(Math.random() * 1e9), item: stall.item, stall: stall,
        target: target, time: limit, limit: limit, picked: false, born: Game.t,
        type: type, state: 'pickup'
      };
      this.active.push(order);
      Customers.create(type, target, order);
      AudioEngine.playSfx('notify');
      UI.toast('📲 Pesanan baru! ' + order.item.name + ' → ' + target.name, 'good');
      Tutorial.onOrder(order);
      return true;
    },
    update: function (dt) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        if (this.active.length < this.maxActive) this.create();
        this.spawnTimer = this.spawnGap;
      }
      this.stallHighlight = [];
      for (var i = this.active.length - 1; i >= 0; i--) {
        var o = this.active[i];
        o.time -= dt;
        if (!o.picked) this.stallHighlight.push(o.stall.no);
        if (o.time <= 0) {
          UI.toast('Pesanan hangus. Rating turun 😬', 'bad');
          AudioEngine.playSfx('prank');
          ScoreSystem.adjustRating(CONFIG.rating.expire);
          ScoreSystem.combo = 0;
          Tutorial.onExpire();
          this.remove(o);
        }
      }
      UI.renderOrders();
    },
    remove: function (o) {
      var i = this.active.indexOf(o); if (i >= 0) this.active.splice(i, 1);
      Customers.remove(o.customer);
      Bag.removeOrder(o);
      this.spawnTimer = Math.min(this.spawnTimer, 2.2);
      UI.renderOrders();
    },
    oldest: function () {
      var best = null;
      this.active.forEach(function (o) { if (!best || o.time < best.time) best = o; });
      return best;
    }
  };

  var ScoreSystem = {
    rating: 5, cash: 0, combo: 0, bestCombo: 0, delivered: 0, initialRating: 5,
    reset: function () { this.rating = CONFIG.rating.start; this.cash = 0; this.combo = 0; this.bestCombo = 0; this.delivered = 0; this.initialRating = this.rating; },
    adjustRating: function (v) {
      this.rating = clamp(this.rating + v, 0, 5);
      if (this.rating < CONFIG.rating.fail) Game.finish(false);
    },
    deliver: function (o, rewardScale) {
      var remaining = clamp(o.time / o.limit, 0, 1);
      var base = CONFIG.score.perItem;
      var tip = Math.round(CONFIG.score.tipMax * remaining);
      var mult = 1 + CONFIG.score.comboStep * Math.min(this.combo, CONFIG.score.comboMax);
      var reward = Math.round((base + tip) * mult * (rewardScale || 1));
      this.cash += reward;
      this.delivered++;
      if (!rewardScale || rewardScale === 1) {
        this.combo++;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        this.adjustRating(remaining > 0.5 ? CONFIG.rating.fast : CONFIG.rating.onTime);
      } else {
        this.combo++;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        this.adjustRating(CONFIG.rating.wrongSmall);
      }
      UI.toast((rewardScale ? 'Treat kecil! ' : 'Bintang 5! ⭐ ') + '+' + fmtRp(reward * 100), 'good');
      AudioEngine.playSfx('success');
      Tutorial.onDelivered();
      if (o.customer) Customers.remove(o.customer);
      OrderSystem.remove(o);
      AchievementSystem.check();
    }
  };

  var Bag = {
    slots: [], capacity: 3,
    reset: function () { this.slots = []; UI.renderBag(); },
    has: function (itemId) { return this.slots.some(function (s) { return s.item.id === itemId; }); },
    hasOrder: function (orderId) { return this.slots.some(function (s) { return s.orderId === orderId; }); },
    add: function (order) {
      if (this.slots.length >= this.capacity) { UI.toast('Tas penuh. Antar dulu satu pesanan.', 'bad'); return false; }
      this.slots.push({ item: order.item, orderId: order.id });
      order.picked = true; order.state = 'delivery';
      Player.bagLight.intensity = 1.35;
      UI.renderBag(); AudioEngine.playSfx('pick');
      UI.toast(order.item.icon + ' ' + order.item.name + ' masuk tas.', 'good');
      Tutorial.onPickup();
      return true;
    },
    removeOrder: function (order) {
      this.slots = this.slots.filter(function (s) { return s.orderId !== order.id; });
      if (Player.bagLight) Player.bagLight.intensity = this.slots.length ? 1.35 : 0.5;
      UI.renderBag();
    },
    takeAny: function () {
      if (!this.slots.length) return null;
      return this.slots.shift();
    }
  };

  var FireflySystem = {
    count: 0, positions: [], collected: [], mesh: null, matrix: new THREE.Matrix4(),
    build: function () {
      var n = CONFIG.fireflyCollect.total;
      var geo = new THREE.IcosahedronGeometry(0.18, 1);
      var mat = new THREE.MeshBasicMaterial({ color: CONFIG.colors.mint });
      this.mesh = new THREE.InstancedMesh(geo, mat, n);
      this.positions = []; this.collected = [];
      for (var i = 0; i < n; i++) {
        var x, z;
        if (i < 15) { x = 45 + (rng() - 0.5) * 14; z = -10 + (rng() - 0.5) * 14; }
        else if (i < 25) { x = -35 + (rng() - 0.5) * 12; z = -30 + (rng() - 0.5) * 14; }
        else { var a = rng() * Math.PI * 2, r = 14 + rng() * 43; x = Math.sin(a) * r; z = Math.cos(a) * r; }
        this.positions.push({ x: x, y: 0.8 + rng() * 1.4, z: z, phase: rng() * 6.28 });
        this.collected.push(false);
        this.setMatrix(i, x, 0.9, z, 1);
      }
      this.mesh.instanceMatrix.needsUpdate = true;
      scene.add(this.mesh);
    },
    setMatrix: function (i, x, y, z, scale) {
      this.matrix.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale));
      this.mesh.setMatrixAt(i, this.matrix);
    },
    reset: function () {
      this.count = 0;
      for (var i = 0; i < this.positions.length; i++) {
        this.collected[i] = false;
        var p = this.positions[i]; this.setMatrix(i, p.x, p.y, p.z, 1);
      }
      if (this.mesh) this.mesh.instanceMatrix.needsUpdate = true;
    },
    update: function (dt, t) {
      var p = Player.pos, r2 = CONFIG.fireflyCollect.radius * CONFIG.fireflyCollect.radius;
      for (var i = 0; i < this.positions.length; i++) {
        if (this.collected[i]) continue;
        var f = this.positions[i];
        if (distSqXZ(p.x, p.z, f.x, f.z) <= r2) {
          this.collected[i] = true; this.count++;
          this.setMatrix(i, 0, -100, 0, 0);
          this.mesh.instanceMatrix.needsUpdate = true;
          ScoreSystem.cash += CONFIG.score.fireflyScore;
          var oldest = OrderSystem.oldest(); if (oldest) oldest.time += CONFIG.score.fireflyBonus;
          AudioEngine.playSfx('firefly');
          UI.toast('✨ Kunang-kunang! +' + CONFIG.score.fireflyScore * 100 + ' skor, +2 dtk pesanan', 'good', 1500);
          AchievementSystem.check();
        } else if (distSqXZ(p.x, p.z, f.x, f.z) < 9) {
          // gerak berkilau, posisi instanced hanya diperbarui dekat pemain
          this.setMatrix(i, f.x + Math.sin(t * 2 + f.phase) * 0.22, f.y + Math.sin(t * 3 + f.phase) * 0.2, f.z, 1);
          this.mesh.instanceMatrix.needsUpdate = true;
        }
      }
    }
  };

  var Tutorial = {
    active: false, step: 0, done: false,
    start: function () {
      this.done = Save.read('gd_tutorial_done', false);
      this.active = !this.done; this.step = 0;
      if (this.active) this.showStep();
    },
    showStep: function () {
      var lines = [
        'Gerakkan kurir dengan WASD / joystick. Geser mouse atau layar kanan untuk kamera. Kunang menunjuk pesanan.',
        'Dekati lapak yang bercahaya, tekan <kbd>E</kbd> untuk mengambil pesanan. Tas muat 3 item.',
        'Ikuti penanda ke pelanggan, tekan <kbd>E</kbd> untuk antar. <kbd>Q</kbd> = Kasih Asal, berisiko!'
      ];
      if (this.active && this.step < lines.length) UI.toast('🐝 ' + lines[this.step], null, 5200);
    },
    onOrder: function () { if (this.active && this.step === 0) { this.step = 1; this.showStep(); } },
    onPickup: function () { if (this.active && this.step <= 1) { this.step = 2; this.showStep(); } },
    onDelivered: function () {
      if (!this.active) return;
      this.active = false; this.done = true; Save.write('gd_tutorial_done', true);
      UI.toast('Tutorial selesai! Pasar ini milikmu, kurir. ✨', 'good', 4000);
    },
    onExpire: function () {},
    skip: function () { this.active = false; this.done = true; Save.write('gd_tutorial_done', true); }
  };

  var AchievementSystem = {
    unlocked: Save.read('gd_ach', {}),
    check: function () {
      var checks = [
        ['firefly40', 'Pemburu Kunang', FireflySystem.count >= 40],
        ['fiveStar', 'Bintang Lima Beneran', Game.state === 'END' && ScoreSystem.rating === 5],
        ['noPrank', 'Subuh Tanpa Lecet', Game.state === 'END' && ScoreSystem.rating === ScoreSystem.initialRating]
      ];
      checks.forEach(function (a) {
        if (a[2] && !AchievementSystem.unlocked[a[0]]) {
          AchievementSystem.unlocked[a[0]] = true;
          Save.write('gd_ach', AchievementSystem.unlocked);
          UI.toast('🏆 Pencapaian: ' + a[1], 'good', 3500);
        }
      });
    }
  };

  var Prank = {
    reversed: false, immunity: 0, active: '', time: 0,
    reset: function () { this.reversed = false; this.immunity = 0; this.active = ''; this.time = 0; },
    trigger: function () {
      if (this.immunity > 0 || this.active) return;
      this.immunity = 15;
      var kind = Math.floor(rng() * 4);
      if (kind === 0) { this.active = 'reverse'; this.time = 3; this.reversed = true; UI.toast('Waduh 🙃 kontrol kebalik!', 'bad'); }
      else if (kind === 1 && Bag.slots.length) {
        var lost = Bag.takeAny();
        if (lost) { var o = OrderSystem.active.find(function (x) { return x.id === lost.orderId; }); if (o) o.picked = false; }
        this.active = 'bag'; this.time = 0.8; UI.toast('Tas bocor! Item jatuh 😭', 'bad'); UI.renderBag();
      } else if (kind === 2) { this.active = 'tilt'; this.time = 3; Cam.tilt = 0.08; UI.toast('Layar miring! Pegangan, kurir.', 'bad'); }
      else { this.active = 'sticky'; this.time = 4; UI.toast('Lengket! Jalan jadi pelan.', 'bad'); }
    },
    update: function (dt) {
      if (this.time > 0) { this.time -= dt; if (this.time <= 0) { this.active = ''; this.reversed = false; Cam.tilt = 0; } }
    }
  };

  /* ============================ 13. UI ============================ */
  var UI = {
    el: {},
    init: function () {
      var ids = ['rating', 'cash', 'combo', 'dawn-fill', 'dawn-knob', 'clock', 'orders', 'bag',
        'prompt', 'toasts', 'markers', 'edge-arrows', 'hud', 'touch', 'cd-dash-fg', 'cd-lantern-fg',
        'screen-title', 'screen-how', 'screen-settings', 'screen-pause', 'screen-end', 'screen-end',
        'end-title', 'end-sub', 'end-grade', 'end-stats', 'char-name', 'night-buttons', 'night-select',
        'best-scores', 'fatal', 'fatal-msg', 'btn-mute', 'tb-action', 'tb-wrong', 'tb-dash', 'tb-lantern'];
      var self = this;
      ids.forEach(function (id) { self.el[id] = document.getElementById(id); });
      // Fase 2 mengaktifkan panel gameplay.
      ['orders', 'bag'].forEach(function (k) { if (self.el[k]) self.el[k].style.display = ''; });
      var cd = document.querySelector('.cooldowns'); if (cd) cd.style.display = '';
      ['tb-action', 'tb-wrong', 'tb-dash', 'tb-lantern'].forEach(function (k) {
        if (self.el[k]) self.el[k].style.display = '';
      });
    },
    show: function (name) {
      var map = { title: 'screen-title', how: 'screen-how', settings: 'screen-settings', pause: 'screen-pause', end: 'screen-end' };
      Object.keys(map).forEach(function (k) {
        var el = document.getElementById(map[k]);
        if (el) el.classList.toggle('hidden', k !== name);
      });
    },
    hideAll: function () {
      ['screen-title', 'screen-how', 'screen-settings', 'screen-pause', 'screen-end'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.classList.add('hidden');
      });
    },
    toast: function (msg, kind, ms) {
      var d = document.createElement('div');
      d.className = 'toast' + (kind ? ' ' + kind : '');
      d.textContent = msg;
      this.el.toasts.appendChild(d);
      setTimeout(function () {
        d.style.transition = 'opacity .25s ease';
        d.style.opacity = '0';
        setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 260);
      }, ms || CONFIG.ui.toastMs);
    },
    clearOrders: function () { if (this.el.orders) this.el.orders.innerHTML = ''; },
    prompt: function (text) {
      var el = this.el.prompt;
      if (!text) { el.classList.add('hidden'); return; }
      el.classList.remove('hidden'); el.innerHTML = text;
    },
    renderOrders: function () {
      if (!this.el.orders) return;
      this.el.orders.innerHTML = '';
      OrderSystem.active.forEach(function (o) {
        var card = document.createElement('div'); card.className = 'order-card';
        var pct = clamp(o.time / o.limit, 0, 1), color = pct > 0.5 ? '#7CFFB2' : pct > 0.22 ? '#FFC24D' : '#FF3DA5';
        var stage = o.picked ? 'Antar ke ' + o.type.name : 'Ambil di Lapak ' + o.stall.no;
        card.innerHTML = '<div class="order-head"><span class="order-icon">' + o.item.icon + '</span><span class="order-item">' + o.item.name + '</span></div>' +
          '<div class="order-target">' + stage + ' → <b>' + o.target.name + '</b></div>' +
          '<div class="order-time"><span style="width:' + (pct * 100) + '%;background:' + color + '"></span></div>' +
          '<span class="order-tag">' + Math.max(0, Math.ceil(o.time)) + 's</span>';
        this.el.orders.appendChild(card);
      }, this);
    },
    renderBag: function () {
      if (!this.el.bag) return;
      this.el.bag.innerHTML = '';
      for (var i = 0; i < Bag.capacity; i++) {
        var slot = document.createElement('div');
        var item = Bag.slots[i];
        slot.className = 'slot' + (item ? ' filled' : '');
        slot.textContent = item ? item.item.icon : '·';
        slot.title = item ? item.item.name : 'Kosong';
        this.el.bag.appendChild(slot);
      }
    },
    renderMarkers: function () {
      var host = this.el.markers, arrows = this.el['edge-arrows'];
      if (!host || Game.state !== 'PLAY') { host.innerHTML = ''; arrows.innerHTML = ''; return; }
      host.innerHTML = ''; arrows.innerHTML = '';
      var targets = [];
      OrderSystem.active.forEach(function (o) {
        var p = o.picked ? o.target : { x: o.stall.interactX, z: o.stall.interactZ, name: 'Lapak ' + o.stall.no };
        targets.push({ x: p.x, z: p.z, name: p.name, icon: o.picked ? '👻' : o.item.icon, wrong: false });
      });
      if (!targets.length) {
        var nearest = Stalls.list[0];
        if (nearest) targets.push({ x: nearest.interactX, z: nearest.interactZ, name: 'Jelajahi pasar', icon: '🐝', wrong: false });
      }
      targets.slice(0, 2).forEach(function (t) {
        var v = new THREE.Vector3(t.x, 2.2, t.z).project(camera);
        var sx = (v.x * 0.5 + 0.5) * window.innerWidth;
        var sy = (-v.y * 0.5 + 0.5) * window.innerHeight;
        var onScreen = v.z > -1 && v.z < 1 && sx > 30 && sx < window.innerWidth - 30 && sy > 70 && sy < window.innerHeight - 50;
        if (onScreen) {
          var d = document.createElement('div'); d.className = 'marker';
          d.style.left = sx + 'px'; d.style.top = sy + 'px';
          d.innerHTML = '<span class="pin">' + t.icon + '</span><span>' + t.name + '</span><span class="dist">' + Math.round(distXZ(Player.pos.x, Player.pos.z, t.x, t.z)) + ' m</span>';
          host.appendChild(d);
        } else {
          var cx = window.innerWidth / 2, cy = window.innerHeight / 2;
          var dx = sx - cx, dy = sy - cy;
          if (v.z < 0) { dx = -dx; dy = -dy; }
          var len = Math.hypot(dx, dy) || 1;
          var rad = Math.min(window.innerWidth, window.innerHeight) * 0.39;
          var a = document.createElement('div'); a.className = 'arrow';
          a.style.left = clamp(cx + dx / len * rad, 24, window.innerWidth - 24) + 'px';
          a.style.top = clamp(cy + dy / len * rad, 64, window.innerHeight - 64) + 'px';
          a.style.transform = 'translate(-50%,-50%) rotate(' + (Math.atan2(dy, dx) * 180 / Math.PI + 90) + 'deg)';
          a.title = t.name; arrows.appendChild(a);
        }
      });
    },
    setHudVisible: function (v) { this.el.hud.classList.toggle('hidden', !v); },
    update: function (dt, p) {
      this.el.rating.textContent = ScoreSystem.rating.toFixed(2);
      this.el.cash.textContent = fmtRp(ScoreSystem.cash * 100);
      var comboEl = this.el.combo;
      if (ScoreSystem.combo >= 2) {
        comboEl.classList.remove('hidden');
        comboEl.textContent = 'x' + (1 + CONFIG.score.comboStep * Math.min(ScoreSystem.combo, CONFIG.score.comboMax)).toFixed(1);
      } else comboEl.classList.add('hidden');
      var pct = clamp(p, 0, 1) * 100;
      this.el['dawn-fill'].style.width = pct + '%';
      this.el['dawn-knob'].style.left = pct + '%';
      this.el['dawn-knob'].textContent = p <= 0.82 ? '🌙' : '☀️';
      var hours = 23 + p * 6;
      var hh = Math.floor(hours) % 24, mm = Math.floor((hours % 1) * 60);
      this.el.clock.textContent = pad2(hh) + ':' + pad2(mm);
      this.renderOrders(); this.renderBag(); this.renderMarkers(); this.updatePrompt();
    },
    updatePrompt: function () {
      if (Game.state !== 'PLAY') { this.prompt(''); return; }
      var stall = Stalls.nearest(Player.pos.x, Player.pos.z, CONFIG.interact.stall + 0.7);
      var customer = null, cd = CONFIG.interact.customer * CONFIG.interact.customer;
      Customers.list.forEach(function (c) {
        var d = distSqXZ(Player.pos.x, Player.pos.z, c.landmark.x, c.landmark.z);
        if (d < cd) { cd = d; customer = c; }
      });
      if (customer && Bag.hasOrder(customer.order.id)) this.prompt('<kbd>E</kbd> Antar ' + customer.type.name);
      else if (stall && OrderSystem.active.some(function (o) { return o.stall.no === stall.no && !o.picked; })) this.prompt('<kbd>E</kbd> Ambil ' + stall.item.name);
      else this.prompt('');
    },
    contextualAction: function () {
      var stall = Stalls.nearest(Player.pos.x, Player.pos.z, CONFIG.interact.stall + 0.7);
      if (stall) {
        var order = OrderSystem.active.find(function (o) { return o.stall.no === stall.no && !o.picked; });
        if (order) { Bag.add(order); return; }
      }
      var customer = null, best = CONFIG.interact.customer * CONFIG.interact.customer;
      Customers.list.forEach(function (c) {
        var d = distSqXZ(Player.pos.x, Player.pos.z, c.landmark.x, c.landmark.z);
        if (d < best) { best = d; customer = c; }
      });
      if (customer && Bag.hasOrder(customer.order.id)) { ScoreSystem.deliver(customer.order, 1); return; }
      if (stall) UI.toast('Lapak ini bukan buat pesananmu.', 'bad', 1300);
      else if (customer) UI.toast('Itemnya belum ada di tas.', 'bad', 1300);
    },
    wrongGive: function () {
      var customer = null, best = CONFIG.interact.customer * CONFIG.interact.customer;
      Customers.list.forEach(function (c) {
        var d = distSqXZ(Player.pos.x, Player.pos.z, c.landmark.x, c.landmark.z);
        if (d < best) { best = d; customer = c; }
      });
      if (!customer) { UI.toast('Dekati pelanggan dulu.', null, 1200); return; }
      var item = Bag.takeAny();
      if (!item) { UI.toast('Tas kosong. Ambil pesanan dulu.', 'bad'); return; }
      var carriedOrder = OrderSystem.active.find(function (o) { return o.id === item.orderId; });
      if (carriedOrder) carriedOrder.picked = false;
      Player.bagLight.intensity = Bag.slots.length ? 1.35 : 0.5;
      if (rng() < CONFIG.wrongGive.successChance) ScoreSystem.deliver(customer.order, CONFIG.wrongGive.rewardScale);
      else {
        UI.toast('TRICK! Pesanan salah 😭', 'bad');
        AudioEngine.playSfx('prank'); ScoreSystem.combo = 0;
        ScoreSystem.adjustRating(CONFIG.rating.trick);
        Prank.trigger();
      }
      this.renderBag();
    },
    saveScoreCard: function () {
      var c = document.createElement('canvas'); c.width = 900; c.height = 520;
      var g = c.getContext('2d');
      var grad = g.createLinearGradient(0, 0, 900, 520); grad.addColorStop(0, '#10152f'); grad.addColorStop(1, '#421c50');
      g.fillStyle = grad; g.fillRect(0, 0, c.width, c.height);
      g.strokeStyle = '#7CFFB2'; g.lineWidth = 4; g.strokeRect(20, 20, 860, 480);
      g.fillStyle = '#F5F3FF'; g.textAlign = 'center'; g.font = '900 54px system-ui'; g.fillText('GHOSTDASH', 450, 100);
      g.font = '700 26px system-ui'; g.fillStyle = '#7CFFB2'; g.fillText('Pasar Malam Arwah · Malam ' + Game.night, 450, 148);
      g.fillStyle = '#FFC24D'; g.font = '900 62px system-ui'; g.fillText(fmtRp(ScoreSystem.cash * 100), 450, 250);
      g.fillStyle = '#F5F3FF'; g.font = '600 26px system-ui';
      g.fillText('⭐ ' + ScoreSystem.rating.toFixed(2) + '     Pesanan: ' + ScoreSystem.delivered + '     Combo: x' + ScoreSystem.bestCombo, 450, 320);
      g.fillText('Kunang-kunang: ' + FireflySystem.count + '     Grade: ' + (document.getElementById('end-grade').textContent || '—'), 450, 375);
      g.font = 'italic 20px system-ui'; g.fillStyle = 'rgba(245,243,255,.72)'; g.fillText('“Antar pesanan arwah sebelum subuh.”', 450, 445);
      var a = document.createElement('a'); a.download = 'ghostdash-skor.png'; a.href = c.toDataURL('image/png'); a.click();
    }
  };

  /* ============================ 14. Game / State machine ============================ */
  var Game = {
    state: 'BOOT', t: 0, progress: 0, night: 1, nightDur: CONFIG.night.durM1, fps: 0, endlessTime: 0,
    reset: function (night) {
      this.night = night || 1;
      this.nightDur = night === 2 ? CONFIG.night.durM2 : (night === 3 || night === 'endless') ? CONFIG.night.durM3 : CONFIG.night.durM1;
      this.progress = 0;
      this.t = 0;
      this.endlessTime = 0;
      ScoreSystem.reset();
      OrderSystem.reset();
      Prank.reset();
      FireflySystem.reset();
      Bag.reset();
      Player.pos.set(CONFIG.spawn.x, 0, CONFIG.spawn.z);
      Player.vel.set(0, 0, 0);
      if (Player.group) Player.group.position.set(CONFIG.spawn.x, 0, CONFIG.spawn.z);
      Cam.yaw = 0; Cam.pitch = 0.22; Cam.dist = CONFIG.camera.dist;
      Tutorial.start();
    },
    setState: function (s) {
      var prev = this.state;
      this.state = s;
      if (s === 'TITLE') { UI.show('title'); UI.setHudVisible(false); Cam.autoOrbit = true; }
      if (s === 'PLAY') { UI.hideAll(); UI.setHudVisible(true); Cam.autoOrbit = false; }
      if (s === 'PAUSE') { UI.show('pause'); }
      if (s === 'END') { UI.show('end'); UI.setHudVisible(false); }
      if (prev === 'PAUSE' && s === 'PLAY') UI.hideAll();
    },
    finish: function (won) {
      if (this.state === 'END') return;
      this.state = 'END';
      var grade = this.night === 'endless' ? '∞' : ScoreSystem.cash >= (CONFIG.score.gradeS[this.night] || Infinity) / 100 ? 'S' : ScoreSystem.cash >= (CONFIG.score.gradeS[this.night] || Infinity) / 200 ? 'A' : ScoreSystem.cash > 0 ? 'B' : 'C';
      document.getElementById('end-title').textContent = won ? 'SUBUH! Shift selesai ☀️' : 'Akun Disuspend 💀';
      document.getElementById('end-sub').textContent = won ? 'Ayam berkokok. Pasar mulai menghilang...' : 'Ratingmu jatuh di bawah 2.0. Mungkin arwahnya salah download aplikasi.';
      document.getElementById('end-grade').textContent = grade;
      document.getElementById('end-stats').innerHTML =
        '<div>Penghasilan<b>' + fmtRp(ScoreSystem.cash * 100) + '</b></div>' +
        '<div>Pesanan sukses<b>' + ScoreSystem.delivered + '</b></div>' +
        '<div>Combo terbaik<b>x' + ScoreSystem.bestCombo + '</b></div>' +
        '<div>Kunang terkumpul<b>' + FireflySystem.count + '</b></div>' +
        '<div>Rating akhir<b>⭐ ' + ScoreSystem.rating.toFixed(2) + '</b></div>' +
        '<div>Grade<b>' + grade + '</b></div>';
      var best = Save.read('gd_best', {});
      if (ScoreSystem.cash > (best[this.night] || 0)) { best[this.night] = ScoreSystem.cash; Save.write('gd_best', best); }
      if (won && typeof this.night === 'number') Save.write('gd_unlocked', Math.max(Save.read('gd_unlocked', 1), Math.min(3, this.night + 1)));
      AchievementSystem.check();
      UI.show('end'); UI.setHudVisible(false); Cam.autoOrbit = true;
    }
  };

  /* ============================ 15. Loop ============================ */
  var last = 0, fpsAcc = 0, fpsCount = 0, fpsTimer = 0, debugEl = null;

  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min((now - last) / 1000, 0.05);
    if (!last) dt = 0;
    last = now;

    if (Game.state !== 'PAUSE') Game.t += dt;

    Input.update();

    if (Game.state === 'TITLE') {
      Cam.update(dt, 'title');
      World.update(dt, Game.t);
      Scene2.updateAmbient(dt, Game.t, Game.progress);
    } else if (Game.state === 'PLAY' || Game.state === 'END') {
      if (Game.state === 'PLAY') {
        Player.update(dt);
        Player.stepSound(dt);
        if (Game.night === 'endless') Game.endlessTime += dt;
        else Game.progress = Math.min(1, Game.progress + dt / Game.nightDur);
        OrderSystem.update(dt);
        Customers.update(dt, Game.t);
        FireflySystem.update(dt, Game.t);
        handleHotkeys();
        if (Game.night !== 'endless' && Game.progress >= 1) Game.finish(true);
      }
      Prank.immunity = Math.max(0, Prank.immunity - dt);
      Prank.update(dt);
      Companion.update(dt);
      Stalls.update(dt, Game.t);
      World.update(dt, Game.t);
      Scene2.updateAmbient(dt, Game.t, Game.progress);
      Cam.update(dt, Game.state === 'END' ? 'end' : 'play');
    }

    UI.update(dt, Game.progress);
    updateDebug(dt);

    renderer.render(scene, camera);
  }

  function handleHotkeys() {
    if (Input.consume('actionPressed')) UI.contextualAction();
    if (Input.consume('wrongPressed')) UI.wrongGive();
    if (Input.consume('dashPressed')) Player.dash();
    if (Input.consume('lanternPressed')) UI.toast('Lentera kilat lengkap di Fase 3.', null, 1200);
  }

  function updateDebug(dt) {
    if (!CONFIG.debug) return;
    if (!debugEl) {
      debugEl = document.createElement('div');
      debugEl.style.cssText = 'position:fixed;left:8px;bottom:8px;font:12px monospace;color:#7CFFB2;background:rgba(0,0,0,.6);padding:6px 8px;border-radius:8px;z-index:50;white-space:pre';
      document.body.appendChild(debugEl);
    }
    fpsAcc += dt; fpsCount++; fpsTimer += dt;
    if (fpsTimer > 0.5) {
      Game.fps = Math.round(fpsCount / fpsAcc);
      fpsAcc = 0; fpsCount = 0; fpsTimer = 0;
      var info = renderer.info.render;
      debugEl.textContent = 'FPS ' + Game.fps +
        '\ncalls ' + info.calls + '  tris ' + info.triangles +
        '\npos ' + Player.pos.x.toFixed(1) + ',' + Player.pos.z.toFixed(1) +
        '\np ' + Game.progress.toFixed(3) +
        '\nerrs ' + window.__errs.length;
    }
  }

  /* ============================ 16. Scene2 (ambient update) ============================ */
  var Scene2 = {
    updateAmbient: function (dt, t, p) {
      updateSky(p, t);
      // 4 point light dipindah ke lampion terdekat pemain
      if (!Player.group) return;
      var px = Player.pos.x, pz = Player.pos.z;
      // sort cepat: cukup ambil 4 terdekat tanpa sort penuh setiap frame (selection parsial)
      var best4 = [];
      for (var k = 0; k < lanternPositions.length; k++) {
        var d2 = distSqXZ(lanternPositions[k].x, lanternPositions[k].z, px, pz);
        if (best4.length < 4) { best4.push([d2, k]); best4.sort(function (a, b) { return a[0] - b[0]; }); }
        else if (d2 < best4[3][0]) { best4[3] = [d2, k]; best4.sort(function (a, b) { return a[0] - b[0]; }); }
      }
      for (var i = 0; i < lanternLights.length; i++) {
        var L = lanternLights[i];
        if (i >= best4.length) { L.visible = false; continue; }
        var src = lanternPositions[best4[i][1]];
        L.visible = true;
        L.position.set(src.x, src.y, src.z);
        L.intensity = lerp(1.0, 0.4, clamp((p - 0.7) / 0.3, 0, 1)) * (1 + Math.sin(t * 2 + i) * 0.06);
      }
      // bayangan mengikuti pemain
      moonLight.position.set(px - 30, 60, pz - 20);
      moonLight.target.position.set(px, 0, pz);
      moonLight.target.updateMatrixWorld();

      // lampu taman berkedip
      if (World.flicker && World.flicker.userData.flicker) {
        var l = World.flicker.userData.flicker;
        l.intensity = 0.55 + Math.abs(Math.sin(t * 9.3)) * 0.35 * (rng() > 0.06 ? 1 : 0.2);
      }
    }
  };

  /* ============================ 17. Boot ============================ */
  function fatal(msg) {
    var f = document.getElementById('fatal');
    if (f) {
      document.getElementById('fatal-msg').textContent = msg || 'Terjadi kesalahan.';
      f.classList.remove('hidden');
    }
  }
  window.__fatal = fatal;
  // Hook uji otomatis (hanya saat ?debug=1): baca state tanpa menyentuh frame loop.
  if (CONFIG.debug) window.__probe = function () {
    return {
      state: Game.state, pos: { x: Player.pos.x, z: Player.pos.z },
      facing: Player.facing, camYaw: Cam.yaw, follow: Cam._follow,
      moving: Player.moving, move: { x: Input.move.x, y: Input.move.y },
      errs: window.__errs.length
    };
  };

  function bindMenu() {
    var onClick = function (id, fn) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', function () { AudioEngine.init(); AudioEngine.resume(); AudioEngine.playSfx('ui'); fn(); });
    };
    var charName = document.getElementById('char-name');
    var charOrder = ['raka', 'nala'];
    onClick('btn-main', function () {
      document.getElementById('night-select').classList.toggle('hidden');
      renderNights();
    });
    onClick('btn-close-night', function () { document.getElementById('night-select').classList.add('hidden'); });
    onClick('btn-char', function () {
      var i = (charOrder.indexOf(Player.kind) + 1) % charOrder.length;
      Player.build(charOrder[i]);
      charName.textContent = charOrder[i] === 'raka' ? 'Raka' : 'Nala';
      Save.write('gd_char', charOrder[i]);
    });
    onClick('btn-how', function () { UI.show('how'); });
    onClick('btn-settings', function () {
      UI.show('settings');
      document.getElementById('set-volume').value = Math.round(Settings.volume * 100);
      document.getElementById('set-sens').value = Math.round(Settings.sens * 100);
      document.getElementById('set-reduced').checked = Settings.reducedMotion;
      document.getElementById('set-quality').value = Settings.quality;
    });
    document.querySelectorAll('.close-panel').forEach(function (b) {
      b.addEventListener('click', function () { UI.show('title'); });
    });
    onClick('btn-pause', function () { Game.setState('PAUSE'); });
    onClick('btn-mute', function () {
      var m = AudioEngine.toggleMute();
      document.getElementById('btn-mute').textContent = m ? '🔇' : '🔊';
    });
    onClick('btn-resume', function () { Game.setState('PLAY'); });
    onClick('btn-restart', function () { Game.reset(Game.night); Game.setState('PLAY'); });
    onClick('btn-quit', function () { Game.setState('TITLE'); });
    onClick('btn-again', function () { Game.reset(Game.night); Game.setState('PLAY'); });
    onClick('btn-night', function () {
      Game.setState('TITLE');
      document.getElementById('night-select').classList.remove('hidden');
      renderNights();
    });
    onClick('btn-card', function () { UI.saveScoreCard(); });

    document.getElementById('set-volume').addEventListener('input', function (e) {
      Settings.volume = e.target.value / 100; Settings.apply();
    });
    document.getElementById('set-sens').addEventListener('input', function (e) {
      Settings.sens = e.target.value / 100; Settings.apply();
    });
    document.getElementById('set-reduced').addEventListener('change', function (e) {
      Settings.reducedMotion = e.target.checked; Settings.apply();
    });
    document.getElementById('set-quality').addEventListener('change', function (e) {
      Settings.quality = e.target.value; Save.write('gd_quality', Settings.quality);
      UI.toast('Kualitas grafis: ' + e.target.value + ' (muat ulang untuk menerapkan penuh)', null, 2600);
    });

    window.addEventListener('keydown', function (e) {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (Game.state === 'PLAY') Game.setState('PAUSE');
        else if (Game.state === 'PAUSE') Game.setState('PLAY');
      }
      if (e.code === 'KeyM') {
        var m = AudioEngine.toggleMute();
        document.getElementById('btn-mute').textContent = m ? '🔇' : '🔊';
      }
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && Game.state === 'PLAY') Game.setState('PAUSE');
    });
    window.addEventListener('blur', function () { if (Game.state === 'PLAY') Game.setState('PAUSE'); });
  }

  function renderNights() {
    var host = document.getElementById('night-buttons');
    var unlocked = Save.read('gd_unlocked', 1);
    var best = Save.read('gd_best', {});
    var defs = [
      { key: 1, name: 'Malam 1', sub: 'Santai' },
      { key: 2, name: 'Malam 2', sub: 'Ramai' },
      { key: 3, name: 'Malam 3', sub: 'Hujan & gila' },
      { key: 'endless', name: 'Endless', sub: 'Sampai disuspend' }
    ];
    host.innerHTML = '';
    defs.forEach(function (d) {
      var locked = (typeof d.key === 'number' && d.key > unlocked) || (d.key === 'endless' && unlocked < 3);
      var b = document.createElement('button');
      b.className = 'night-btn';
      if (locked) b.disabled = true;
      b.innerHTML = '<b>' + (locked ? '🔒 ' : '') + d.name + '</b><small>' + d.sub +
        (best[d.key] ? ' · terbaik ' + fmtRp(best[d.key]) : '') + '</small>';
      b.addEventListener('click', function () {
        AudioEngine.init(); AudioEngine.resume();
        Game.reset(d.key);
        Game.setState('PLAY');
        UI.toast('Malam dimulai. Selamat antar, kurir! 🛵', 'good');
      });
      host.appendChild(b);
    });
    // skor terbaik
    var lines = [];
    Object.keys(best).forEach(function (k) { lines.push(k + ': ' + fmtRp(best[k])); });
    document.getElementById('best-scores').textContent = lines.length ? 'Skor terbaik — ' + lines.join(' · ') : '';
  }

  function boot() {
    if (typeof THREE === 'undefined') {
      fatal('Three.js gagal dimuat dari CDN. Cek koneksi internet lalu muat ulang.');
      return;
    }
    try {
      initRenderer();
    } catch (e) {
      fatal('WebGL tidak tersedia di browser ini: ' + e.message);
      return;
    }
    UI.init();
    initSky();
    World.build();
    FireflySystem.build();
    Player.build(Save.read('gd_char', 'raka'));
    Companion.build();
    Input.init(canvas, document.getElementById('lookzone'));
    Settings.apply();
    document.getElementById('char-name').textContent = Player.kind === 'raka' ? 'Raka' : 'Nala';
    bindMenu();
    Game.reset(1);
    Game.setState('TITLE');
    renderNights();
    requestAnimationFrame(frame);
    setTimeout(function () {
      if (window.__errs.length && CONFIG.debug) UI.toast('Ada error di console. Cek ?debug=1', 'bad', 4000);
    }, 1500);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(boot, 0);
  else window.addEventListener('DOMContentLoaded', boot);
})();
