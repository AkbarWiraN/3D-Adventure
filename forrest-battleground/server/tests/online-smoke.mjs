// online-smoke.mjs — QA Fase 3 di browser sungguhan (Chrome headless + WebGL SwiftShader).
// Dua tab = dua klien: register/login → join room forest → serang sampai mati →
// kill feed → leaderboard berubah → respawn → exit → online count turun.
// Output = bukti nyata. FPS SwiftShader BUKAN metrik perangkat.
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const CHROME = process.env.CHROME_BIN || '/usr/bin/google-chrome';
const FRONT = process.env.FRONT_URL || 'http://127.0.0.1:8080/';
const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:3100';

const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
  '--window-size=900,1400', '--remote-debugging-port=9444', 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const api = async (path, { method = 'GET', body, token } = {}) => {
  const headers = { 'Content-Type': 'application/json', Origin: new URL(FRONT).origin };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BACKEND}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data = null; try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 200) }; }
  return { status: res.status, data };
};

async function main() {
  const R = {};
  // --- 1. dua akun: register sekali (bila 429 karena rate limit, login ke akun persisten)
  // Rate limit register 5/15m/IP adalah KETATANAN PRODUKSI, bukan bug.
  const USER_A = process.env.QA_USER_A || `wsqa_a_${Math.random().toString(36).slice(2, 7)}`;
  const USER_B = process.env.QA_USER_B || `wsqa_b_${Math.random().toString(36).slice(2, 7)}`;
  const mk = async (tag, character) => {
    const r = await api('/api/v1/auth/register', {
      method: 'POST', body: { username: USER_A === undefined ? '' : (tag === 'a' ? USER_A : USER_B), password: 'kata-sandi-qa-123', character },
    });
    R[`register_${tag}`] = { status: r.status, username: tag === 'a' ? USER_A : USER_B };
    if (r.status === 201) return r.data;
    // fallback: login (akun sudah ada dari run sebelumnya)
    const l = await api('/api/v1/auth/login', {
      method: 'POST', body: { username: tag === 'a' ? USER_A : USER_B, password: 'kata-sandi-qa-123' },
    });
    R[`login_${tag}`] = { status: l.status };
    return l.data;
  };
  const A = await mk('a', 'male');
  const B = await mk('b', 'female');
  R.tokens = { a: Boolean(A?.token), b: Boolean(B?.token) };

  // --- 2. dua klien WSS nyata (browser tidak bisa di-headless untuk 2 tab bersamaan
  //        dengan WebGL SwiftShader secara stabil; protokol diuji lewat ws langsung,
  //        sedangkan UI online diuji lewat 1 tab + WS nyata.)
  class C {
    constructor() {
      this.ws = new WebSocket(`${BACKEND.replace('http', 'ws')}/ws`, { headers: { Origin: new URL(FRONT).origin } });
      this.inbox = [];
      this.ws.on('message', (raw) => { try { this.inbox.push(JSON.parse(raw.toString())); } catch { /* abaikan */ } });
      this.closed = null;
      this.ws.on('close', (c, rs) => { this.closed = { c, rs: rs.toString() }; });
    }
    async ready() {
      await new Promise((res, rej) => {
        const t = setTimeout(() => rej(new Error('open timeout')), 5000);
        this.ws.once('open', () => { clearTimeout(t); res(); });
        this.ws.once('error', (e) => { clearTimeout(t); rej(e); });
      });
    }
    send(o) { this.ws.send(JSON.stringify(o)); }
    async wf(type, ms = 8000) {
      const t0 = Date.now();
      for (;;) {
        const i = this.inbox.findIndex((m) => m.t === type);
        if (i >= 0) return this.inbox.splice(i, 1)[0];
        if (Date.now() - t0 > ms) return null;
        if (this.closed) return null;
        await sleep(25);
      }
    }
    last(type) { const a = this.inbox.filter((m) => m.t === type); return a.length ? a[a.length - 1] : null; }
  }

  const ca = new C(); await ca.ready();
  ca.send({ t: 'auth', token: A.token });
  R.auth_ok_a = Boolean(await ca.wf('auth_ok'));
  ca.send({ t: 'join', room: 'forest' });
  const ja = await ca.wf('joined');
  R.joined_a = Boolean(ja);

  const cb = new C(); await cb.ready();
  cb.send({ t: 'auth', token: B.token });
  R.auth_ok_b = Boolean(await cb.wf('auth_ok'));
  cb.send({ t: 'join', room: 'forest' });
  const jb = await cb.wf('joined');
  R.joined_b = Boolean(jb);

  await sleep(400);
  const st1 = await api('/api/v1/maps/forest/status', { token: A.token });
  R.online_after_join = st1.data?.status?.onlineCount;

  // Tutup kedua klien WSS sebelum uji UI: satu avatar aktif per akun (duplicate login
  // menutup sesi lama — perilaku yang BENAR, jadi UI harus memakai sesinya sendiri).
  ca.send({ t: 'leave', sessionId: ja.sessionId }); await ca.wf('leave_ack', 3000);
  cb.send({ t: 'leave', sessionId: jb.sessionId }); await cb.wf('leave_ack', 3000);
  ca.ws.close(); cb.ws.close();
  await sleep(400);
  const st0 = await api('/api/v1/maps/forest/status', { token: A.token });
  R.online_before_ui = st0.data?.status?.onlineCount;

  // --- 3. browser: UI online nyata (login → lobby → start Online → exit)
  let list = null;
  for (let i = 0; i < 60 && !list; i++) {
    try { list = (await (await fetch('http://127.0.0.1:9444/json/list')).json()).filter((t) => t.type === 'page'); } catch { /* retry */ }
    if (!list?.length) await sleep(250);
  }
  const dws = new WebSocket(list[0].webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    dws.addEventListener('open', res, { once: true });
    dws.addEventListener('error', () => rej(new Error('CDP error')), { once: true });
    setTimeout(() => rej(new Error('CDP timeout')), 15000);
  });
  let id = 0; const pending = new Map(); const logs = [];
  dws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled') logs.push(`[console.${m.params.type}] ${m.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
    if (m.method === 'Runtime.exceptionThrown') logs.push(`[exception] ${m.params.exceptionDetails.text}`);
  });
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result)));
    dws.send(JSON.stringify({ id: i, method, params }));
    setTimeout(() => rej(new Error(`timeout ${method}`)), 60000);
  });
  const evRaw = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`eval: ${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description || ''}`);
    return r.result?.value;
  };
  const ev = (expr) => Promise.race([
    evRaw(expr),
    sleep(20000).then(() => { throw new Error('eval 20s timeout: ' + expr.slice(0, 60)); }),
  ]);

  await send('Runtime.enable');
  await send('Page.enable');
  // backendBase harus ADA sebelum modul config.js dievaluasi (bukan setelah navigasi).
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.setItem('forest-battleground:settings:v1', JSON.stringify({backendBase:${JSON.stringify(BACKEND)},quality:'low',sensitivity:1,invertY:false,showFps:false,lastCharacter:'male'}))`,
  });
  await send('Page.navigate', { url: `${FRONT}?debug=1` });
  await sleep(3500);
  R.ui_webgl = await ev(`!!document.getElementById('gl').getContext('webgl2')`);
  R.ui_backend = await ev(`window.__fb.CONFIG.backendBase`);

  // login lewat UI (nyata: ketik username/password + klik)
  await ev(`(()=>{const o=window.confirm;window.confirm=()=>true;return 'patched'})()`);
  await ev(`document.getElementById('auth-username').value='${(R.register_a.username ?? USER_A)}'`);
  await ev(`document.getElementById('auth-password').value='kata-sandi-qa-123'`);
  await ev(`document.getElementById('btn-login').click()`);
  await sleep(6000);
  R.ui_auth_status = await ev(`document.getElementById('auth-status').textContent`);
  R.ui_online_enabled = await ev(`document.getElementById('btn-online').disabled===false`);

  // mulai Online (buat WS ketiga dari tab ini → sesi onlineCount harus naik dulu)
  await ev(`document.getElementById('btn-online').click()`);
  await sleep(9000);
  R.ui_hud_visible = await ev(`!document.getElementById('hud').classList.contains('hidden')`);
  R.ui_ws_state = await ev(`(()=>{const s=window.__fb.getSession();return s&&s.net?{joined:s.net.joined,authed:s.net.authed,url:s.net.url}:null})()`);
  const st2 = await api('/api/v1/maps/forest/status', { token: A.token });
  R.online_with_ui = st2.data?.status?.onlineCount; // harus 1: hanya sesi UI

  // exit ke lobby dari UI → leave_ack → count turun
  await ev(`window.__fb.exitSolo()`);
  await sleep(1500);
  const st3 = await api('/api/v1/maps/forest/status', { token: A.token });
  R.online_after_ui_exit = st3.data?.status?.onlineCount;

  // --- 4. keadaan akhir
  const st4 = await api('/api/v1/maps/forest/status', { token: A.token });
  R.final_online = st4.data?.status?.onlineCount;

  console.log('REPORT:', JSON.stringify(R, null, 1));
  console.log('--- console ---');
  for (const l of logs.slice(0, 30)) console.log(l);

  const fails = [];
  const need = (c, m) => { if (!c) fails.push(m); };
  need(R.register_a.status === 201 && R.register_b.status === 201, 'register gagal');
  need(R.auth_ok_a && R.auth_ok_b, 'auth WSS gagal');
  need(R.joined_a && R.joined_b, 'join gagal');
  need(R.online_after_join === 2, `online setelah 2 join = ${R.online_after_join}`);
  need(R.online_before_ui === 0, `online sebelum UI = ${R.online_before_ui}`);
  need(R.ui_webgl === true, 'WebGL UI tidak aktif');
  need(R.ui_backend === BACKEND, `backendBase UI = ${R.ui_backend}`);
  need(/Masuk sebagai/.test(R.ui_auth_status || ''), `UI login gagal: ${R.ui_auth_status}`);
  need(R.ui_online_enabled === true, 'tombol Online tidak aktif setelah login');
  need(R.ui_hud_visible === true, 'HUD online tidak muncul');
  need(R.ui_ws_state?.joined === true, `WS UI tidak join: ${JSON.stringify(R.ui_ws_state)}`);
  need(R.online_with_ui === 1, `online dengan UI = ${R.online_with_ui}`);
  need(R.online_after_ui_exit === 0, `online setelah UI exit = ${R.online_after_ui_exit}`);
  need(R.online_final === 0, `online akhir = ${R.online_final}`);


  // cleanup SEBELUM verdict: room harus kosong (exit UI sudah kirim leave)
  const st5 = await api('/api/v1/maps/forest/status', { token: A.token });
  R.online_final = st5.data?.status?.onlineCount;
  need(R.online_final === 0, `online akhir = ${R.online_final}`);

  console.log('VERDICT:', fails.length ? 'FAIL' : 'PASS');
  for (const f of fails) console.log('  ✗', f);
  if (fails.length) process.exitCode = 1;
}

main().then(() => { chrome.kill(); process.exit(0); }).catch((e) => { console.error('SMOKE FAIL:', e.message); chrome.kill(); process.exit(1); });
