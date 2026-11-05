import * as THREE from 'three';
import { getWorld } from '../shared/world.js';
import { terrainHeight } from '../shared/terrain.js';
import { on, emit } from '../core/bus.js';
import { WEAPONS, DAMAGE, takeLoot, weaponClass, canAttack } from './combatRules.js';

const PICKUP = 2.5;
// Ken (6 Nov): "1-2 bot tiap 100m" di map 1024×1024 → ~24 bot tersebar acak.
const BOT_COUNT = 24;
const LOOT_SPOTS = 26;              // senjata tersebar acak di seluruh map (bisa di-loot)
const BOT_ATTACK_RANGE = 1.8;
const BOT_HIT_COOLDOWN_MS = 1400;
const BOT_DAMAGE = 20;              // semua hit valid 20 HP (prompt.md §1.1)
const BOT_SPEED = 3.1;              // m/s — sedikit di bawah walk pemain (3.6)
const BOT_AGGRO_RANGE = 14;
const RESPAWN_MS = 12000;

function botWeapon(rng) {
  const r = rng();
  if (r < 0.45) return 'sword';
  if (r < 0.8) return 'bow';
  return null; // tangan kosong
}

export class SoloCombat {
  constructor(session) {
    this.s = session;
    this.items = [];
    this.bots = [];
    this.tracers = [];
    this.inventory = [null, null];
    this.slot = 0;
    this.cooldown = 0;
    this._off = [];
    this.root = new THREE.Group();
    session.scene.add(this.root);

    const world = getWorld();
    // RNG terpisah dari world (loot acak, tapi tetap deterministik per sesi).
    let seed = (Date.now() ^ 0x5f3759df) >>> 0;
    const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

    // Loot POI bawaan + TAMBAHAN senjata tersebar acak (permintaan pemilik:
    // "senjata random lokasinya bisa di looting"). Sebagian ditaruh DEKAT
    // spawn pemain (5–25 m) supaya langsung terlihat saat mulai main.
    const spots = world.loot;
    spots.forEach((p, i) => this.addLoot(p.x, p.z, ['bow', 'sword', 'arrows'][i % 3], p.id));
    const playerSpawn = this.s.player.position;
    for (let i = 0; i < LOOT_SPOTS; i++) {
      let x, z;
      if (i < 10) {
        // 10 loot pertama: cincin dekat pemain (6–24 m) — pasti terlihat di awal.
        const ang = (i / 10) * Math.PI * 2 + rng() * 0.5;
        const rad = 6 + rng() * 18;
        x = playerSpawn.x + Math.cos(ang) * rad;
        z = playerSpawn.z + Math.sin(ang) * rad;
      } else {
        const sp = world.spawns[(i * 7 + 3) % world.spawns.length];
        const ang = rng() * Math.PI * 2;
        const rad = 4 + rng() * 22;
        x = sp.x + Math.cos(ang) * rad;
        z = sp.z + Math.sin(ang) * rad;
      }
      x = Math.max(-500, Math.min(500, x));
      z = Math.max(-500, Math.min(500, z));
      const type = ['sword', 'bow', 'arrows'][Math.floor(rng() * 3)];
      this.addLoot(x, z, type, `wild-${i}`);
    }

    // Bot: menyerang, mengejar, membawa senjata (berpura-pura jadi player).
    // Ken: spawn RANDOM di seluruh map (bukan cuma di titik spawn), 2 dekat pemain
    // supaya langsung ada aksi, sisanya tersebar acak (±1-2 per ~100 m).
    const geo = new THREE.CapsuleGeometry(0.38, 1.0, 3, 6);
    for (let i = 0; i < BOT_COUNT; i++) {
      const w = botWeapon(rng);
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x785c36 }));
      if (i < 2) {
        const ang = rng() * Math.PI * 2;
        const rad = 30 + rng() * 25;
        mesh.position.set(
          Math.max(-500, Math.min(500, playerSpawn.x + Math.cos(ang) * rad)), 0.9,
          Math.max(-500, Math.min(500, playerSpawn.z + Math.sin(ang) * rad))
        );
      } else {
        // Acak merata di seluruh map (bukan di titik spawn supaya tak berkumpul).
        mesh.position.set(-480 + rng() * 960, 0.9, -480 + rng() * 960);
      }
      this.root.add(mesh);
      // Senjata tampak di tangan bot (visual sederhana).
      let heldMesh = null;
      if (w) {
        heldMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.1, 0.1),
          new THREE.MeshStandardMaterial({ color: w === 'sword' ? 0xc7cbd0 : 0x9d642e })
        );
        heldMesh.position.set(0.32, 0.55, 0.15);
        mesh.add(heldMesh);
      }
      this.bots.push({
        mesh, heldMesh, weapon: w, hp: 100, alive: true, hitAt: 0,
        home: mesh.position.clone(), state: 'patrol', phase: i * 1.7,
        strafeDir: rng() < 0.5 ? 1 : -1,
      });
    }

    this._off = [
      on('input:attack', () => this.attack()),
      on('input:interact', () => this.pickup()),
      on('input:drop', () => this.drop()),
      on('input:throw', () => this.drop(true)),
      on('input:slot', (i) => { this.slot = i; this.updateHud(); }),
      on('input:aim', (v) => this.aim(!!v)),
    ];
    this.updateHud();
    this.updatePrompt();
  }

  updatePrompt() {
    const p = this.s.player.position;
    const item = this.items
      .filter((i) => i.active && Math.hypot(i.x - p.x, i.z - p.z) <= PICKUP)
      .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    this.s.hud.setPrompt(item ? `Ambil ${item.type === 'bow' ? 'Busur' : item.type === 'sword' ? 'Pedang' : 'Anak panah'}` : null);
  }

  addLoot(x, z, type, id) {
    const colors = { bow: 0x9d642e, sword: 0xc7cbd0, arrows: 0xd6c48a };
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.16, 0.16),
      new THREE.MeshStandardMaterial({ color: colors[type] || 0xd6c48a })
    );
    mesh.position.set(x, terrainHeight(x, z) + 0.25, z);
    mesh.userData.lootId = id;
    this.root.add(mesh);
    this.items.push({ id, type, x, z, mesh, active: true });
  }

  aim(on) { this.s.cameraRig.setAiming(on); this.s.player.setAiming(on); this.s.hud.setCrosshair(on); }

  /** Bot mati → jatuhkan senjatanya sebagai loot yang bisa diambil pemain. */
  _killBot(b) {
    b.alive = false;
    b.mesh.visible = false;
    b.respawn = Date.now() + RESPAWN_MS;
    this.s.hud.addKillFeed('Bot dikalahkan');
    if (b.weapon) {
      const dx = (Math.random() - 0.5) * 1.2;
      const dz = (Math.random() - 0.5) * 1.2;
      this.addLoot(b.mesh.position.x + dx, b.mesh.position.z + dz, b.weapon, `botdrop-${crypto.randomUUID()}`);
      this.s.hud.toast(`Bot menjatuhkan ${b.weapon === 'sword' ? 'Pedang' : 'Busur'}`);
      b.weapon = null;
    }
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    for (const t of [...this.tracers]) {
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.18);
      if (t.life <= 0) {
        this.root.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        this.tracers.splice(this.tracers.indexOf(t), 1);
      }
    }

    const p = this.s.player.position;
    const nowMs = Date.now();
    for (const b of this.bots) {
      if (!b.alive) {
        if (nowMs >= b.respawn) {
          b.alive = true;
          b.hp = 100;
          b.mesh.visible = true;
          b.mesh.position.copy(b.home);
          if (!b.weapon && Math.random() < 0.5) b.weapon = Math.random() < 0.5 ? 'sword' : 'bow';
        }
        continue;
      }
      b.mesh.position.y = terrainHeight(b.mesh.position.x, b.mesh.position.z) + 0.9;
      const d = b.mesh.position.distanceTo(p);

      // AI menyerupai player: patrol → kejar → serang + strafe mengitar.
      if (this.s.player.dead) b.state = 'patrol';
      else if (d < BOT_ATTACK_RANGE + 0.4) b.state = 'attack';
      else if (d < BOT_AGGRO_RANGE) b.state = 'chase';
      else b.state = 'patrol';

      if (b.state === 'patrol') {
        // Berkeliaran luas (radius 14 m), bukan diam di titik — terasa hidup.
        const t = performance.now() * 0.00028 + b.phase;
        const tx = b.home.x + Math.sin(t) * 14;
        const tz = b.home.z + Math.cos(t * 0.8) * 14;
        const dd = Math.hypot(tx - b.mesh.position.x, tz - b.mesh.position.z);
        if (dd > 0.4) {
          const step = Math.min(BOT_SPEED * 0.5 * dt, dd);
          b.mesh.position.x += ((tx - b.mesh.position.x) / dd) * step;
          b.mesh.position.z += ((tz - b.mesh.position.z) / dd) * step;
          b.mesh.rotation.y = Math.atan2(tx - b.mesh.position.x, tz - b.mesh.position.z);
        }
      } else {
        b.mesh.lookAt(p.x, b.mesh.position.y, p.z);
        if (b.state === 'chase' && d > BOT_ATTACK_RANGE * 0.85) {
          const step = Math.min(BOT_SPEED * dt, d - BOT_ATTACK_RANGE * 0.8);
          if (step > 0) {
            b.mesh.position.x += ((p.x - b.mesh.position.x) / d) * step;
            b.mesh.position.z += ((p.z - b.mesh.position.z) / d) * step;
          }
        }
        if (b.state === 'attack') {
          const sa = Math.sin(performance.now() * 0.0016 + b.phase) * 0.55 * b.strafeDir;
          const rx = Math.cos(b.mesh.rotation.y), rz = -Math.sin(b.mesh.rotation.y);
          b.mesh.position.x += rx * sa * dt;
          b.mesh.position.z += rz * sa * dt;
          if (d < BOT_ATTACK_RANGE && nowMs - b.hitAt > BOT_HIT_COOLDOWN_MS) {
            b.hitAt = nowMs;
            if (this.s.player.takeDamage(BOT_DAMAGE, nowMs)) {
              this.s.hud.setHp(this.s.player.hp);
              this.s.hud.toast(b.weapon === 'sword' ? 'Bot menebas dengan pedang!' : b.weapon === 'bow' ? 'Bot memanahmu!' : 'Kamu terkena serangan bot');
            }
            if (this.s.player.dead) {
              this.s.hud.addKillFeed('Kamu dikalahkan bot');
              this.die();
            }
          }
        }
      }
    }
    this.updatePrompt();
  }

  pickup() {
    const p = this.s.player.position;
    const item = this.items
      .filter((i) => i.active && Math.hypot(i.x - p.x, i.z - p.z) <= PICKUP)
      .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    if (!item) return this.s.hud.toast('Tidak ada loot di dekatmu');
    const result = takeLoot(this.inventory, item.type);
    if (!result.ok) return this.s.hud.toast(result.reason === 'full' ? 'Inventori penuh · jatuhkan senjata dahulu' : 'Ambil busur terlebih dahulu');
    item.active = false;
    item.mesh.visible = false;
    if (!result.ammo) this.slot = result.slot;
    this.updateHud();
    this.s.hud.toast(result.ammo ? 'Anak panah +10' : `${item.type === 'bow' ? 'Busur' : 'Pedang'} diambil`);
  }

  attack() {
    if (this.cooldown > 0 || this.s.player.dead) return;
    const held = this.inventory[this.slot];
    const weapon = weaponClass(held);
    const rule = WEAPONS[weapon === 'unarmed' ? 'fist' : weapon];
    if (weapon === 'bow' && held.ammo <= 0) return this.s.hud.toast('Anak panah habis');
    this.cooldown = rule.cooldown;
    if (weapon === 'bow') held.ammo--;

    const origin = this.s.player.position.clone().add(new THREE.Vector3(0, 1, 0));
    const dir = new THREE.Vector3(...Object.values(this.s.cameraRig.aimDirection()));
    const ray = new THREE.Raycaster(origin, dir, 0, rule.range);
    this.root.updateMatrixWorld(true);
    this.s.structures.updateMatrixWorld(true);

    const bots = this.bots.filter((b) => b.alive);
    const hits = ray.intersectObjects(bots.map((b) => b.mesh), false);
    const hit = hits[0];
    const wall = ray.intersectObjects(this.s.structures.children, true)[0];
    const target = hit && (!wall || wall.distance >= hit.distance) ? bots.find((b) => b.mesh === hit.object) : null;

    if (weapon === 'bow') {
      const from = this.s.player.position.clone().add(new THREE.Vector3(0, 1, 0));
      const to = target ? hit.point : from.clone().addScaledVector(dir, rule.range);
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([from, to]),
        new THREE.LineBasicMaterial({ color: target ? 0xffe08a : 0xd8d2b5, transparent: true, opacity: 1 })
      );
      this.tracers.push({ line, life: 0.18 });
      this.root.add(line);
    }

    if (target) {
      target.hp = Math.max(0, target.hp - DAMAGE);
      this.s.hud.toast('Kena!');
      if (!target.hp) this._killBot(target);
    }
    this.updateHud();
  }

  drop(throwing = false) {
    const item = this.inventory[this.slot];
    if (!item) return;
    const p = this.s.player.position;
    const y = this.s.player.yaw;
    const d = throwing ? WEAPONS.throw.range : 1.2;
    const x = p.x + Math.sin(y) * d;
    const z = p.z + Math.cos(y) * d;
    this.addLoot(x, z, item.type, `drop-${crypto.randomUUID()}`);
    this.inventory[this.slot] = null;
    this.updateHud();
    if (throwing) {
      const hit = this.bots.find((b) => b.alive && Math.hypot(b.mesh.position.x - x, b.mesh.position.z - z) < 1.2);
      if (hit) {
        hit.hp = Math.max(0, hit.hp - DAMAGE);
        this.s.hud.toast('Lemparan kena!');
        if (!hit.hp) this._killBot(hit);
      }
    }
    this.s.hud.toast(throwing ? 'Senjata dilempar' : 'Senjata dijatuhkan');
  }

  die() {
    if (this.s._respawnAt) return;
    this.s.input.enable(false);
    this.s._respawnAt = Date.now() + 3000;
    emit('input:death');
  }

  respawn() {
    if (!this.s.player.dead) return;
    this.s._spawn();
    this.s.player.hp = 100;
    this.s.player.dead = false;
    this.s.player.invulnUntil = Date.now() + 2000;
    this.inventory = [null, null];
    this.updateHud();
    this.s.input.enable(!this.s.paused);
    this.s.hud.show(true);
    document.getElementById('screen-death')?.classList.add('hidden');
    this.s.hud.toast('Respawn · HP 100');
  }

  updateHud() {
    const item = this.inventory[this.slot];
    this.s.hud.setWeapon(item?.type === 'bow' ? 'Busur' : item?.type === 'sword' ? 'Pedang' : 'Tangan Kosong', item?.ammo ?? null);
  }

  dispose() {
    this._off.forEach((off) => off());
    this.s.scene.remove(this.root);
    this.root.traverse((o) => {
      o.geometry?.dispose();
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else o.material?.dispose();
    });
    this.tracers.length = 0;
  }
}
