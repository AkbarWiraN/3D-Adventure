// leak-curve.mjs — heap setelah GC pada iterasi bertambah: plateaus (cache) atau linear (bocor)?
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

  const heapAfterGc = `(async()=>{for(let k=0;k<3;k++){gc();await new Promise(r=>setTimeout(r,300));}
    return {heap:performance.memory.usedJSHeapSize,dom:document.getElementsByTagName('*').length};})()`;

  console.log('start', JSON.stringify(await ev(heapAfterGc)));
  const marks = [];
  for (let i = 1; i <= 40; i++) {
    await ev(`document.getElementById('btn-solo').click()`);
    await sleep(1200);
    await ev(`window.__fb.exitSolo()`);
    await sleep(600);
    if (i % 10 === 0) {
      const h = await ev(heapAfterGc);
      marks.push({ i, ...h });
      console.log(`iter${i}`, JSON.stringify(h));
    }
  }
  // Delta per 10 sesi: kalau ~konstan = bocor; kalau mengecil = cache menjenuh.
  const deltas = marks.map((m, k) => (k ? m.heap - marks[k - 1].heap : m.heap - marks[0].heap));
  console.log('deltas per 10 sesi:', JSON.stringify(deltas));
  console.log('dom nodes:', JSON.stringify(marks.map((m) => m.dom)));
}

main().then(() => { chrome.kill(); process.exit(0); }).catch((e) => { console.error('CURVE ERROR:', e.message); chrome.kill(); process.exit(1); });
