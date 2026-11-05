// prod-smoke.mjs — scripted smoke PRODUKSI (checklist Fase 4 [QA]).
// Menyerang https://api-be.bssn.biz.id nyata: guard Origin, register (1x/akun
// persisten, hormat kuota 5/15m), login, endpoint terproteksi, WS auth+join+leave.
// Aman: hardCap 8 tidak dilanggar (maks 1 session WS), akun QA dipakai ulang,
// logout di akhir. Output PASS/FAIL per langkah = bukti nyata produksi.
import { WebSocket } from 'ws';

const BASE = process.env.PROD_URL || 'https://api-be.bssn.biz.id';
const ORIGIN = 'https://akbarwiran.github.io';
const USER = process.env.QA_PROD_USER || 'prod_smoke_qa';
const PASS = process.env.QA_PROD_PASS || 'kata-sandi-qa-123';

const R = {};
let failures = 0;
const step = (name, ok, detail = '') => {
  R[name] = ok ? `PASS ${detail}` : `FAIL ${detail}`;
  if (!ok) failures++;
};

const api = async (path, { method = 'GET', body, token, origin = ORIGIN } = {}) => {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (origin) headers.Origin = origin;
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data = null; try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 120) }; }
  return { status: res.status, data };
};

const wsUrl = `${BASE.replace(/^http/, 'ws')}/ws`;
const wsConnect = (token, origin = ORIGIN) => new Promise((resolve) => {
  const ws = new WebSocket(wsUrl, { headers: { Origin: origin } });
  const msgs = [];
  const t = setTimeout(() => { try { ws.close(); } catch {} resolve({ ws, msgs, timeout: true }); }, 6000);
  ws.on('message', (d) => {
    const m = JSON.parse(d.toString());
    msgs.push(m);
    if (m.t === 'auth_ok' || m.t === 'joined' || m.t === 'error') {
      clearTimeout(t); resolve({ ws, msgs });
    }
  });
  ws.on('close', (code, reason) => { clearTimeout(t); resolve({ ws, msgs, closeCode: code, closeReason: reason?.toString() }); });
  ws.on('error', () => {});
  if (token) ws.on('open', () => ws.send(JSON.stringify({ t: 'auth', token })));
});

// 1. Guard Origin: tanpa Origin harus 403 (filter browser produksi).
let r = await api('/api/v1/leaderboard', { origin: null });
step('origin_deny_no_origin', r.status === 403, `status=${r.status}`);
r = await api('/api/v1/leaderboard', { origin: 'https://evil.example.com' });
step('origin_deny_evil', r.status === 403, `status=${r.status}`);

// 2. Origin sah tanpa token → 401 (bukan 403/404/500).
r = await api('/api/v1/leaderboard');
step('protected_requires_jwt', r.status === 401, `status=${r.status}`);

// 3. Register akun QA persisten (201 pertama kali; 409/429 = sudah ada, lanjut login).
r = await api('/api/v1/auth/register', { method: 'POST', body: { username: USER, password: PASS, character: 'male' } });
step('register_idempotent', r.status === 201 || r.status === 409, `status=${r.status}`);

// 4. Login → JWT.
r = await api('/api/v1/auth/login', { method: 'POST', body: { username: USER, password: PASS } });
const token = r.data?.token || r.data?.accessToken;
step('login_jwt', r.status === 200 && typeof token === 'string' && token.length > 20, `status=${r.status} expiresAt=${r.data?.expiresAt ?? '?'}`);

if (token) {
  // 5. Endpoint terproteksi dengan JWT: users/me, leaderboard, maps status.
  r = await api('/api/v1/users/me', { token });
  step('users_me', r.status === 200 && r.data?.user?.username === USER, `status=${r.status} user=${r.data?.user?.username}`);
  r = await api('/api/v1/leaderboard', { token });
  step('leaderboard_top10', r.status === 200, `status=${r.status}`);
  r = await api('/api/v1/leaderboard/me', { token });
  step('leaderboard_me', r.status === 200, `status=${r.status}`);
  r = await api('/api/v1/maps/forest/status', { token });
  step('forest_status_online_count', r.status === 200 && typeof r.data?.status?.onlineCount === 'number' && r.data?.status?.hardCap === 8, `status=${r.status} online=${r.data?.status?.onlineCount} hardCap=${r.data?.status?.hardCap}`);

  // 6. WS: Origin jahat → ditolak; tanpa auth → close AUTH_TIMEOUT/kebijakan;
  //    auth valid → auth_ok → join → joined+snapshot → leave → logout.
  let w = await wsConnect(null, 'https://evil.example.com');
  step('ws_origin_deny', !!w.closeCode && !w.msgs.some((m) => m.t === 'auth_ok'), `close=${w.closeCode} ${w.closeReason || ''}`);
  w = await wsConnect(token);
  const authOk = w.msgs.some((m) => m.t === 'auth_ok');
  step('ws_auth_ok', authOk, `msgs=${w.msgs.map((m) => m.t).join(',')}`);
  if (authOk && !w.closeCode) {
    const joined = await new Promise((resolve) => {
      const t = setTimeout(() => resolve(null), 5000);
      const h = (d) => { const m = JSON.parse(d.toString()); if (m.t === 'joined') { clearTimeout(t); w.ws.off('message', h); resolve(m); } };
      w.ws.on('message', h);
      w.ws.send(JSON.stringify({ t: 'join', room: 'forest' }));
    });
    step('ws_join_joined', !!joined && joined.hardCap === 8, joined ? `hardCap=${joined.hardCap} tick=${joined.tickHz}Hz` : 'timeout');
    w.ws.send(JSON.stringify({ t: 'leave' }));
    await new Promise((r2) => setTimeout(r2, 300));
  }
  try { w.ws?.close(); } catch {}

  // 7. Token bohongan → 401.
  r = await api('/api/v1/users/me', { token: 'aaa.bbb.ccc' });
  step('forged_token_401', r.status === 401, `status=${r.status}`);

  // 8. Logout (revokasi jti) → token lama harus 401.
  r = await api('/api/v1/auth/logout', { method: 'POST', token });
  const logoutOk = (r.status === 200 || r.status === 204) && r.data?.ok === true;
  const after = await api('/api/v1/users/me', { token });
  step('logout_revokes', logoutOk && after.status === 401, `logout=${r.status}(ok=${r.data?.ok}) token-after=${after.status}`);
}

console.log(JSON.stringify({ base: BASE, user: USER, results: R, summary: `${Object.keys(R).length - failures}/${Object.keys(R).length} PASS` }, null, 2));
process.exit(failures ? 1 : 0);
