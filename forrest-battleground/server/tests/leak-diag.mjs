// leak-diag.mjs — diagnosa: resource apa yang bertambah tiap sesi Solo?
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

  // Probe: scene graph + renderer.info + registry internal (geometri/mat unik di scene).
  const probe = `(async()=>{const s=window.__fb.getSession();const THREE=await import('three');
    const scene=s?s.scene:null;
    const geos=new Set(),mats=new Set();let objs=0;
    if(scene){scene.traverse(o=>{objs++;if(o.geometry)geos.add(o.geometry);const m=o.material;if(m){(Array.isArray(m)?m:[m]).forEach(x=>mats.add(x));}});}
    const r=s?.renderer?.renderer||null;
    return {objs,geos:geos.size,mats:mats.size,
      infoMem:r?{g:r.info.memory.geometries,t:r.info.memory.textures,prog:r.info.programs?.length}:null,
      worldStats:s?s.worldManager.stats:null,
      combatItems:s?s.combat.items.length:null,bots:s?s.combat.bots.length:null};})()`;

  for (let i = 0; i < 4; i++) {
    await ev(`document.getElementById('btn-solo').click()`);
    await sleep(2500);
    const live = await ev(probe);
    console.log(`iter${i + 1} LIVE  `, JSON.stringify(live));
    await ev(`window.__fb.exitSolo()`);
    await sleep(1200);
    const gone = await ev(`(async()=>{const r=window.__q;return {session:window.__fb.getSession()===null}})()`);
    console.log(`iter${i + 1} AFTER `, JSON.stringify(gone));
  }
  const heap = await ev(`(async()=>{gc&&gc();await new Promise(r=>setTimeout(r,300));return performance.memory.usedJSHeapSize})()`);
  console.log('heap after gc:', heap);
}

main().then(() => { chrome.kill(); process.exit(0); }).catch((e) => { console.error('DIAG ERROR:', e.message); chrome.kill(); process.exit(1); });
