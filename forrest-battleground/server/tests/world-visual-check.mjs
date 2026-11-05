// world-visual-check.mjs — apa yang BENAR-BENAR terlihat di hutan?
// Lapor: jumlah objek scene per jenis, senjata pemain, error console, + screenshot.
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
import { writeFileSync } from 'node:fs';

const CHROME = process.env.CHROME_BIN || '/usr/bin/google-chrome';
const URLBASE = process.env.FRONT_URL || 'http://127.0.0.1:8099/';
const FRONT = URLBASE + '?debug=1';
const SHOT = process.env.SHOT || '/home/ubuntu/.hermes/cache/scratch/fb-world.png';
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
  let id = 0; const pending = new Map(); const logs = [];
  ws.on('message', (m) => {
    const msg = JSON.parse(m);
    if (msg.method === 'Runtime.consoleAPICalled') logs.push(`[${msg.params.type}] ` + msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '));
    if (msg.method === 'Runtime.exceptionThrown') logs.push('[EXC] ' + (msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text));
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  });
  const send = (method, params = {}) => new Promise((res) => { const my = ++id; pending.set(my, res); ws.send(JSON.stringify({ id: my, method, params })); });
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
    return r.result?.result?.value;
  };

  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: FRONT });
  await sleep(3000);
  await ev("document.getElementById('btn-solo').click()");
  await sleep(4000);

  const report = await ev(`(async () => {
    const sess = window.__fb?.getSession?.();
    if (!sess) return { error: 'sesi null' };
    const world = await window.__fb.getWorld();
    const scene = sess.scene || sess.worldManager?.scene;
    // hitung objek scene
    let meshes = 0, instanced = 0, groups = 0, total = 0, tris = 0;
    const names = {};
    const walk = (o) => {
      total++;
      if (o.isInstancedMesh) instanced++;
      else if (o.isMesh) meshes++;
      if (o.isGroup) groups++;
      const n = (o.name || '').split('-')[0] || '(tanpa-nama)';
      names[n] = (names[n] || 0) + 1;
      for (const c of o.children) walk(c);
    };
    if (scene) walk(scene);

    // pemain & senjata
    const p = sess.player;
    const weapon = p?.weaponMount?.children?.length ?? -1;
    const hand = sess.combat ? (sess.combat.weaponName?.() ?? sess.combat.currentWeapon ?? null) : null;

    // struktur world yang diharapkan
    const houses = world.houses.length, trees = (world.treeCount ?? null), rocks = world.largeRocks.length;
    const chunkInfo = sess.worldManager ? { active: sess.worldManager.active?.size ?? null, made: sess.worldManager.created ?? null } : null;
    const rinfo = sess.renderer?.renderer?.info?.render ?? null;
    return {
      sceneTotal: total, meshes, instanced, groups,
      drawCalls: rinfo?.calls ?? null, triangles: rinfo?.triangles ?? null,
      topNames: Object.entries(names).sort((a,b)=>b[1]-a[1]).slice(0, 12),
      playerWeaponChildren: weapon, weaponName: hand,
      worldHouses: houses, worldLargeRocks: rocks,
      chunkInfo, spawn: p ? { x: +p.position.x.toFixed(1), y: +p.position.y.toFixed(1), z: +p.position.z.toFixed(1) } : null,
    };
  })()`);
  console.log('WORLD REPORT:', JSON.stringify(report, null, 1));

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  if (shot.result?.data) { writeFileSync(SHOT, Buffer.from(shot.result.data, 'base64')); console.log('SCREENSHOT:', SHOT); }
  console.log('--- console (30 terakhir) ---');
  console.log(logs.slice(-30).join('\n') || '(bersih)');
  chrome.kill('SIGKILL');
}
main().catch((e) => { console.error('ERROR', e.message); chrome.kill('SIGKILL'); process.exit(1); });
