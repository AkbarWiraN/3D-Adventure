// onlineSession.js — sesi Online: SoloSession + lapisan WSS authoritative.
// prompt.md Fase 3: klien pegang kamera/animasi/prediksi; server pegang posisi/HP/ammo.
// Strategi: pakai SoloSession apa adanya (dunia/kontrol/HUD sudah terbukti),
// tambah (a) kirim intent input, (b) render pemain remote dari snapshot,
// (c) aksi ambil/serang lewat server, (d) exit kirim leave().
import * as THREE from 'three';
import { SoloSession } from './session.js';
import { createClient } from '../network/ws.js';
import { emit, on } from './bus.js';
import { PLAYER } from '../shared/constants.js';

const INTERP_MS = 120; // buffer interpolasi remote (prompt: 100-150 ms)

export class OnlineSession {
  constructor({ canvas, screens, character = 'male' }) {
    this.solo = new SoloSession({ canvas, screens, character });
    // Online tidak boleh menjalankan combat bot lokal; aksi/loot hanya server-authoritative.
    this.solo.combat?.dispose();
    this.solo.combat = null;
    this.screens = screens;
    this.character = character;

    this.remotes = new Map(); // sessionId -> {mesh, target:{x,y,z,yaw}, prev, at}
    this.net = createClient({
      onMessage: (m) => this._onMessage(m),
      onStatus: (s, ev) => this._onStatus(s, ev),
    });

    this._unsubs = [
      // Intent lokal (klien TIDAK mengirim posisi).
      on('input:attack', () => this.net.action('attack')),
      on('input:interact', () => this.net.action('pickup')),
      on('input:slot', (i) => this.net.action('slot', i)),
      on('input:drop', () => this.net.action('drop')),
      on('input:throw', () => this.net.action('throw')),
    ];
    this._inputClock = setInterval(() => this._pushIntent(), 50); // 20 Hz
    this.net.connect();
  }

  start() {
    // Sisipkan interpolasi remote ke loop render yang SUDAH ada (tanpa menduplikasi loop).
    const soloRender = this.solo._render.bind(this.solo);
    this.solo._render = (dt) => { soloRender(dt); this._renderRemotes(); };
    this.solo.start();
    this.solo.hud.toast('Menghubungkan ke room forest…');
  }

  // --------------------------------------------------------------- input
  _pushIntent() {
    if (!this.net.joined || this.solo.paused || this.solo.disposed) return;
    const snap = this.solo.input.snapshot();
    const yaw = this.solo.cameraRig.yaw + this.solo.cameraRig.userYawOffset;
    this.net.input({
      mx: snap.moveX, mz: snap.moveZ, yaw,
      sprint: snap.sprint, prone: snap.prone, jump: snap.jump,
    });
  }

  // --------------------------------------------------------------- server
  _onMessage(m) {
    if (m.t === 'snapshot') {
      const s = m.self || {};
      if (this.solo.player.dead !== Boolean(s.dead)) {
        // Server yang menentukan mati/hidup; klien hanya mengikuti.
        this.solo.player.dead = Boolean(s.dead);
      }
      this.solo.player.hp = s.hp ?? this.solo.player.hp;
      // Correction ke posisi otoritatif server (snapshot 10Hz); camera tetap lokal.
      if (Number.isFinite(s.x) && Number.isFinite(s.z)) {
        this.solo.player.position.set(s.x, s.y ?? this.solo.player.position.y, s.z);
        this.solo.player.group.position.copy(this.solo.player.position);
      }
      this._syncRemotes(m.players || []);
      this.solo.minimap.update(
        { x: s.x ?? this.solo.player.position.x, z: s.z ?? this.solo.player.position.z, yaw: s.yaw ?? 0 },
        (m.players || []).map((p) => ({ x: p.x, z: p.z, dead: p.d }))
      );
    }
    if (m.t === 'hit') {
      this.solo.hud.toast(m.dead ? 'Musuh dikalahkan!' : 'Kena!');
      if (m.dead) this.solo.hud.addKillFeed(`Kamu mengalahkan musuh`);
    }
    if (m.t === 'kill') {
      const mine = m.victim === this._me();
      this.solo.hud.addKillFeed(
        m.cause === 'combat_logout'
          ? `${m.killer ?? '?'} mengalahkan ${m.victim} (keluar dari pertarungan)`
          : `${m.killer ?? 'Server'} mengalahkan ${m.victim}`
      );
      if (mine) void 0;
    }
    if (m.t === 'error') {
      // Pesan server: tampilkan yang bisa dipahami user, sisanya diam.
      const map = {
        COOLDOWN: 'Serangan belum siap',
        NO_AMMO: 'Anak panah habis',
        NO_LOOT: 'Tidak ada loot di dekatmu',
        FULL: 'Inventori penuh',
        BOW_REQUIRED: 'Ambil busur dahulu',
        SEQ_REPLAY: null,
        INPUT_FLOOD: null,
        ATTACK_FLOOD: null,
      };
      const text = map[m.code];
      if (text) this.solo.hud.toast(text);
    }
    if (m.t === 'leave_ack') this._closed = true;
  }

