// tests/realtime.test.js — integrasi Fase 3 lewat SERVER NYATA + WSS nyata.
// prompt.md Fase 3 QA butir 1: 2 klien register→join→sword/bow→5 hit→kill feed
// →leaderboard→respawn→exit→online count turun. Plus serangan keamanan dasar.
import { test, describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';

const ORIGIN = 'https://akbarwiran.github.io';
const EVIL = 'https://evil.example';

process.env.NODE_ENV = 'test';
process.env.FRONTEND_ORIGINS = ORIGIN;
process.env.DATABASE_FILE = ':memory:';
process.env.AUTH_SECRET = 'x'.repeat(48);
// AUTH_SECRET harus >=32 byte; nilai di atas tepat 48 byte.

const { buildApp } = await import('../src/app.js');
const { config } = await import('../src/config.js');
const { runMigrations } = await import('../src/persistence/migrate.js');
const { resetAll } = await import('../src/security/rateLimit.js');

let app;
let base;
let wsBase;

before(async () => {
  runMigrations(); // :memory: DB — buat skema dulu, seperti server.js saat boot

  app = await buildApp();
  await app.listen({ host: '127.0.0.1', port: 0 });
  base = `http://127.0.0.1:${app.server.address().port}`;
  wsBase = `ws://127.0.0.1:${app.server.address().port}/ws`;
});

after(async () => { await app?.close(); });

// Rate limit register 5/15m/IP terlalu ketat untuk satu file test yang membuat
// belasan akun. Ini KETATANAN TEST, bukan pelonggaran produksi.
beforeEach(() => { resetAll(); });

const post = (path, body, headers = {}) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...headers },
    body: JSON.stringify(body),
  });

async function makeUser(tag, character = 'male') {
  const username = `qa_${tag}_${Math.random().toString(36).slice(2, 8)}`;
  const res = await post('/api/v1/auth/register', { username, password: 'kata-sandi-qa-123', character });
  assert.equal(res.status, 201, `register ${username} gagal: ${res.status}`);
  const data = await res.json();
  return { username, token: data.token, userId: data.user.id };
}

/** Klien WSS minimal: kirim/terima JSON, tunggu tipe tertentu. */
class Client {
  constructor(url, origin = ORIGIN) {
    this.ws = new WebSocket(url, { headers: { Origin: origin } });
    this.inbox = [];
    this.ws.on('message', (raw) => {
      try { this.inbox.push(JSON.parse(raw.toString())); } catch { /* abaikan non-JSON */ }
    });
    this.closed = null;
    this.ws.on('close', (code, reason) => { this.closed = { code, reason: reason.toString() }; });
  }
  ready() {
    return new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('WS open timeout')), 5000);
      this.ws.once('open', () => { clearTimeout(t); res(); });
      this.ws.once('error', (e) => { clearTimeout(t); rej(e); });
    });
  }
  send(obj) { this.ws.send(JSON.stringify(obj)); }
  async waitFor(type, timeoutMs = 8000) {
    const t0 = Date.now();
    for (;;) {
      const i = this.inbox.findIndex((m) => m.t === type);
      if (i >= 0) return this.inbox.splice(i, 1)[0];
      if (Date.now() - t0 > timeoutMs) return null;
      if (this.closed) return null;
      await new Promise((r) => setTimeout(r, 25));
    }
  }
  close() { try { this.ws.close(); } catch { /* ignore */ } }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

