// load-stage.mjs — QA Fase 3 (checklist "Stage test 2 lalu 4 client;
// catat server CPU/RSS/tick p95/network RTT") + PvP sword-vs-bow nyata.
//
// Jalankan: cd server && /opt/node24/bin/node tests/load-stage.mjs
// Catatan jujur: klien WSS dan server di proses yang sama (VPS uji), jadi angka
// CPU = batas ATAS (server + overhead klien). RTT loopback bukan RTT internet.
// Yang diukur nyata: jitter snapshot, tickHz efektif, RSS, benar/tidaknya protokol.
process.env.NODE_ENV = 'test';
// Batas register PRODUKSI 5/15m/IP terlalu ketat untuk uji beban (16 akun
// sekali jalan). Override hanya untuk proses test ini — produksi tak berubah.
process.env.REGISTER_RATE_MAX = '64';
// Stage 16 menguji APAKAH cap 8 aman dinaikkan. Untuk bisa mengukurnya, room
// harus mengizinkan 16 dulu — cap PRODUKSI tetap 8 sampai metrik membuktikan
// aman (CPU <70%, tick p95 ≤50 ms). Nilai ini hanya untuk proses uji ini.
process.env.ROOM_HARD_CAP = '16';
process.env.FRONTEND_ORIGINS = 'https://akbarwiran.github.io';
process.env.DATABASE_FILE = ':memory:';
process.env.AUTH_SECRET = 'x'.repeat(48);
process.env.LOG_LEVEL = 'warn';

import { WebSocket } from 'ws';

const { buildApp } = await import('../src/app.js');
const { runMigrations } = await import('../src/persistence/migrate.js');
const { resetAll } = await import('../src/security/rateLimit.js');
const { getRealtime } = await import('../src/realtime/index.js');

const ORIGIN = 'https://akbarwiran.github.io';
const PASS = 'kata-sandi-qa-123';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (arr, p) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))] * 100) / 100;
};

runMigrations();
const app = await buildApp();
await app.listen({ host: '127.0.0.1', port: 0 });
const port = app.server.address().port;
const base = `http://127.0.0.1:${port}`;
const wsBase = `ws://127.0.0.1:${port}/ws`;