  _me() {
    // Nama sendiri tidak dikirim server ke klien lain; bandingkan lewat self id.
    return this._selfId;
  }

  _onStatus(s) {
    if (s === 'online') this.solo.hud.toast('Terhubung · room forest');
    if (s === 'disconnected') {
      this.solo.hud.toast('Koneksi terputus — kembali ke lobby');
      setTimeout(() => emit('ui:exitSolo'), 1200);
    }
    if (s === 'auth_expired') {
      this.solo.hud.toast('Sesi kedaluwarsa, login ulang');
      setTimeout(() => emit('ui:exitSolo'), 1500);
    }
  }

  // --------------------------------------------------------------- remotes
  _syncRemotes(list) {
    const seen = new Set();
    for (const p of list) {
      seen.add(p.id);
      let r = this.remotes.get(p.id);
      if (!r) {
        const mesh = this._makeRemote(p.c);
        this.solo.scene.add(mesh);
        r = { mesh, prev: { x: p.x, y: p.y, z: p.z, yaw: p.yaw }, target: { x: p.x, y: p.y, z: p.z, yaw: p.yaw }, at: performance.now() };
        this.remotes.set(p.id, r);
      }
      r.prev = { x: r.target.x, y: r.target.y, z: r.target.z, yaw: r.target.yaw };
      r.target = { x: p.x, y: p.y, z: p.z, yaw: p.yaw };
      r.at = performance.now();
      r.mesh.visible = !p.d;
      if (p.w && p.w !== 'unarmed' && !r.weapon) {
        r.weapon = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, 0.16, 0.16),
          new THREE.MeshStandardMaterial({ color: p.w === 'bow' ? 0x9d642e : 0xc7cbd0 })
        );
        r.mesh.add(r.weapon);
      }
    }
    for (const [id, r] of this.remotes) {
      if (seen.has(id)) continue;
      this.solo.scene.remove(r.mesh);
      r.mesh.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
      this.remotes.delete(id);
    }
  }

  _makeRemote(character) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.38, 1.0, 3, 6),
      new THREE.MeshStandardMaterial({ color: character === 'female' ? 0xb98a6a : 0x785c36 })
    );
    body.position.y = 0.9;
    g.add(body);
    return g;
  }

  /** Interpolasi remote di loop render (dipanggil session wrapper). */
  _renderRemotes() {
    const now = performance.now();
    for (const r of this.remotes.values()) {
      const t = Math.min(1, (now - r.at) / INTERP_MS);
      const p = r.mesh.position;
      p.x = r.prev.x + (r.target.x - r.prev.x) * t;
      p.y = r.prev.y + (r.target.y - r.prev.y) * t;
      p.z = r.prev.z + (r.target.z - r.prev.z) * t;
      r.mesh.rotation.y = r.prev.yaw + (r.target.yaw - r.prev.yaw) * t;
    }
  }

  // --------------------------------------------------------------- lifecycle
  dispose() {
    clearInterval(this._inputClock);
    for (const un of this._unsubs) un();
    this._unsubs = [];
    this.net.leave();
    for (const r of this.remotes.values()) {
      this.solo.scene.remove(r.mesh);
      r.mesh.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
    }
    this.remotes.clear();
    this.solo.dispose();
  }

  metrics() { return this.solo.metrics(); }
  setPaused(on) { this.solo.setPaused(on); }
  teleport(x, z) { this.solo.teleport(x, z); }
  get player() { return this.solo.player; }
  get paused() { return this.solo.paused; }
  get disposed() { return this.solo.disposed; }
  get cameraRig() { return this.solo.cameraRig; }
  get input() { return this.solo.input; }
  get hud() { return this.solo.hud; }
  get minimap() { return this.solo.minimap; }
  get scene() { return this.solo.scene; }
  _resize() { this.solo._resize(); }
  _spawn() { return this.solo._spawn(); }
}
