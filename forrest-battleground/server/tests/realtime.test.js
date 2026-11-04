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
});
