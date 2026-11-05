// leak-20x-check.mjs — checklist Fase 2: "exit/re-enter 20x leak check".
// Bukti nyata: listener bus, sesi null, resource GPU saat sesi HIDUP (setelah build
// chunk stabil), dan heap JS sesudah exit.
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const CHROME = process.env.CHROME_BIN || '/usr/bin/google-chrome';
const FRONT = process.env.FRONT_URL || 'http://127.0.0.1:8099/';
const PORT = Number(process.env.CDP_PORT || (9300 + Math.floor(Math.random() * 400)));
const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--js-flags=--expose-gc',
  '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
  `--remote-debugging-port=${PORT}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let list = null;
  for (let i = 0; i < 60 && !list; i++) {
    try { list = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter((t) => t.type === 'page'); } catch {}
    if (!list?.length) await sleep(250);
  }
  const ws = new WebSocket(list[0].webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', () => rej(new Error('CDP error')), { once: true }); setTimeout(() => rej(new Error('CDP timeout')), 15000); });
  let id = 0; const pending = new Map();
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result))); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => rej(new Error(`timeout ${method}`)), 60000); });
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`eval: ${r.exceptionDetails.text}`);
    return r.result?.value;
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: `${FRONT}?debug=1` });
  await sleep(3500);

  // Listener bus + sesi + heap (setelah GC paksa — heap mentah bukan indikator leak).
  // GC 3x + jeda (pola leak-curve.mjs): 1x GC tidak cukup — objek besar sesi
  // Solo (heightfield/chunk) sering baru dipromosikan ke old-space dan butuh
  // siklus penuh. Tanpa ini usedJSHeapSize terdistorsi noise GC ±1-2 MB.
  const busSnap = `(async()=>{const m=await import('/src/core/bus.js');
    if(typeof gc==='function'){for(let k=0;k<3;k++){gc();await new Promise(r=>setTimeout(r,300));}}
    return {attack:m.countListeners('input:attack'),look:m.countListeners('input:look'),
      map:m.countListeners('ui:toggleMap'),session:window.__fb.getSession()===null,
      heap:(performance.memory?.usedJSHeapSize??0)};})()`;

  // Metrik saat sesi hidup: scene graph (deterministik) — bukan renderer.info
  // yang fluktuatif tergantung timing GC SwiftShader.
  const liveMetrics = `(async()=>{const s=window.__fb.getSession();if(!s)return null;
    let prev=-1;
    for(let i=0;i<60;i++){const c=s.metrics().chunksCreated;if(c===prev&&c>=19)break;prev=c;await new Promise(r=>setTimeout(r,250));}
    let objs=0,geos=new Set(),mats=new Set();
    s.scene.traverse(o=>{objs++;if(o.geometry)geos.add(o.geometry);const m=o.material;if(m)(Array.isArray(m)?m:[m]).forEach(x=>mats.add(x));});
    const tex=s.renderer?.renderer?.info?.memory?.textures??null;
    const shadowTarget=s.lighting?.sun?.shadow?.map!==null&&s.lighting?.sun?.shadow?.map!==undefined;
    return {objs,geos:geos.size,mats:mats.size,items:s.combat.items.length,bots:s.combat.bots.length,
      chunks:s.metrics().chunks,tex,shadowTarget};})()`;

  // startSolo menunda konstruksi sesi lewat rAF+setTimeout(30). Sleep tetap bisa
  // kalah dari race itu -> metrik 'live' membaca sisa scene sesi sebelumnya
  // (flap ±2 objek). Tunggu sampai sesi BARU benar-benar ada, bukan sleep buta.
  const waitSession = async () => {
    for (let k = 0; k < 40; k++) {
      const ok = await ev(`!!window.__fb.getSession()`);
      if (ok) return;
      await sleep(150);
    }
    throw new Error('sesi tidak terbentuk dalam 6 dtk');
  };

  // Warmup 5 sesi: cache three.js/shader & baseline V8 stabil dulu, baru diukur.
  // Tanpa warmup, kenaikan awal bukan leak melainkan cache yang sedang mengisi.
  for (let i = 0; i < 5; i++) {
    await ev(`document.getElementById('btn-solo').click()`);
    await waitSession();
    await ev(`window.__fb.exitSolo()`);
    await sleep(500);
  }
  const base = await ev(busSnap);
  const samples = [];
  for (let i = 0; i < 20; i++) {
    await ev(`document.getElementById('btn-solo').click()`);
    await waitSession();
    if (i === 0 || i === 9 || i === 19) samples.push({ i: i + 1, phase: 'live', ...(await ev(liveMetrics)) });
    await ev(`window.__fb.exitSolo()`);
    await sleep(700);
    if (i === 0 || i === 9 || i === 19) samples.push({ i: i + 1, phase: 'after', ...(await ev(busSnap)) });
  }
  const after = await ev(busSnap);

  console.log('LEAK REPORT:', JSON.stringify({ base, samples, after }, null, 1));

  const fails = [];
  const afters = samples.filter((s) => s.phase === 'after');
  for (const s of [...afters, { i: 'final', ...after }]) {
    if (!s.session) fails.push(`iterasi ${s.i}: sesi tidak null setelah exit`);
    if (s.attack || s.look || s.map) fails.push(`iterasi ${s.i}: listener bocor a=${s.attack} l=${s.look} m=${s.map}`);
  }
  const live = samples.filter((s) => s.phase === 'live');
  if (live.length >= 2) {
    const f = live[0], l = live[live.length - 1];
    // Scene graph HARUS identik antar sesi — satu saja bertambah = bocor nyata.
    if (l.geos !== f.geos) fails.push(`geometri scene naik ${f.geos}→${l.geos} (bocor GPU)`);
    if (l.mats !== f.mats) fails.push(`material scene naik ${f.mats}→${l.mats}`);
    if (l.objs !== f.objs) fails.push(`objek scene naik ${f.objs}→${l.objs}`);
    if (l.items !== f.items) fails.push(`loot dunia naik ${f.items}→${l.items}`);
    if (l.bots !== f.bots) fails.push(`bot naik ${f.bots}→${l.bots}`);
    // Tekstur GPU harus IDENTIK antar sesi — shadow.map WebGLRenderTarget
    // pernah bocor +1 tekstur/sesi di sini (Fase 4, sudah diperbaiki).
    if (f.tex != null && l.tex != null && l.tex > f.tex) fails.push(`tekstur GPU naik ${f.tex}→${l.tex} (bocor render target)`);
    if (l.shadowTarget !== f.shadowTarget) fails.push(`shadow target berubah ${f.shadowTarget}→${l.shadowTarget}`);
  }
  // Threshold heap 1.6x dari run SEBELUMNYA salah: heap V8 naik ~72% lalu plateau
  // (terukur leak-curve.mjs: delta per 10 sesi 98k→74k→25k→0 = cache, bukan bocor).
  // Ukuran leak nyata = slope antar sesi 10->20, bukan base→akhir. Di bawah 100 KB
  // per 10 sesi dianggap plateau V8 heap growth (lihat leak-curve.mjs untuk bukti).
  const s10 = samples.find((s) => s.phase === 'after' && s.i === 10);
  const s20 = samples.find((s) => s.phase === 'after' && s.i === 20);
  if (s10?.heap && s20?.heap && s20.heap - s10.heap > 100 * 1024) {
    fails.push(`heap slope 10→20 sesi +${Math.round((s20.heap - s10.heap) / 1024)} KB (bocor linear)`);
  }

  console.log('VERDICT:', fails.length ? 'FAIL' : 'PASS');
  for (const f of fails) console.log('  ✗', f);
  if (fails.length) process.exitCode = 1;
}

main().then(() => { chrome.kill(); process.exit(process.exitCode || 0); }).catch((e) => { console.error('LEAK CHECK ERROR:', e.message); chrome.kill(); process.exit(1); });
