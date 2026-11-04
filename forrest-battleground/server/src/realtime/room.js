// realtime/room.js — authoritative room 'forest'. Server pegang posisi/HP/ammo/loot/kill.
// prompt.md Fase 3: tick 20Hz, snapshot AoI 10Hz, enemy map 1-2Hz, tanpa Three di server.
// PURE dari I/O (dibungkus gateway) supaya bisa diuji headless.
import { getWorld } from '../../../src/shared/world.js';
import { buildColliderGrid, resolveMove, clampToWorld, groundY } from '../../../src/shared/movement.js';
import { PLAYER, WEAPONS, LOOT, COMBAT, NETWORK, SPAWN } from '../../../src/shared/constants.js';
import { makeRng } from '../../../src/shared/rng.js';
import { writeKill } from '../persistence/leaderboardRepo.js';

const now = () => Date.now();
const TICK_MS = 1000 / NETWORK.TICK_HZ;
const SNAPSHOT_MS = 1000 / NETWORK.SNAPSHOT_HZ;
const ENEMY_MAP_MS = 1000 / NETWORK.ENEMY_MAP_HZ;

/** Uji garis pandang: sampling lintasan vs collider (cukup untuk dinding 0.25 m). */
export function hasLineOfSight(grid, ax, az, bx, bz) {
  const dist = Math.hypot(bx - ax, bz - az);
  if (dist < 1e-4) return true;
  const steps = Math.ceil(dist / 1.0);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = ax + (bx - ax) * t;
    const pz = az + (bz - az) * t;
    for (const c of grid.map.get(`${Math.floor(px / grid.cell)},${Math.floor(pz / grid.cell)}`) || []) {
      if (c.hx !== undefined) {
        const cos = Math.cos(-c.rotY), sin = Math.sin(-c.rotY);
        const dx = px - c.cx, dz = pz - c.cz;
        const lx = dx * cos - dz * sin, lz = dx * sin + dz * cos;
        const ex = Math.max(Math.abs(lx) - c.hx, 0), ez = Math.max(Math.abs(lz) - c.hz, 0);
        if (ex * ex + ez * ez < 0.09) return false;
      }
    }
  }
  return true;
}

const rand = makeRng(0x726f6f6d);

export class Room {
  constructor({ roomId = 'forest', hardCap = NETWORK.ROOM_HARD_CAP, onEvent = () => {} } = {}) {
    this.roomId = roomId;
    this.hardCap = hardCap;
    this.onEvent = onEvent; // (name, payload) untuk gateway/kill feed
    this.world = getWorld();
    this.grid = buildColliderGrid(this.world.colliders);
    this.players = new Map(); // sessionId -> state
    this.loot = new Map();    // lootId -> {id,type,x,z,ammo}
    this.respawns = new Map(); // static lootId -> respawnAt (ms)
    this.tick = 0;
    this.lastTickAt = 0;
    this.lastSnapshotAt = 0;
    this.lastMapAt = 0;
    this.kills = 0;
    this._spawnLoot();
  }

  // ---------------------------------------------------------------- loot
  _spawnLoot() {
    for (const p of this.world.loot) {
      const type = ['bow', 'sword', 'arrows'][(p.id.length + p.x | 0) % 3];
      this.loot.set(p.id, { id: p.id, type, x: p.x, z: p.z });
    }
  }

  /**
   * Hapus loot dari tanah DAN jadwalkan respawn 45-90 s (prompt.md §1.2).
   * Statis: id yang sama kembali di titik yang sama. Drop pemain: TIDAK
   * direspawn (itu item bebas, tidak boleh menghilang dari tangan pemain lain
   * yang sudah memungutnya) — bedanya di sini.
   */
  _takeLoot(id) {
    const l = this.loot.get(id);
    if (!l) return;
    this.loot.delete(id);
    if (this.world.loot.some((p) => p.id === id)) {
      this.respawns.set(id, now() + LOOT.RESPAWN_MIN_MS + Math.floor(rand() * (LOOT.RESPAWN_MAX_MS - LOOT.RESPAWN_MIN_MS)));
    }
  }