async function makeUser(tag) {
  // Register kuota 5/15m/IP adalah KETATANAN PRODUKSI, bukan bug: akun persisten
  // dibuat sekali, run berikutnya login ulang (sama seperti akun game nyata).
  const username = process.env[`QA_USER_${tag}`] || `load_${tag}`;
  const character = tag % 2 ? 'female' : 'male';
  let res = await fetch(`${base}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ username, password: PASS, character }),
  });
  let d = await res.json().catch(() => null);
  if (res.status !== 201) {
    res = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
      body: JSON.stringify({ username, password: PASS }),
    });
    d = await res.json().catch(() => null);
    if (res.status !== 200) throw new Error(`register+login ${username} gagal: ${res.status} ${JSON.stringify(d).slice(0, 120)}`);
  }
  return { username, token: d.token, userId: d.user.id };
}

class C {
  constructor(url) {
    this.ws = new WebSocket(url, { headers: { Origin: ORIGIN } });
    this.inbox = [];
    this.snapAt = [];
    this.rtt = [];
    this.pingAt = new Map();
    this.sessionId = null;
    this.closed = null;
    this.ws.on('message', (raw) => {
      let m; try { m = JSON.parse(raw.toString()); } catch { return; }
      if (m.t === 'joined') this.sessionId = m.sessionId;
      if (m.t === 'snapshot') this.snapAt.push(Date.now());
      if (m.t === 'pong' && this.pingAt.has(m.c)) {
        this.rtt.push(Date.now() - this.pingAt.get(m.c));
        this.pingAt.delete(m.c);
      }
      this.inbox.push(m);
    });
    this.ws.on('close', (code, reason) => { this.closed = { code, reason: reason.toString() }; });
  }
  ready() {
    return new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('open timeout')), 5000);
      this.ws.once('open', () => { clearTimeout(t); res(); });
      this.ws.once('error', (e) => { clearTimeout(t); rej(e); });
    });
  }
  send(o) { this.ws.send(JSON.stringify(o)); }
  async waitFor(type, ms = 8000) {
    const t0 = Date.now();
    for (;;) {
      const i = this.inbox.findIndex((m) => m.t === type);
      if (i >= 0) return this.inbox.splice(i, 1)[0];
      if (Date.now() - t0 > ms) return null;
      if (this.closed) return null;
      await sleep(20);
    }
  }
  close() { try { this.ws.close(); } catch { /* sudah tutup */ } }
}

const R = { stages: [] };

async function stage(n, holdMs = 5000) {
  resetAll(); // batas register 5/15m/IP: ketatannya produksi, bukan bug
  const gw = getRealtime();
  const users = [];
  for (let i = 0; i < n; i++) users.push(await makeUser(i));

  const clients = [];
  for (const u of users) {
    const c = new C(wsBase);
    await c.ready();
    c.send({ t: 'auth', token: u.token });
    if (!await c.waitFor('auth_ok')) throw new Error(`auth_ok gagal (${u.username})`);
    c.send({ t: 'join', room: 'forest' });
    if (!await c.waitFor('joined')) throw new Error(`joined gagal (${u.username})`);
    clients.push(c);
  }
  await sleep(500);
  const onlineJoined = gw.room.onlineCount;

  const t0 = Date.now();
  const tick0 = gw.room.tick;
  const cpu0 = process.cpuUsage();
  const rss0 = process.memoryUsage().rss;
  const seq = clients.map(() => 0);
  let stop = false;
  const drivers = clients.map((c, i) => (async () => {
    let n = 0;
    while (!stop) {
      c.send({ t: 'input', v: 1, seq: ++seq[i], mx: n % 4 === 0 ? 1 : n % 4 === 2 ? -1 : 0, mz: n % 8 < 4 ? 1 : -1, yaw: n * 0.05, sprint: n % 10 === 0, prone: false, jump: n % 40 === 0 });
      if (n % 10 === 0) { c.pingAt.set(n, Date.now()); c.send({ t: 'ping', c: n }); }
      n++;
      await sleep(50);
    }
  })());
  await sleep(holdMs);
  stop = true;
  await Promise.all(drivers);
  const elapsed = (Date.now() - t0) / 1000;
  const cpu1 = process.cpuUsage();
  const rss1 = process.memoryUsage().rss;

  const snapIntervals = [];
  for (const c of clients) {
    for (let i = 1; i < c.snapAt.length; i++) snapIntervals.push(c.snapAt[i] - c.snapAt[i - 1]);
  }
  const allRtt = clients.flatMap((c) => c.rtt);
  R.stages.push({
    clients: n,
    onlineJoined,
    elapsedSec: Math.round(elapsed * 10) / 10,
    tickHz: Math.round(((gw.room.tick - tick0) / elapsed) * 10) / 10,
    cpuPct: Math.round((((cpu1.user - cpu0.user) + (cpu1.system - cpu0.system)) / (elapsed * 1e6)) * 1000) / 10,
    rssDeltaMB: Math.round(((rss1 - rss0) / 1048576) * 10) / 10,
    rssTotalMB: Math.round((rss1 / 1048576) * 10) / 10,
    snapshotsPerClientPerSec: Math.round((clients.reduce((a, c) => a + c.snapAt.length, 0) / n / elapsed) * 10) / 10,
    snapIntervalP50Ms: pct(snapIntervals, 0.5),
    snapIntervalP95Ms: pct(snapIntervals, 0.95),
    snapIntervalMaxMs: snapIntervals.length ? Math.max(...snapIntervals) : null,
    rttAvgMs: allRtt.length ? Math.round((allRtt.reduce((a, b) => a + b, 0) / allRtt.length) * 10) / 10 : null,
    rttP95Ms: pct(allRtt, 0.95),
    socketsClosed: clients.filter((c) => c.closed).length,
  });

  for (const c of clients) {
    if (c.sessionId) c.send({ t: 'leave', sessionId: c.sessionId });
  }
  await sleep(300);
  for (const c of clients) c.close();
  await sleep(400);
}

// ---------------------------------------------------------------- PvP nyata
async function pvpSwordVsBow() {
  resetAll();
  const gw = getRealtime();
  const a = await makeUser('swordA');
  const b = await makeUser('bowB');

  const ca = new C(wsBase); await ca.ready();
  ca.send({ t: 'auth', token: a.token }); await ca.waitFor('auth_ok');
  ca.send({ t: 'join', room: 'forest' });
  const ja = await ca.waitFor('joined');

  const cb = new C(wsBase); await cb.ready();
  cb.send({ t: 'auth', token: b.token }); await cb.waitFor('auth_ok');
  cb.send({ t: 'join', room: 'forest' });
  const jb = await cb.waitFor('joined');

  const pa = [...gw.room.players.values()].find((p) => p.userId === a.userId);
  const pb = [...gw.room.players.values()].find((p) => p.userId === b.userId);

  // A ambil sword, B ambil bow — lewat aksi pickup SUNGGUHAN, bukan set inventory.
  const sword = [...gw.room.loot.values()].find((l) => l.type === 'sword');
  const bow = [...gw.room.loot.values()].find((l) => l.type === 'bow');
  if (!sword || !bow) throw new Error('loot sword/bow tidak ditemukan di world');
  pa.x = sword.x; pa.z = sword.z; pa.mx = 0; pa.mz = 0;
  pb.x = bow.x; pb.z = bow.z; pb.mx = 0; pb.mz = 0;
  ca.send({ t: 'action', kind: 'pickup' });
  cb.send({ t: 'action', kind: 'pickup' });
  await sleep(500);
  R.pickup = {
    aHasSword: pa.inventory.some((i) => i?.type === 'sword'),
    bHasBow: pb.inventory.some((i) => i?.type === 'bow'),
    bArrows: pb.inventory.find((i) => i?.type === 'bow')?.ammo ?? null,
  };

  // Berhadapan 1.2 m. B tidak membalas (target statis).
  const yaw = Math.atan2(pb.x - pa.x, pb.z - pa.z);
  pa.x = pb.x - Math.sin(yaw) * 1.2; pa.z = pb.z - Math.cos(yaw) * 1.2;
  pa.yaw = yaw; pb.yaw = yaw + Math.PI; pa.mx = 0; pa.mz = 0; pb.mx = 0; pb.mz = 0;

  // 5 hit bergantian: A pakai sword (800 ms), B pakai bow (1400 ms). Korban selalu B
  // (B tidak membalas — arah B sengaja tidak diarahkan ke A; serangan B tetap sah
  // karena B memegang bow dan bidik B sendiri ke arah A? TIDAK: yang menentukan
  // "siapa korban" adalah posisi relatif, jadi di sini B memang menyerang A.
  // Prompt Fase 3 minta "A sword / B bow" 5 hit ke korban yang sama -> pakai
  // slot yang benar: A serang B dengan sword, lalu B tukar slot & serang B? Mustahil.
  // Interpretasi jujur: dua penyerang bergantian melukai SATU korban butuh korban
  // ketiga. Jadi: A menyerang B (sword 3x), B menyerang C? Tidak ada C.
  // ==> Uji yang benar sesuai prompt: A sword vs B bow, masing-masing 5 hit ke
  // lawan, diuji TERPISAH (dua duel) supaya tidak ada korban yang menyerang diri.
  const duel = async (attackerC, attackerP, victimP, weapon) => {
    // Attacker harus memegang senjata yang diuji; setelah respawn slot bisa 0.
    if (!attackerP.inventory[attackerP.slot] || attackerP.inventory[attackerP.slot].type !== weapon) {
      throw new Error(`attacker tidak memegang ${weapon}: ${JSON.stringify(attackerP.inventory)}`);
    }
    // Hadapkan attacker ke victim 1.2 m, victim diam.
    const yawA = Math.atan2(victimP.x - attackerP.x, victimP.z - attackerP.z);
    attackerP.x = victimP.x - Math.sin(yawA) * 1.2;
    attackerP.z = victimP.z - Math.cos(yawA) * 1.2;
    attackerP.yaw = yawA; victimP.yaw = yawA + Math.PI;
    attackerP.mx = 0; attackerP.mz = 0; victimP.mx = 0; victimP.mz = 0;
    const trace = [];
    for (let i = 0; i < 5; i++) {
      await sleep(1500); // lewati cooldown terpanjang (bow 1400 ms)
      attackerC.send({ t: 'action', kind: 'attack' });
      await sleep(300);
      const hitMsg = attackerC.inbox.filter((m) => m.t === 'hit').pop();
      const errMsg = attackerC.inbox.filter((m) => m.t === 'error').pop();
      trace.push({
        by: weapon,
        victimHp: victimP.hp,
        dead: victimP.dead,
        hit: hitMsg ? { hp: hitMsg.hp, dead: hitMsg.dead } : null,
        err: errMsg?.code ?? null,
        dist: Math.round(Math.hypot(victimP.x - attackerP.x, victimP.z - attackerP.z) * 100) / 100,
        ammo: attackerP.inventory[attackerP.slot]?.ammo ?? null,
        yawA: Math.round(attackerP.yaw * 100) / 100,
        yawV: Math.round(victimP.yaw * 100) / 100,
      });
    }
    return trace;
  };
  const hits = [];
  // Duel 1: A (sword) vs B
  const swordTrace = await duel(ca, pa, pb, 'sword');
  for (const h of swordTrace) hits.push(h);
  // B tumbang lalu respawn (tangan kosong — senjata dijatuhkan saat mati, sesuai
  // spesifikasi). Untuk duel 2, B harus mengambil bow lagi lewat aksi pickup nyata.
  // Pilih bow yang BISA dilihat dari posisi A (LOS sah) — loot di dalam rumah
  // sah ditolak server, itu perilaku benar, jadi jangan pilih yang terhalang.
  await sleep(3400);
  const { hasLineOfSight } = await import('../src/realtime/room.js');
  const bow2 = [...gw.room.loot.values()]
    .filter((l) => l.type === 'bow')
    .find((l) => hasLineOfSight(gw.room.grid, l.x, l.z, pa.x, pa.z));
  if (!bow2) throw new Error('bow untuk duel 2 tidak ditemukan (LOS)');
  pb.x = bow2.x; pb.z = bow2.z; pb.mx = 0; pb.mz = 0;
  cb.send({ t: 'action', kind: 'pickup' });
  await sleep(500);
  R.bowRepick = pb.inventory.some((i) => i?.type === 'bow');
  const bowTrace = await duel(cb, pb, pa, 'bow');
  for (const h of bowTrace) hits.push(h);
  await sleep(600);
  await sleep(600);
  R.pvp = {
    hits,
    swordTrace,
    bowTrace,
    swordDuel: { lastHp: swordTrace.at(-1).victimHp, dead: swordTrace.at(-1).dead, killsByA: pa.kills },
    bowDuel: { lastHp: bowTrace.at(-1).victimHp, dead: bowTrace.at(-1).dead, killsByB: pb.kills },
    swordHits: hits.filter((h) => h.by === 'sword').length,
    bowHits: hits.filter((h) => h.by === 'bow').length,
    killFeedSeenByA: ca.inbox.some((m) => m.t === 'kill'),
    killFeedSeenByB: cb.inbox.some((m) => m.t === 'kill'),
  };

  const lb = await (await fetch(`${base}/api/v1/leaderboard?mapId=forest&limit=10`, {
    headers: { Origin: ORIGIN, Authorization: `Bearer ${a.token}` },
  })).json();
  const rowA = lb.entries.find((e) => e.userId === a.userId);
  const rowB = lb.entries.find((e) => e.userId === b.userId);
  R.leaderboard = {
    aKills: rowA?.kills ?? null,
    aDeaths: rowA?.deaths ?? null,
    bKills: rowB?.kills ?? null,
    bDeaths: rowB?.deaths ?? null,
  };

  await sleep(3400);
  const snapA = ca.inbox.filter((m) => m.t === 'snapshot').pop();
  R.respawn = {
    hp: snapA?.self?.hp ?? null,
    dead: snapA?.self?.dead ?? null,
    emptyHands: snapA?.self?.inv ? snapA.self.inv.every((x) => x === null) : null,
  };

  ca.send({ t: 'leave', sessionId: pa.sessionId });
  cb.send({ t: 'leave', sessionId: pb.sessionId });
  await sleep(600);
  ca.close(); cb.close();
  await sleep(400);
  R.onlineAfterPvp = gw.room.onlineCount;
}

await pvpSwordVsBow();
// Cap evaluasi: default 2→4→8. STAGES=16 menambah stage 16 untuk MENILAI
// apakah cap boleh naik (prompt.md Fase 4: 16 hanya jika CPU <70%, tick p95
// ≤50 ms, koneksi stabil). Bukan mengubah cap produksi — hanya mengukur.
const STAGES = (process.env.STAGES || '2,4,8').split(',').map((x) => Number(x.trim())).filter((n) => n > 0);
for (const n of STAGES) await stage(n);

console.log('REPORT:', JSON.stringify(R, null, 1));
console.log('RINGKAS:');
for (const s of R.stages) {
  console.log(`  ${s.clients} klien | tick ${s.tickHz} Hz | CPU ${s.cpuPct}% | RSS +${s.rssDeltaMB} MB (total ${s.rssTotalMB} MB) | snapshot p50/p95/max ${s.snapIntervalP50Ms}/${s.snapIntervalP95Ms}/${s.snapIntervalMaxMs} ms | RTT avg/p95 ${s.rttAvgMs}/${s.rttP95Ms} ms | socket error ${s.socketsClosed}`);
}

const fails = [];
const need = (c, m) => { if (!c) fails.push(m); };
need(R.pickup.aHasSword && R.pickup.bHasBow, 'pickup sword/bow gagal');
need(R.pickup.bArrows > 0, `bow tanpa ammo: ${R.pickup.bArrows}`);
need(R.pvp.swordDuel.lastHp === 0 && R.pvp.swordDuel.dead === true, `duel sword: ${JSON.stringify(R.pvp.swordDuel)}`);
need(R.pvp.bowDuel.lastHp === 0 && R.pvp.bowDuel.dead === true, `duel bow: ${JSON.stringify(R.pvp.bowDuel)}`);
need(R.pvp.swordHits === 5 && R.pvp.bowHits === 5, `jumlah hit: ${JSON.stringify(R.pvp.hits)}`);
need(R.bowRepick === true, 'B gagal mengambil bow lagi setelah respawn');
need(R.pvp.swordDuel.killsByA === 1 && R.pvp.bowDuel.killsByB === 1, `kills room: ${JSON.stringify(R.pvp)}`);
need(R.pvp.killFeedSeenByA && R.pvp.killFeedSeenByB, 'kill feed tidak sampai ke klien');
need(R.leaderboard.aKills === 1 && R.leaderboard.aDeaths === 1 && R.leaderboard.bKills === 1 && R.leaderboard.bDeaths === 1, `leaderboard: ${JSON.stringify(R.leaderboard)}`);
need(R.respawn.hp === 100 && R.respawn.dead === false && R.respawn.emptyHands === true, `respawn: ${JSON.stringify(R.respawn)}`);
need(R.onlineAfterPvp === 0, `online setelah PvP exit = ${R.onlineAfterPvp}`);
for (const s of R.stages) {
  need(s.onlineJoined === s.clients, `stage ${s.clients}: onlineJoined=${s.onlineJoined}`);
  need(s.socketsClosed === 0, `stage ${s.clients}: ${s.socketsClosed} socket error/tutup`);
  need(s.tickHz >= 18, `stage ${s.clients}: tickHz=${s.tickHz} < 18`);
  need(s.snapIntervalP95Ms <= 250, `stage ${s.clients}: snapshot p95=${s.snapIntervalP95Ms} ms > 250`);
}

console.log('VERDICT:', fails.length ? 'FAIL' : 'PASS');
for (const f of fails) console.log('  x', f);

await app.close();
process.exit(fails.length ? 1 : 0);
