// leak-trace.mjs — cari SUMBER kebocoran heap ~130 KB/sesi via HeapProfiler sampling.
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
  const ws = new WebSocket(list[0].webSocketDebuggerUrl, { maxPayload: 512 * 1024 * 1024 });
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', () => rej(new Error('CDP error')), { once: true }); setTimeout(() => rej(new Error('CDP timeout')), 15000); });
  let id = 0; const pending = new Map();
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result))); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => rej(new Error(`timeout ${method}`)), 180000); });
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`eval: ${r.exceptionDetails.text}`);
    return r.result?.value;
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('HeapProfiler.enable');
  await send('Page.navigate', { url: `${FRONT}?debug=1` });
  await sleep(3500);

  // Baseline: 5 sesi warmup supaya cache terbentuk, lalu GC.
  for (let i = 0; i < 5; i++) {
    await ev(`document.getElementById('btn-solo').click()`); await sleep(1100);
    await ev(`window.__fb.exitSolo()`); await sleep(500);
  }
  await ev(`(async()=>{for(let k=0;k<3;k++){gc();await new Promise(r=>setTimeout(r,300));}return 1})()`);

  await send('HeapProfiler.startSampling', { samplingInterval: 4096, includeObjectsCollectedByMajorGC: false });
  for (let i = 0; i < 20; i++) {
    await ev(`document.getElementById('btn-solo').click()`); await sleep(1100);
    await ev(`window.__fb.exitSolo()`); await sleep(500);
  }
  await ev(`(async()=>{for(let k=0;k<3;k++){gc();await new Promise(r=>setTimeout(r,300));}return 1})()`);
  const prof = await send('HeapProfiler.stopSampling');

  // Agregasi per fungsi (self size), urut terbesar.
  const agg = new Map();
  const walk = (node) => {
    const cf = node.callFrame || {};
    const key = `${cf.functionName || '(anonymous)'} @ ${(cf.url || '').split('/').slice(-2).join('/')}:${cf.lineNumber + 1}`;
    agg.set(key, (agg.get(key) || 0) + (node.selfSize || 0));
    for (const c of node.children || []) walk(c);
  };
  walk(prof.profile.head);
  const top = [...agg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18);
  console.log('TOP SELF-SIZE ALLOCATIONS (bytes):');
  for (const [k, v] of top) console.log(String(v).padStart(10), k);
  const total = [...agg.values()].reduce((a, b) => a + b, 0);
  console.log('total sampled bytes:', total);
}

main().then(() => { chrome.kill(); process.exit(0); }).catch((e) => { console.error('TRACE ERROR:', e.message); chrome.kill(); process.exit(1); });