  /** Respawn loot terjadwal (dipanggil tiap tick). */
  _respawnLoot(t) {
    if (!this.respawns.size) return;
    for (const [id, at] of this.respawns) {
      if (t < at) continue;
      this.respawns.delete(id);
      const spot = this.world.loot.find((p) => p.id === id);
      if (!spot || this.loot.has(id)) continue;
      const type = ['bow', 'sword', 'arrows'][(id.length + spot.x | 0) % 3];
      this.loot.set(id, { id, type, x: spot.x, z: spot.z });
      this.onEvent('loot_respawn', { id, type, x: spot.x, z: spot.z });
    }
  }

  /** Titik loot valid (tidak di dalam collider) — untuk uji & respawn loot. */
  lootSpotFarFrom(players) {
    const candidates = [...this.loot.values()].filter((l) =>
      players.every((p) => Math.hypot(p.x - l.x, p.z - l.z) > 25));
    return candidates.length ? candidates[Math.floor(rand() * candidates.length)] : null;
  }

  // ---------------------------------------------------------------- join/leave
  isFull() { return this.players.size >= this.hardCap; }

  join({ sessionId, userId, username, character }) {
    const spawn = this._pickSpawn();
    const state = {
      sessionId, userId, username, character,
      x: spawn.x, y: spawn.y, z: spawn.z, yaw: 0,
      mx: 0, mz: 0, sprint: false, prone: false, jumping: false, vy: 0,
      hp: PLAYER.HP_MAX, dead: false, respawnAt: 0, invulnUntil: 0,
      inventory: [null, null], slot: 0,
      lastSeq: -1, cooldownUntil: 0, inputWindow: { at: 0, n: 0 }, attackWindow: { at: 0, n: 0 },
      lastDamagerId: null, lastDamagerAt: 0,
      joinedAt: now(), kills: 0, deaths: 0,
    };
    this.players.set(sessionId, state);
    this.onEvent('join', { sessionId, username, character, x: state.x, z: state.z });
    return state;
  }

  /**
   * Pilih spawn AMAN: usahakan >= SPAWN.MIN_ENEMY_DISTANCE (30 m) dari pemain lain.
   * prompt.md §1.2 "Safe spawn:usahakan >= 30 m dari musuh; fallback teraman".
   * 24 sampel acak saja kadang habis sebelum menemukan titik > 30 m (terukur:
   * 1 dari 8 sampel < 100 m), jadi pool diacak lalu diurutkan pakai jarak minimum.
   */
  _pickSpawn(avoid = null) {
    const others = [...this.players.values()];
    const pool = avoid ? [avoid] : this.world.spawns;
    if (!pool.length) throw new Error('tidak ada kandidat spawn');
    const minDist = (c) => {
      let m = Infinity;
      for (const o of others) {
        const d = Math.hypot(o.x - c.x, o.z - c.z);
        if (d < m) m = d;
      }
      return others.length ? m : Infinity;
    };
    // Urutkan kandidat acak dari terjauh; ambil yang pertama >= 30 m (atau
    // yang terjauh sebagai fallback teraman).
    const ranked = [...pool]
      .sort(() => rand() - 0.5)
      .slice(0, 48)
      .sort((a, b) => minDist(b) - minDist(a));
    const best = ranked[0];
    return minDist(best) >= SPAWN.MIN_ENEMY_DISTANCE ? best : ranked[0];
  }

  leave(sessionId, reason = 'leave') {
    const p = this.players.get(sessionId);
    if (!p) return null;
    this.players.delete(sessionId);
    // Kredit kematian ke penyerang terakhir jika masih dalam jendela combat-logout.
    if (p.dead === false && p.lastDamagerId && now() - p.lastDamagerAt < COMBAT.COMBAT_LOGOUT_SECONDS * 1000) {
      const killer = this.players.get(p.lastDamagerId);
      if (killer) this._registerKill(killer, p, 'combat_logout');
      else this._registerKill(null, p, 'combat_logout');
    }
    this.onEvent('leave', { sessionId, username: p.username, reason });
    return p;
  }

