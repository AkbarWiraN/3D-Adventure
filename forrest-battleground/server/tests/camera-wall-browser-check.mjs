// camera-wall-browser-check.mjs — kamera rig NYATA tidak tembus dinding di browser.
// Jalankan: FRONT_URL=http://127.0.0.1:8099/ node server/tests/camera-wall-browser-check.mjs
// Sesi dimulai lewat tombol UI (btn-solo) seperti pemakai nyata; world diambil
// dari __fb.getWorld() (deterministik, sama dengan yang dipakai server).
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const CHROME = process.env.CHROME_BIN || '/usr/bin/google-chrome';
const FRONT = (process.env.FRONT_URL || 'http://127.0.0.1:8099/') + '?debug=1';
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
  let id = 0;
  const pending = new Map();
  ws.on('message', (m) => {
    const msg = JSON.parse(m);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  });
  const send = (method, params = {}) => new Promise((res) => {
    const my = ++id;
    pending.set(my, res);
    ws.send(JSON.stringify({ id: my, method, params }));
  });
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300));
    return r.result?.result?.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: FRONT });
  await sleep(2500);
  await ev("document.getElementById('btn-solo').click()");
  await sleep(2500);

  const ready = await ev("(() => { const s = window.__fb && window.__fb.getSession(); return s ? { rig: !!s.cameraRig, grid: !!s.colliderGrid } : null; })()");
  if (!ready?.rig || !ready?.grid) throw new Error(`sesi tidak siap: ${JSON.stringify(ready)}`);

  const verdict = await ev(`(async () => {
    const world = await window.__fb.getWorld();
    const sess = window.__fb.getSession();
    const rig = sess.cameraRig, grid = sess.colliderGrid, cam = rig.camera;

    const nearby = (g, x, z, r) => {
      const cell = g.cell, out = [];
      const minX = Math.floor((x - r) / cell), maxX = Math.floor((x + r) / cell);
      const minZ = Math.floor((z - r) / cell), maxZ = Math.floor((z + r) / cell);
      for (let gx = minX; gx <= maxX; gx++) for (let gz = minZ; gz <= maxZ; gz++) {
        const b = g.map.get(gx + ',' + gz); if (b) for (const c of b) out.push(c);
      }
      return out;
    };
    const inside = (x, z, r) => nearby(grid, x, z, r + 1).some((c) => {
      const cos = Math.cos(-(c.rotY || 0)), sin = Math.sin(-(c.rotY || 0));
      const dx = x - c.cx, dz = z - c.cz;
      const lx = dx * cos - dz * sin, lz = dx * sin + dz * cos;
      const ex = Math.max(Math.abs(lx) - c.hx, 0), ez = Math.max(Math.abs(lz) - c.hz, 0);
      return (ex * ex + ez * ez) < r * r;
    });

    const R = 0.45, CAM = 5.2;
    let tested = 0, clampActive = 0;
    const gridRef = grid;
    const bad = [];
    for (const h of world.houses.slice(0, 8)) {
      for (const a of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) {
        for (const d of [3.5, 4.5]) {
          const px = h.x + Math.sin(a) * d, pz = h.z + Math.cos(a) * d;
          if (inside(px, pz, R)) continue;             // bukan titik berdiri valid
          for (const yaw of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) {
            const state = { position: { x: px, y: 0, z: pz }, yaw, moving: false };
            // Referensi: posisi kamera TANPA collision (grid dilepas sementara).
            rig.yaw = yaw; rig.userYawOffset = 0; rig._init = false;
            rig.grid = null; rig.update(state, 0.016);
            const free = { x: cam.position.x, z: cam.position.z };
            // Aktual: dengan collision aktif.
            rig.grid = grid; rig._init = false; rig.update(state, 0.016);
            tested++;
            const clamped = Math.hypot(cam.position.x - free.x, cam.position.z - free.z) > 0.05;
            if (clamped) clampActive++;
            if (inside(cam.position.x, cam.position.z, 0.05)) {
              if (bad.length < 5) bad.push({ house: h.id, yaw: +yaw.toFixed(2), cam: [+cam.position.x.toFixed(1), +cam.position.z.toFixed(1)] });
            }
          }
        }
      }
    }
    return { tested, clampActive, cameraInsideWall: bad.length, bad };
  })()`);

  const ok = verdict.cameraInsideWall === 0 && verdict.tested >= 60
    && verdict.clampActive > 0 && verdict.clampActive < verdict.tested;
  console.log('CAMERA WALL REPORT:', JSON.stringify(verdict));
  console.log('VERDICT:', ok ? `PASS (${verdict.tested} kasus, ${verdict.clampActive} kali clamp aktif, 0 tembus)` : 'FAIL');
  chrome.kill('SIGKILL');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error('ERROR', e.message); chrome.kill('SIGKILL'); process.exit(1); });
