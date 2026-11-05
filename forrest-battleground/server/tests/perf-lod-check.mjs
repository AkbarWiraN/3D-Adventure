// perf-lod-check.mjs — ukur draw call / triangle nyata + dampak jarak.
// FPS headless SwiftShader TIDAK valid, tapi drawCalls & triangles = hitungan CPU
// sisi renderer, jadi sahih dipakai membandingkan sebelum/sesudah LOD.
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const CHROME = process.env.CHROME_BIN || '/usr/bin/google-chrome';
const FRONT = (process.env.FRONT_URL || 'http://127.0.0.1:8099/') + '?debug=1';
const TIER = process.env.TIER || 'high';
const PORT = Number(process.env.CDP_PORT || (9300 + Math.floor(Math.random() * 400)));
const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
  '--window-size=900,1400', `--remote-debugging-port=${PORT}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let list = null;
  for (let i = 0; i < 60 && !list; i++) {
    try { list = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter((t) => t.type === 'page'); } catch {}
    if (!list?.length) await sleep(250);
  }
  const ws = new WebSocket(list[0].webSocketDebuggerUrl);
  await new Promise((r) => ws.on('open', r));
  let id = 0; const pending = new Map();
  ws.on('message', (m) => { const msg = JSON.parse(m); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } });
  const send = (method, params = {}) => new Promise((res) => { const my = ++id; pending.set(my, res); ws.send(JSON.stringify({ id: my, method, params })); });
  const ev = async (e) => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300));
    return r.result?.result?.value;
  };

  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: FRONT });
  await sleep(2500);
  const settings = await ev("(() => { const s = localStorage.getItem('fb.settings'); return s; })()");
  await ev(`localStorage.setItem('forest-battleground:settings:v1', JSON.stringify({ ...(JSON.parse(${JSON.stringify(settings || '{}')})), quality: '${TIER}' }))`);
  await send('Page.navigate', { url: FRONT });
  await sleep(2500);
  await ev("document.getElementById('btn-solo').click()");
  await sleep(5000);

  const report = await ev(`(() => {
    const sess = window.__fb.getSession();
    if (!sess) return { error: 'sesi null' };
    const ti = sess.renderer.renderer.info;
    const wm = sess.worldManager;
    const chunks = [...wm.chunks.values()];
    // hitung objek per chunk
    let instanced = 0, meshes = 0, geos = new Set();
    for (const c of chunks) {
      c.group.traverse((o) => {
        if (o.isInstancedMesh) { instanced++; if (o.geometry) geos.add(o.geometry.uuid); }
        else if (o.isMesh) { meshes++; if (o.geometry) geos.add(o.geometry.uuid); }
      });
    }
    return {
      tier: '${TIER}',
      drawCalls: ti.render.calls,
      triangles: ti.render.triangles,
      programs: ti.programs?.length ?? null,
      chunkCount: chunks.length,
      instancedMeshes: instanced,
      plainMeshes: meshes,
      uniqueGeometries: geos.size,
      fogFar: sess.renderer.scene.fog?.far ?? null,
      cameraFar: sess.renderer.camera.far,
      activeRing: sess.renderer ? null : null,
    };
  })()`);
  console.log('PERF REPORT:', JSON.stringify(report));
  chrome.kill('SIGKILL');
}
main().catch((e) => { console.error('ERROR', e.message); chrome.kill('SIGKILL'); process.exit(1); });