  get onlineCount() { return this.players.size; }

  // ---------------------------------------------------------------- input
  /** @returns {{ok:true}|{ok:false,code:string}} */
  applyInput(sessionId, m) {
    const p = this.players.get(sessionId);
    if (!p) return { ok: false, code: 'NOT_JOINED' };
    if (p.dead) return { ok: true }; // input mati diabaikan (bukan error)

    // seq harus naik: replay/urutan lama ditolak.
    if (m.seq <= p.lastSeq) return { ok: false, code: 'SEQ_REPLAY' };
    p.lastSeq = m.seq;

    const w = p.inputWindow;
    if (now() - w.at > 1000) { w.at = now(); w.n = 0; }
    if (++w.n > NETWORK.MAX_INPUT_PER_SEC) return { ok: false, code: 'INPUT_FLOOD' };

    p.mx = m.mx; p.mz = m.mz; p.yaw = m.yaw;
    p.sprint = m.sprint; p.prone = m.prone;
    if (m.jump && !p.prone && !p.dead) p.vy = PLAYER.JUMP_SPEED;
    return { ok: true };
  }

  // ---------------------------------------------------------------- tick
  step(dtSec = TICK_MS / 1000) {
    this.tick++;
    const t = now();
    this._respawnLoot(t);
    for (const p of this.players.values()) {
      if (p.dead) {
        if (t >= p.respawnAt) this._respawn(p);
        continue;
      }
      // arah relatif kamera: yaw 0 => forward +Z (sama dengan client).
      const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
      const speed = p.prone ? PLAYER.PRONE_SPEED : p.sprint ? PLAYER.SPRINT_SPEED : PLAYER.WALK_SPEED;
      const mag = Math.hypot(p.mx, p.mz) || 1;
      const dx = (p.mx * cos + p.mz * sin) / mag * speed * dtSec;
      const dz = (-p.mx * sin + p.mz * cos) / mag * speed * dtSec;
      const moved = resolveMove(this.grid, p.x, p.z, p.x + dx, p.z + dz, PLAYER.RADIUS);
      const clamped = clampToWorld(moved.x, moved.z);
      p.x = clamped.x; p.z = clamped.z; p.y = groundY(p.x, p.z);
      // Lompatan: gravitasi sederhana, jatuh kembali ke terrain (tanpa benturan rumit).
      if (p.vy !== 0) {
        p.vy = Math.max(0, p.vy + PLAYER.GRAVITY * dtSec);
        p.y += p.vy * dtSec;
        const g = groundY(p.x, p.z);
        if (p.y <= g) { p.y = g; p.vy = 0; }
      }
    }
  }

  // ---------------------------------------------------------------- combat
  /** @returns {{ok:true,hit?:object}|{ok:false,code:string}} */
  attack(sessionId) {
    const p = this.players.get(sessionId);
    if (!p) return { ok: false, code: 'NOT_JOINED' };
    if (p.dead) return { ok: false, code: 'DEAD' };

    const w = p.attackWindow;
    const t = now();
    if (t - w.at > 1000) { w.at = t; w.n = 0; }
    if (++w.n > 50) return { ok: false, code: 'ATTACK_FLOOD' };

    const held = p.inventory[p.slot];
    const weaponId = held ? (held.type === 'arrows' ? 'unarmed' : held.type) : 'unarmed';
    const rule = WEAPONS[weaponId];
    if (t < p.cooldownUntil) return { ok: false, code: 'COOLDOWN' };
    if (weaponId === 'bow') {
      if (!held || (held.ammo ?? 0) <= 0) return { ok: false, code: 'NO_AMMO' };
    }
    p.cooldownUntil = t + rule.cooldownMs;

    if (weaponId === 'bow') held.ammo -= 1;

    // Bidik: arah dari yaw pemain (server tidak percaya "aim" client).
    const dirX = Math.sin(p.yaw), dirZ = Math.cos(p.yaw);
    const ox = p.x, oz = p.z;
    let best = null;
    for (const q of this.players.values()) {
      if (q === p || q.dead || now() < q.invulnUntil) continue;
      const dx = q.x - ox, dz = q.z - oz;
      const dist = Math.hypot(dx, dz);
      if (dist > rule.range) continue;
      const dot = (dx * dirX + dz * dirZ) / (dist || 1);
      if (dot < 0.985) continue; // kon 10° — harus benar-benar mengarah ke target
      if (!hasLineOfSight(this.grid, ox, oz, q.x, q.z)) continue;
      if (!best || dist < best.dist) best = { p: q, dist };
    }

    if (!best) return { ok: true, hit: null };
    return { ok: true, hit: this._damage(p, best.p, weaponId, rule.damage) };
  }

