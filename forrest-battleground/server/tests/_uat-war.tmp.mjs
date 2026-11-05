import { WebSocket } from 'ws';
const B = 'https://api-be.bssn.biz.id';
const ORIGIN = 'https://akbarwiran.github.io';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function login(u) {
  const r = await fetch(B + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN }, body: JSON.stringify({ username: u, password: 'kata-sandi-uat-123' }) });
  const d = await r.json();
  if (!d.token) throw new Error('login gagal ' + u + ': ' + JSON.stringify(d));
  return d.token;
}
async function client(tok, name, inbox) {
  const ws = new WebSocket(B.replace('https', 'wss') + '/ws', { headers: { Origin: ORIGIN } });
  ws.on('message', (raw) => inbox.push(JSON.parse(raw.toString())));
  await new Promise((res, rej) => { ws.on('open', res, { once: true }); ws.on('error', rej); });
  ws.send(JSON.stringify({ t: 'auth', token: tok }));
  const t0 = Date.now(); while (!inbox.some(m => m.t === 'auth_ok')) { if (Date.now() - t0 > 8000) throw new Error(name + ' auth timeout'); await sleep(60); }
  ws.send(JSON.stringify({ t: 'join', room: 'forest' }));
  while (!inbox.some(m => m.t === 'joined')) { if (Date.now() - t0 > 12000) throw new Error(name + ' join timeout'); await sleep(60); }
  return ws;
}
const lastSnap = (inbox) => [...inbox].reverse().find(m => m.t === 'snapshot');
const ua = 'warA_q6tt', ub = 'uatB_x8no';
const [ta, tb] = [await login(ua), await login(ub)];
const ia = [], ib = [];
const A = await client(ta, 'A', ia), Bw = await client(tb, 'B', ib);
await sleep(800);
for (let step = 0; step < 500; step++) {
  const sa = lastSnap(ia), sb = lastSnap(ib);
  if (!sa?.self || !sb?.self) { await sleep(150); continue; }
  const dx = sb.self.x - sa.self.x, dz = sb.self.z - sa.self.z;
  if (Math.hypot(dx, dz) < 2.2) break;
  A.send(JSON.stringify({ t: 'input', seq: step, yaw: Math.atan2(dx, dz), mx: 0, mz: 1, sprint: true, jump: false, prone: false }));
  await sleep(100);
}
const sa0 = lastSnap(ia), sb0 = lastSnap(ib);
console.log('jarak A-B:', Math.hypot(sb0.self.x - sa0.self.x, sb0.self.z - sa0.self.z).toFixed(2), 'm');
for (let k = 0; k < 9; k++) {
  A.send(JSON.stringify({ t: 'action', kind: 'attack' }));
  await sleep(900);
  const b = lastSnap(ib)?.self;
  if (b?.dead) break;
}
const bs = lastSnap(ib)?.self;
console.log('B hp:', bs?.hp, 'dead:', bs?.dead, 'respawnInMs:', bs?.respawnInMs);
console.log('events A:', ia.filter(m => ['hit','kill'].includes(m.t)).map(m => m.t).join(','));
const lb = await (await fetch(B + '/api/v1/leaderboard?mapId=forest&limit=10', { headers: { Authorization: 'Bearer ' + ta, Origin: ORIGIN } })).json();
console.log('leaderboard:', JSON.stringify(lb.entries));
const meA = await (await fetch(B + '/api/v1/leaderboard/me?mapId=forest', { headers: { Authorization: 'Bearer ' + ta, Origin: ORIGIN } })).json();
console.log('stat A:', JSON.stringify(meA));
await sleep(3600);
Bw.send(JSON.stringify({ t: 'input', seq: 999, yaw: 0, mx: 0, mz: 0, sprint: false, jump: false, prone: false }));
await sleep(700);
const bs2 = lastSnap(ib)?.self;
console.log('B setelah respawn hp:', bs2?.hp, 'dead:', bs2?.dead);
A.send(JSON.stringify({ t: 'leave' })); Bw.send(JSON.stringify({ t: 'leave' }));
await sleep(800);
console.log('leave_ack A/B:', ia.some(m => m.t === 'leave_ack'), ib.some(m => m.t === 'leave_ack'));
const st = await (await fetch(B + '/api/v1/maps/forest/status', { headers: { Authorization: 'Bearer ' + ta, Origin: ORIGIN } })).json();
console.log('status akhir:', JSON.stringify(st));
A.close(); Bw.close();