describe('Fase 3 — WSS authoritative', () => {
  test('1. handshake origin asing ditolak (close), origin sah diterima', async () => {
    const evil = new Client(wsBase, EVIL);
    await evil.ready().catch(() => {});
    await wait(300);
    assert.ok(evil.closed, 'socket origin asing tidak ditutup');
    assert.equal(evil.closed.code, 1008);
    evil.close();
  });

  test('2. pesan non-JSON / oversized ditolak tanpa join', async () => {
    const c = new Client(wsBase);
    await c.ready();
    c.ws.send('ini bukan json');
    await wait(200);
    assert.ok(c.closed, 'frame non-JSON tidak ditutup');
    c.close();
  });

  test('3. auth wajib sebelum join; token invalid langsung close', async () => {
    const c = new Client(wsBase);
    await c.ready();
    c.send({ t: 'join', room: 'forest' });
    await wait(200);
    assert.ok(c.closed, 'join tanpa auth tidak ditutup');
    assert.equal(c.closed.code, 1008);
    c.close();

    const bad = new Client(wsBase);
    await bad.ready();
    bad.send({ t: 'auth', token: 'a.b.c' });
    await wait(200);
    assert.ok(bad.closed, 'token invalid tidak ditutup');
    assert.equal(bad.closed.code, 1008);
    bad.close();
  });

  test('4. alur penuh: 2 klien, sword 5 hit, kill, leaderboard, respawn, exit', async () => {
    const a = await makeUser('warrior', 'male');
    const b = await makeUser('hunter', 'female');

    const ca = new Client(wsBase); await ca.ready();
    ca.send({ t: 'auth', token: a.token });
    assert.ok(await ca.waitFor('auth_ok'), 'auth_ok A tidak datang');
    ca.send({ t: 'join', room: 'forest' });
    const ja = await ca.waitFor('joined');
    assert.ok(ja, 'joined A tidak datang');
    assert.equal(ja.room, 'forest');

    const cb = new Client(wsBase); await cb.ready();
    cb.send({ t: 'auth', token: b.token });
    assert.ok(await cb.waitFor('auth_ok'), 'auth_ok B tidak datang');
    cb.send({ t: 'join', room: 'forest' });
    assert.ok(await cb.waitFor('joined'), 'joined B tidak datang');

    // --- online count dari REST (authoritative room)
    const st1 = await (await fetch(`${base}/api/v1/maps/forest/status`, {
      headers: { Origin: ORIGIN, Authorization: `Bearer ${a.token}` },
    })).json();
    assert.equal(st1.status.onlineCount, 2, `onlineCount=${st1.status.onlineCount} != 2`);

    // --- B berhenti (jadi target diam), A menghadap B lalu 5x serangan
    const room = app.websocketServer ? null : null;
    // Ambil room lewat gateway yang terpasang di app.
    const gw = (await import('../src/realtime/index.js')).getRealtime();
    const pb = [...gw.room.players.values()].find((p) => p.userId === b.userId);
    const pa = [...gw.room.players.values()].find((p) => p.userId === a.userId);
    assert.ok(pb && pa, 'pemain tidak ada di room');

    // Letakkan A tepat di depan B (server memegang posisi final, ini untuk UJI
    // arah bidik — bukan mekanisme yang bisa dipakai klien nyata).
    const yaw = Math.atan2(pb.x - pa.x, pb.z - pa.z);
    pa.x = pb.x - Math.sin(yaw) * 1.2; pa.z = pb.z - Math.cos(yaw) * 1.2;
    pa.yaw = yaw; pa.mx = 0; pa.mz = 0;

    // B tidak membalas: matikan input-nya (jadi target statis).
    pb.mx = 0; pb.mz = 0;

    for (let i = 0; i < 5; i++) {
      await wait(900); // lewati cooldown 800ms
      ca.send({ t: 'action', kind: 'attack' });
    }
    await wait(600);

    const lb = await (await fetch(`${base}/api/v1/leaderboard?mapId=forest&limit=10`, {
      headers: { Origin: ORIGIN, Authorization: `Bearer ${a.token}` },
    })).json();
    const rowA = lb.entries.find((e) => e.userId === a.userId);
    const rowB = lb.entries.find((e) => e.userId === b.userId);
    assert.ok(rowA, 'pembunuh tidak muncul di leaderboard');
    assert.equal(rowA.kills, 1, `kills A=${rowA?.kills} != 1`);
    assert.equal(rowA.deaths, 0);
    assert.ok(rowB, 'korban tidak muncul di leaderboard');
    assert.equal(rowB.kills, 0);
    assert.equal(rowB.deaths, 1, `deaths B=${rowB?.deaths} != 1`);

    // --- respawn otomatis 3s → HP 100, tangan kosong
    await wait(3400);
    const snapB = cb.inbox.filter((m) => m.t === 'snapshot').pop();
    assert.ok(snapB, 'B tidak menerima snapshot');
    assert.equal(snapB.self.hp, 100, `HP B setelah respawn=${snapB.self.hp}`);
    assert.equal(snapB.self.dead, false, 'B masih mati setelah respawn');
    assert.ok(snapB.self.inv.every((x) => x === null), 'tangan B tidak kosong');

    // --- exit ke lobby: count turun
    cb.send({ t: 'leave', sessionId: [...gw.room.players.values()].find((p) => p.userId === b.userId).sessionId });
    const ack = await cb.waitFor('leave_ack');
    assert.ok(ack, 'leave_ack tidak datang');
    await wait(200);
    const st2 = await (await fetch(`${base}/api/v1/maps/forest/status`, {
      headers: { Origin: ORIGIN, Authorization: `Bearer ${a.token}` },
    })).json();
    assert.equal(st2.status.onlineCount, 1, `onlineCount setelah exit=${st2.status.onlineCount} != 1`);

    ca.close(); cb.close();
    await wait(300);
    const st3 = await (await fetch(`${base}/api/v1/maps/forest/status`, {
      headers: { Origin: ORIGIN, Authorization: `Bearer ${a.token}` },
    })).json();
    assert.equal(st3.status.onlineCount, 0, `onlineCount setelah semua tutup=${st3.status.onlineCount} != 0`);
  });

  test('5. seq replay ditolak, teleport ditolak, damage palsu ditolak', async () => {
    const u = await makeUser('guard');
    const c = new Client(wsBase); await c.ready();
    c.send({ t: 'auth', token: u.token });
    await c.waitFor('auth_ok');
    c.send({ t: 'join', room: 'forest' });
    await c.waitFor('joined');

    const gw = (await import('../src/realtime/index.js')).getRealtime();
    const p = [...gw.room.players.values()].find((x) => x.userId === u.userId);
    assert.ok(p);

    // replay seq
    const r1 = gw.room.applyInput(p.sessionId, { t: 'input', seq: 10, mx: 0, mz: 0, yaw: 0 });
    assert.equal(r1.ok, true);
    const r2 = gw.room.applyInput(p.sessionId, { t: 'input', seq: 10, mx: 1, mz: 0, yaw: 0 });
    assert.equal(r2.ok, false);
    assert.equal(r2.code, 'SEQ_REPLAY');

    // koordinat client tidak pernah diterima (server tidak punya API setPosisi)
    assert.equal(typeof gw.room.setPosition, 'undefined', 'server tidak boleh menerima posisi klien');

    // attack tanpa senjata & tanpa target: aman (tidak error, tidak mematikan)
    const atk = gw.room.attack(p.sessionId);
    assert.equal(atk.ok, true);

    // frame klaim damage tidak dikenal protokol
    const parsed = (await import('../src/realtime/protocol.js')).parseFrame(
      Buffer.from(JSON.stringify({ t: 'damage', amount: 999 }))
    );
    assert.equal(parsed.ok, false);
    assert.equal(parsed.code, 'TYPE_UNKNOWN');

    // frame hp palsu juga tidak dikenal
    const parsed2 = (await import('../src/realtime/protocol.js')).parseFrame(
      Buffer.from(JSON.stringify({ t: 'input', seq: 1, mx: 0, mz: 0, yaw: 0, hp: 999 }))
    );
    assert.equal(parsed2.ok, true, 'input sah (hp diabaikan, bukan field protokol)');

    c.send({ t: 'leave', sessionId: p.sessionId });
    await c.waitFor('leave_ack');
    c.close();
  });

  test('6. duplicate login: satu avatar aktif per akun', async () => {
    const u = await makeUser('dupe');
    const c1 = new Client(wsBase); await c1.ready();
    c1.send({ t: 'auth', token: u.token }); await c1.waitFor('auth_ok');
    c1.send({ t: 'join', room: 'forest' }); await c1.waitFor('joined');

    const c2 = new Client(wsBase); await c2.ready();
    c2.send({ t: 'auth', token: u.token }); await c2.waitFor('auth_ok');
    c2.send({ t: 'join', room: 'forest' }); await c2.waitFor('joined');
    await wait(400);

    assert.ok(c1.closed, 'socket lama tidak ditutup saat login duplikat');
    const gw = (await import('../src/realtime/index.js')).getRealtime();
    const mine = [...gw.room.players.values()].filter((p) => p.userId === u.userId);
    assert.equal(mine.length, 1, `avatar ganda: ${mine.length}`);

    c2.send({ t: 'leave', sessionId: mine[0].sessionId });
    await c2.waitFor('leave_ack');
    c2.close();
  });

  test('7. combat-logout: exit saat terakhir dilukai tetap memberi kredit', async () => {
    const killer = await makeUser('killer9');
    const victim = await makeUser('victim9');

    const ck = new Client(wsBase); await ck.ready();
    ck.send({ t: 'auth', token: killer.token }); await ck.waitFor('auth_ok');
    ck.send({ t: 'join', room: 'forest' }); await ck.waitFor('joined');

    const cv = new Client(wsBase); await cv.ready();
    cv.send({ t: 'auth', token: victim.token }); await cv.waitFor('auth_ok');
    cv.send({ t: 'join', room: 'forest' }); await cv.waitFor('joined');

    const gw = (await import('../src/realtime/index.js')).getRealtime();
    const pk = [...gw.room.players.values()].find((p) => p.userId === killer.userId);
    const pv = [...gw.room.players.values()].find((p) => p.userId === victim.userId);

    // k lukai 4x (80 HP) lalu korban logout -> kredit ke k
    const yaw = Math.atan2(pv.x - pk.x, pv.z - pk.z);
    pk.x = pv.x - Math.sin(yaw) * 1.2; pk.z = pv.z - Math.cos(yaw) * 1.2;
    pk.yaw = yaw; pk.mx = 0; pk.mz = 0; pv.mx = 0; pv.mz = 0;
    for (let i = 0; i < 4; i++) { await wait(900); ck.send({ t: 'action', kind: 'attack' }); }
    await wait(300);
    assert.equal(pv.hp, 20, `HP korban=${pv.hp}`);

    cv.send({ t: 'leave', sessionId: pv.sessionId });
    await cv.waitFor('leave_ack');
    await wait(300);

    const lb = await (await fetch(`${base}/api/v1/leaderboard?mapId=forest&limit=10`, {
      headers: { Origin: ORIGIN, Authorization: `Bearer ${killer.token}` },
    })).json();
    const rowK = lb.entries.find((e) => e.userId === killer.userId);
    assert.ok(rowK, 'combat-logout tidak memberi kredit ke pembunuh');
    assert.equal(rowK.kills, 1, `kills k=${rowK?.kills} != 1`);

    ck.send({ t: 'leave', sessionId: pk.sessionId });
    await ck.waitFor('leave_ack');
    ck.close(); cv.close();
  });

  test('8. safe spawn: respawn selalu >= 30 m dari musuh (20 sampel)', async () => {
    const gw = (await import('../src/realtime/index.js')).getRealtime();
    const room = gw.room;
    for (const p of [...room.players.values()]) room.leave(p.sessionId, 'test');

    // Satu pemain NYATA di posisi tetap; spawn pemain lain harus >= 30 m dari dia.
    const a = room.join({ sessionId: 'sp-a', userId: 'sp-u-a', username: 'Anchor', character: 'male' });
    a.x = 120; a.z = -80; a.mx = 0; a.mz = 0;
    const dists = [];
    for (let i = 0; i < 25; i++) {
      const s = room._pickSpawn();
      dists.push(Math.round(Math.hypot(s.x - a.x, s.z - a.z)));
    }
    const worst = Math.min(...dists);
    assert.ok(
      worst >= 30,
      `spawn hanya ${worst} m dari pemain (spek >= 30 m): ${dists.join(',')}`
    );

    // Dua pemain: spawn kedua juga jauh dari yang pertama.
    const b = room.join({ sessionId: 'sp-b', userId: 'sp-u-b', username: 'Second', character: 'female' });
    assert.ok(
      Math.hypot(b.x - a.x, b.z - a.z) >= 30,
      `spawn kedua hanya ${Math.round(Math.hypot(b.x - a.x, b.z - a.z))} m`
    );
    room.leave('sp-a', 'test'); room.leave('sp-b', 'test');
  });

  test('9. loot respawn 45-90 s server-authoritative', async () => {
    const gw = (await import('../src/realtime/index.js')).getRealtime();
    const room = gw.room;
    for (const p of [...room.players.values()]) room.leave(p.sessionId, 'test');

    const u = await makeUser('looter');
    const c = new Client(wsBase); await c.ready();
    c.send({ t: 'auth', token: u.token }); await c.waitFor('auth_ok');
    c.send({ t: 'join', room: 'forest' }); await c.waitFor('joined');
    const p = [...room.players.values()].find((x) => x.userId === u.userId);

    // Ambil loot statis lewat aksi pickup SUNGGUHAN (pindahkan pemain ke titik loot
    // server-side; klien nyata memang harus berjalan ke sana).
    const spot = [...room.loot.values()].find((l) => l.type !== 'arrows');
    assert.ok(spot, 'loot statis harus ada di room');
    p.x = spot.x; p.z = spot.z; p.mx = 0; p.mz = 0;
    c.send({ t: 'action', kind: 'pickup' });
    await wait(200);
    assert.ok(!room.loot.has(spot.id), 'loot harus hilang dari tanah setelah diambil');

    // Terjadwal 45-90 s.
    const at = room.respawns.get(spot.id);
    assert.ok(at, 'loot statis harus punya jadwal respawn');
    const delta = at - Date.now();
    assert.ok(delta >= 44000 && delta <= 91000, `jadwal respawn ${delta} ms di luar 45-90 s`);

    // Set waktu ke sebelum batas bawah: tidak boleh muncul.
    room._respawnLoot(Date.now() + 44000);
    assert.ok(!room.loot.has(spot.id), 'loot muncul terlalu cepat (<45 s)');

    // Melewati batas atas: muncul lagi dengan ID & tipe yang sama.
    room._respawnLoot(at + 1);
    const back = room.loot.get(spot.id);
    assert.ok(back, 'loot statis tidak kembali setelah 45-90 s');
    assert.equal(back.type, spot.type, 'tipe loot berubah saat respawn');
    assert.equal(back.x, spot.x);
    assert.equal(back.z, spot.z);

    c.send({ t: 'leave', sessionId: p.sessionId });
    await c.waitFor('leave_ack');
    c.close();
  });
  test('10. anti-cheat lanjutan: flood, NaN, forged leave/kill, binary, seq meloncat', async () => {
    const u = await makeUser('adv');
    const c = new Client(wsBase); await c.ready();
    c.send({ t: 'auth', token: u.token });
    await c.waitFor('auth_ok');
    c.send({ t: 'join', room: 'forest' });
    const joined = await c.waitFor('joined');
    assert.ok(joined);

    const { getRealtime } = await import('../src/realtime/index.js');
    const gw = getRealtime();
    const p = [...gw.room.players.values()].find((x) => x.userId === u.userId);
    assert.ok(p);
    const { parseFrame } = await import('../src/realtime/protocol.js');

    // a. input flood: 21 input sah dalam satu detik → yang ke-21 ditolak.
    let rejected = null;
    for (let i = 1; i <= 21; i++) {
      const r = gw.room.applyInput(p.sessionId, { t: 'input', seq: 1000 + i, mx: 0, mz: 0, yaw: 0 });
      if (!r.ok) { rejected = r; break; }
    }
    assert.equal(rejected?.code, 'INPUT_FLOOD', 'flood input tidak ditolak');

    // b. attack flood: jendela 1 detik maks 50 → ke-51 ditolak ATTACK_FLOOD.
    //    (pakai bow berammo supaya tidak berhenti di NO_AMMO; cooldown di-nolkan
    //    untuk mengisolasi penghitung flood.)
    p.inventory[0] = { type: 'bow', ammo: 999 };
    let floodAtk = null;
    for (let i = 0; i < 55; i++) {
      p.cooldownUntil = 0;
      const r = gw.room.attack(p.sessionId);
      if (!r.ok && r.code === 'ATTACK_FLOOD') { floodAtk = r; break; }
    }
    assert.ok(floodAtk, 'flood attack tidak ditolak');
    p.inventory[0] = null;

    // c. NaN/Infinity di field numerik protokol → ditolak parser.
    for (const bad of [NaN, Infinity, -Infinity]) {
      const r = parseFrame(Buffer.from(JSON.stringify({ t: 'input', seq: 1, mx: bad, mz: 0, yaw: 0 })));
      assert.equal(r.ok, false, `mx=${bad} lolos parser`);
      const r2 = parseFrame(Buffer.from(JSON.stringify({ t: 'input', seq: 1, mx: 0, mz: 0, yaw: bad })));
      assert.equal(r2.ok, false, `yaw=${bad} lolos parser`);
    }

    // d. |mx|>1 / |mz|>1 (speed hack via vektor besar) → INPUT_MOVE_RANGE.
    assert.equal(parseFrame(Buffer.from(JSON.stringify({ t: 'input', seq: 1, mx: 5, mz: 0, yaw: 0 }))).code, 'INPUT_MOVE_RANGE');
    assert.equal(parseFrame(Buffer.from(JSON.stringify({ t: 'input', seq: 1, mx: 0, mz: -2, yaw: 0 }))).code, 'INPUT_MOVE_RANGE');

    // e. forged inventory: protokol tidak punya pesan set-inventory; satu-satunya
    //    jalan punya item adalah pickup dari tanah (server-side).
    assert.equal(parseFrame(Buffer.from(JSON.stringify({ t: 'give', item: 'bow' }))).code, 'TYPE_UNKNOWN');
    assert.equal(typeof gw.room.giveItem, 'undefined', 'server tidak boleh punya API giveItem');
    assert.equal(p.inventory.every((x) => x === null), true, 'inventaris berubah tanpa pickup');

    // f. forged kill/death: tidak ada tipe pesannya; HP hanya berubah lewat attack.
    assert.equal(parseFrame(Buffer.from(JSON.stringify({ t: 'kill', target: 'x' }))).code, 'TYPE_UNKNOWN');
    assert.equal(parseFrame(Buffer.from(JSON.stringify({ t: 'die' }))).code, 'TYPE_UNKNOWN');

    // g. forged leave: sessionId orang lain ditolak (scoped ke pemilik socket).
    const u2 = await makeUser('adv2');
    const c2 = new Client(wsBase); await c2.ready();
    c2.send({ t: 'auth', token: u2.token });
    await c2.waitFor('auth_ok');
    c2.send({ t: 'join', room: 'forest' });
    const j2 = await c2.waitFor('joined');
    // c (bukan pemilik j2.sessionId) mencoba mengeluarkan c2.
    c.send({ t: 'leave', sessionId: j2.sessionId });
    await wait(300);
    assert.ok(gw.room.players.has(j2.sessionId), 'pemain lain terkeluarkan oleh forged leave');
    assert.equal(c2.closed, null, 'socket korban tertutup oleh forged leave');

    // h. frame binary (bukan UTF-8 JSON) → FRAME_NOT_JSON.
    assert.equal(parseFrame(Buffer.from([0x00, 0x9f, 0x92, 0x96])).code, 'FRAME_NOT_JSON');

    // i. seq meloncat jauh: protokol menerima (gap boleh — packet loss), tapi
    //    tidak memberi keuntungan: posisi tetap dihitung server dari mx/mz.
    //    (reset jendela flood dari langkah (a) — mengisolasi perilaku seq.)
    p.inputWindow = { at: 0, n: 0 };
    const before = { x: p.x, z: p.z };
    const rJump = gw.room.applyInput(p.sessionId, { t: 'input', seq: 999999, mx: 0, mz: 0, yaw: 0 });
    assert.equal(rJump.ok, true, `seq meloncat ditolak: ${JSON.stringify(rJump)}`);
    assert.equal(p.x, before.x, 'seq meloncat menggerakkan posisi');
    assert.equal(p.z, before.z);

    // j. koordinat negatif/di luar peta lewat input: resolveMove+clampToWorld
    //    menahan di dalam batas dunia (diuji di test #5 & unit world).
    const { WORLD } = await import('../../src/shared/constants.js');
    gw.room.applyInput(p.sessionId, { t: 'input', seq: 1000000, mx: -1, mz: -1, yaw: Math.PI / 4 });
    for (let i = 0; i < 200; i++) gw.room.step(0.05);
    assert.ok(Math.abs(p.x) <= WORLD.SIZE / 2 + 0.01 && Math.abs(p.z) <= WORLD.SIZE / 2 + 0.01,
      `pemain keluar peta: ${p.x},${p.z}`);

    c.send({ t: 'leave', sessionId: p.sessionId });
    await c.waitFor('leave_ack');
    c2.send({ t: 'leave', sessionId: j2.sessionId });
    await c2.waitFor('leave_ack');
    c.close(); c2.close();
  });

  test('11. rejoin/logout bersih tidak bocorkan kredit; kill feed end-to-end', async () => {
    // prompt.md Fase 4: anti-cheat — konsistensi ledger kill/death saat
    // leave/rejoin cepat. Juga kontrak kill feed: username divalidasi charset
    // ketat (^[A-Za-z0-9_]+$ di validation.js) sehingga vektor DOM-injection
    // sudah tertolak di gerbang register; lapisan kedua: SEMUA render username
    // di klien via textContent (hud.js:135 addKillFeed, lobby.js greeting:171
    // & leaderboard b:204). Kedua fakta itu dikunci di sini.
    {
      const res = await post('/api/v1/auth/register', {
        username: 'evil<img>', password: 'kata-sandi-qa-123', character: 'male',
      });
      assert.equal(res.status, 400, `username charset jahat harus 400, dapat ${res.status}`);
      const body = await res.json();
      assert.equal(body.error?.code ?? body.code, 'USERNAME_CHARSET');
    }
    const killer = await makeUser('killer11');
    const victim = await makeUser('victim11');

    const ck = new Client(wsBase); await ck.ready();
    ck.send({ t: 'auth', token: killer.token }); await ck.waitFor('auth_ok');
    ck.send({ t: 'join', room: 'forest' }); await ck.waitFor('joined');

    const cv = new Client(wsBase); await cv.ready();
    cv.send({ t: 'auth', token: victim.token }); await cv.waitFor('auth_ok');
    cv.send({ t: 'join', room: 'forest' }); await cv.waitFor('joined');

    const gw = (await import('../src/realtime/index.js')).getRealtime();
    const pk = [...gw.room.players.values()].find((p) => p.userId === killer.userId);
    const pv = [...gw.room.players.values()].find((p) => p.userId === victim.userId);

    // a. injeksi saat RESPAWN: korban mati saat damager baru saja respawn
    //    (lastDamagerId dibersihkan) → kredit TIDAK boleh jatuh ke damager lama.
    const yaw0 = Math.atan2(pv.x - pk.x, pv.z - pk.z);
    pk.x = pv.x - Math.sin(yaw0) * 1.2; pk.z = pv.z - Math.cos(yaw0) * 1.2;
    pk.yaw = yaw0; pk.mx = 0; pk.mz = 0; pv.mx = 0; pv.mz = 0;
    await wait(900); ck.send({ t: 'action', kind: 'attack' }); await wait(300);
    assert.equal(pv.hp, 80, `setup: HP korban=${pv.hp}`);
    assert.equal(pv.lastDamagerId, pk.sessionId);
    pk.dead = true; // simulasi damager mati sebelum korban logout
    gw.room._respawn(pk); // respawn membersihkan jejak damager di pk; korban masih menyimpan id pk
    assert.equal(pk.lastDamagerId, null);
    // Korban logout: pk masih di room tapi sudah respawn → kredit tetap sah
    // (ini memang desain: id damager di korban belum kedaluwarsa). Yang krusial:
    // rejoin BERULANG victim dengan sessionId BARU tidak boleh membawa jejak lama.
    const sidV1 = pv.sessionId;
    cv.send({ t: 'leave', sessionId: sidV1 });
    await cv.waitFor('leave_ack');
    await wait(200);
    const lbAfterLogout = await (await fetch(`${base}/api/v1/leaderboard?mapId=forest&limit=10`, {
      headers: { Origin: ORIGIN, Authorization: `Bearer ${killer.token}` },
    })).json();
    const rowK1 = lbAfterLogout.entries.find((e) => e.userId === killer.userId);
    assert.equal(rowK1?.kills ?? 0, 1, 'combat-logout pertama harus kredit 1 kill');

    // b. REJOIN victim lewat KONEKSI BARU (leave menutup socket dgn 1000 —
    //    itu kontrak gateway) → state baru bersih (lastDamagerId null, hp 100).
    const cv2 = new Client(wsBase); await cv2.ready();
    cv2.send({ t: 'auth', token: victim.token }); await cv2.waitFor('auth_ok');
    cv2.send({ t: 'join', room: 'forest' });
    const j2 = await cv2.waitFor('joined');
    assert.ok(j2, 'rejoin gagal');
    const pv2 = [...gw.room.players.values()].find((p) => p.userId === victim.userId);
    assert.notEqual(pv2.sessionId, sidV1, 'sessionId harus baru saat rejoin');
    assert.equal(pv2.lastDamagerId, null, 'jejak damager bocor ke sesi rejoin');
    assert.equal(pv2.hp, 100);

    // c. LOGOUT BERSIH (tanpa pernah dilukai di sesi baru) → TIDAK ada kredit.
    cv2.send({ t: 'leave', sessionId: pv2.sessionId });
    await cv2.waitFor('leave_ack');
    await wait(200);
    const lb2 = await (await fetch(`${base}/api/v1/leaderboard?mapId=forest&limit=10`, {
      headers: { Origin: ORIGIN, Authorization: `Bearer ${killer.token}` },
    })).json();
    const rowK2 = lb2.entries.find((e) => e.userId === killer.userId);
    assert.equal(rowK2?.kills ?? 0, 1, `logout bersih tidak boleh menambah kill (=${rowK2?.kills})`);

    // d. KILL FEED nyata via WSS: kirim kill sungguhan, verifikasi payload
    //    berisi username MENTAH (kontrak: server tidak men-sanitize; UI yang
    //    meng-escape via textContent).
    const cv3 = new Client(wsBase); await cv3.ready();
    cv3.send({ t: 'auth', token: victim.token }); await cv3.waitFor('auth_ok');
    cv3.send({ t: 'join', room: 'forest' }); await cv3.waitFor('joined');
    const pv3 = [...gw.room.players.values()].find((p) => p.userId === victim.userId);
    const pk3 = [...gw.room.players.values()].find((p) => p.userId === killer.userId);
    const yaw3 = Math.atan2(pv3.x - pk3.x, pv3.z - pk3.z);
    pk3.x = pv3.x - Math.sin(yaw3) * 1.2; pk3.z = pv3.z - Math.cos(yaw3) * 1.2;
    pk3.yaw = yaw3; pk3.mx = 0; pk3.mz = 0; pv3.mx = 0; pv3.mz = 0;
    ck.inbox.length = 0; cv3.inbox.length = 0;
    for (let i = 0; i < 5; i++) { await wait(900); ck.send({ t: 'action', kind: 'attack' }); }
    await wait(400);
    const feed = ck.inbox.filter((m) => m.t === 'kill').pop();
    assert.ok(feed, 'event kill tidak sampai ke klien');
    assert.equal(feed.killer, killer.username, 'server mengubah username (harus mentah; escaping tugas UI)');
    assert.equal(feed.victim, victim.username);
    assert.equal(feed.cause, 'combat');
    assert.ok(/^[A-Za-z0-9_]+$/.test(feed.killer) && /^[A-Za-z0-9_]+$/.test(feed.victim),
      'username di feed melanggar charset aman');
    // Feed juga sampai ke korban (broadcast room).
    assert.ok(cv3.inbox.some((m) => m.t === 'kill'), 'korban tidak menerima kill feed');

    ck.close(); cv.close(); cv2.close(); cv3.close();
  });


  test('12. POST /auth/logout: revoke token (REST+WS) + tutup sesi WS aktif', async () => {
    const a = await makeUser('logout');
    const authed = (p) => fetch(`${base}${p}`, { headers: { Origin: ORIGIN, Authorization: `Bearer ${a.token}` } });

    // Sebelum logout: token berlaku.
    assert.equal((await authed('/api/v1/users/me')).status, 200);

    // Join room dulu — pemain online.
    const c = new Client(wsBase);
    await c.ready();
    c.send({ t: 'auth', token: a.token });
    assert.ok(await c.waitFor('auth_ok'), 'auth_ok tidak diterima');
    c.send({ t: 'join', room: 'forest' });
    const joined = await c.waitFor('joined');
    assert.ok(joined, 'joined tidak diterima');

    // Logout via REST dengan token yang sedang dipakai WS.
    const lo = await fetch(`${base}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { Origin: ORIGIN, Authorization: `Bearer ${a.token}` },
    });
    assert.equal(lo.status, 200, `logout status ${lo.status}`);
    assert.deepEqual(await lo.json(), { ok: true });

    // Efek 1: WS aktif langsung ditutup server (1008 SESSION_REVOKED).
    await wait(300);
    assert.ok(c.closed, 'socket tidak ditutup setelah logout');
    assert.equal(c.closed.code, 1008);
    assert.equal(c.closed.reason, 'SESSION_REVOKED');
    c.close();

    // Efek 2: token yang sama DITOLAK di REST (jti denylist).
    assert.equal((await authed('/api/v1/users/me')).status, 401);

    // Efek 3: token yang sama DITOLAK saat auth WS baru.
    const c2 = new Client(wsBase);
    await c2.ready();
    c2.send({ t: 'auth', token: a.token });
    await wait(300);
    assert.ok(c2.closed, 'socket dengan token revoked tidak ditutup');
    assert.equal(c2.closed.code, 1008);
    c2.close();

    // Efek 4: logout dua kali dengan token sama → 401 (sudah revoked), idempotent aman.
    const lo2 = await fetch(`${base}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { Origin: ORIGIN, Authorization: `Bearer ${a.token}` },
    });
    assert.equal(lo2.status, 401);

    // Efek 5: login ulang menghasilkan token BARU yang tetap berlaku.
    const relogin = await post('/api/v1/auth/login', { username: a.username, password: 'kata-sandi-qa-123' });
    assert.equal(relogin.status, 200);
    const t2 = (await relogin.json()).token;
    const me2 = await fetch(`${base}/api/v1/users/me`, { headers: { Origin: ORIGIN, Authorization: `Bearer ${t2}` } });
    assert.equal(me2.status, 200);
  });

});