  _damage(attacker, victim, weaponId, damage) {
    if (victim.dead || now() < victim.invulnUntil) return null;
    victim.hp = Math.max(0, victim.hp - damage);
    victim.lastDamagerId = attacker.sessionId;
    victim.lastDamagerAt = now();
    const killed = victim.hp === 0;
    if (killed) {
      victim.dead = true;
      victim.respawnAt = now() + COMBAT.RESPAWN_DELAY_MS;
      this._dropWeapon(victim);
      this._registerKill(attacker, victim, 'combat');
    }
    return { sessionId: victim.sessionId, hp: victim.hp, dead: killed, weapon: weaponId, by: attacker.sessionId };
  }

  _dropWeapon(p) {
    const item = p.inventory[p.slot];
    p.inventory = [null, null];
    if (!item) return;
    // Jatuhkan sekali, dengan ID unik; jangan pernah menimpa loot statis.
    const id = `drop-${p.sessionId}-${this.tick}`;
    this.loot.set(id, { id, type: item.type, x: p.x, z: p.z, ammo: item.ammo ?? null });
    this.onEvent('loot_spawn', { id, type: item.type, x: p.x, z: p.z });
  }

  _respawn(p) {
    const spawn = this._pickSpawn();
    p.x = spawn.x; p.y = spawn.y; p.z = spawn.z;
    p.hp = PLAYER.HP_MAX; p.dead = false; p.vy = 0;
    p.inventory = [null, null]; p.slot = 0;
    p.invulnUntil = now() + PLAYER.RESPAWN_INVULN_MS;
    p.lastDamagerId = null; p.lastDamagerAt = 0;
    this.onEvent('respawn', { sessionId: p.sessionId, x: p.x, z: p.z });
  }

  /** Ledger kill/death: transaksi idempotent (event_id unik). */
  _registerKill(killer, victim, cause) {
    const eventId = `ev-${this.roomId}-${victim.sessionId}-${now()}-${this.tick}`;
    const out = writeKill({
      eventId,
      roomId: this.roomId,
      victimId: victim.userId,
      killerId: killer ? killer.userId : null,
      weapon: 'sword',
      cause,
    });
    if (out.applied) {
      if (killer) killer.kills += 1;
      victim.deaths += 1;
      this.kills += 1;
      this.onEvent('kill', { killer: killer?.username ?? null, victim: victim.username, cause, eventId });
    }
    return out;
  }

  // ---------------------------------------------------------------- loot/inventory
  pickup(sessionId) {
    const p = this.players.get(sessionId);
    if (!p || p.dead) return { ok: false, code: 'NOT_JOINED' };
    let best = null;
    let bestD = LOOT.PICKUP_RANGE;
    for (const l of this.loot.values()) {
      const d = Math.hypot(l.x - p.x, l.z - p.z);
      if (d <= bestD) { bestD = d; best = l; }
    }
    if (!best) return { ok: false, code: 'NO_LOOT' };
    if (best.type === 'arrows') {
      const bow = p.inventory.find((i) => i && i.type === 'bow');
      if (!bow) return { ok: false, code: 'BOW_REQUIRED' };
      bow.ammo = Math.min(30, (bow.ammo ?? 0) + 10);
      this._takeLoot(best.id);
      this.onEvent('loot_taken', { id: best.id, by: p.sessionId, ammo: bow.ammo });
      return { ok: true, ammo: bow.ammo };
    }
    const slot = p.inventory.findIndex((i) => !i);
    if (slot < 0) return { ok: false, code: 'FULL' };
    p.inventory[slot] = { type: best.type, ammo: best.type === 'bow' ? LOOT.BOW_START_ARROWS : null };
    p.slot = slot;
    this._takeLoot(best.id);
    this.onEvent('loot_taken', { id: best.id, by: p.sessionId, slot });
    return { ok: true, slot, type: best.type };
  }

  setSlot(sessionId, slot) {
    const p = this.players.get(sessionId);
    if (!p) return { ok: false, code: 'NOT_JOINED' };
    p.slot = slot === 1 ? 1 : 0;
    return { ok: true };
  }

  drop(sessionId, throwing = false) {
    const p = this.players.get(sessionId);
    if (!p || p.dead) return { ok: false, code: 'NOT_JOINED' };
    const item = p.inventory[p.slot];
    if (!item) return { ok: false, code: 'EMPTY' };
    p.inventory[p.slot] = null;
    const d = throwing ? WEAPONS.thrown.range : 1.2;
    const x = p.x + Math.sin(p.yaw) * d;
    const z = p.z + Math.cos(p.yaw) * d;
    const id = `drop-${p.sessionId}-${this.tick}`;
    this.loot.set(id, { id, type: item.type, x, z, ammo: item.ammo ?? null });

    if (!throwing) return { ok: true };
    // Lemparan: satu target terdekat dalam 1.2 m (dipakai untuk uji saja).
    let target = null; let bestD = 1.2;
    for (const q of this.players.values()) {
      if (q === p || q.dead) continue;
      const dist = Math.hypot(q.x - x, q.z - z);
      if (dist <= bestD) { bestD = dist; target = q; }
    }
    if (target) {
      const r = this._damage(p, target, 'thrown', WEAPONS.thrown.damage);
      return { ok: true, hit: r };
    }
    return { ok: true, hit: null };
  }

  // ---------------------------------------------------------------- snapshot
  /** Snapshot AoI 10Hz untuk satu pemain. Posisi terkuantisasi (cm). */
  snapshotFor(sessionId) {
    const me = this.players.get(sessionId);
    if (!me) return null;
    const q = (n) => Math.round(n * 100) / 100;
    const others = [];
    for (const p of this.players.values()) {
      if (p === me) continue;
      if (Math.hypot(p.x - me.x, p.z - me.z) > NETWORK.AOI_RADIUS) continue;
      others.push({
        id: p.sessionId,
        c: p.character,
        x: q(p.x), y: q(p.y), z: q(p.z), yaw: Math.round(p.yaw * 100) / 100,
        w: p.inventory[p.slot]?.type ?? 'unarmed',
        d: p.dead ? 1 : 0,
      });
    }
    return { t: 'snapshot', tick: this.tick, self: this._self(me), players: others };
  }

  _self(p) {
    return {
      id: p.sessionId,
      x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100, z: Math.round(p.z * 100) / 100,
      yaw: Math.round(p.yaw * 100) / 100,
      hp: p.hp, dead: p.dead,
      invulnMs: Math.max(0, p.invulnUntil - now()),
      respawnInMs: p.dead ? Math.max(0, p.respawnAt - now()) : 0,
      inv: p.inventory.map((i) => (i ? { type: i.type, ammo: i.ammo ?? null } : null)),
      slot: p.slot,
      cooldownMs: Math.max(0, p.cooldownUntil - now()),
      kills: p.kills, deaths: p.deaths,
      online: this.onlineCount,
    };
  }

  /** Enemy map 2Hz: posisi anonim (tanpa username/HP) terkuantisasi 2 m. */
  enemyMapFor(sessionId) {
    const me = this.players.get(sessionId);
    if (!me) return null;
    const out = [];
    for (const p of this.players.values()) {
      if (p === me) continue;
      out.push({
        i: [...p.sessionId].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 65536, // id anonim
        x: Math.round(p.x / 2) * 2, z: Math.round(p.z / 2) * 2, d: p.dead ? 1 : 0,
      });
    }
    return { t: 'enemy_map', players: out };
  }
}
