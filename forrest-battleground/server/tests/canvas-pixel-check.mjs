// canvas-pixel-check.mjs — apa warna yang BENAR-BENAR dilukis? (bukti render nyata)
// Ambil canvas WebGL, sampling piksel, hitung histogram warna kasar:
// hijau = tumbuhan, cokelat = tanah, biru = langit, abu = batu/dinding.
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
  await sleep(3000);
  await ev("document.getElementById('btn-solo').click()");
  await sleep(4500);

  const res = await ev(`(() => {
    const sess = window.__fb.getSession();
    const r = sess.renderer;
    const gl = r.gl || r.renderer?.getContext?.();
    if (!gl) return { error: 'gl tidak ada' };
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
    const px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const bucket = { hijau: 0, cokelat: 0, biru: 0, abu: 0, merah: 0, gelap: 0, lain: 0 };
    const uniq = new Set();
    let n = 0;
    for (let i = 0; i < px.length; i += 4 * 97) {  // sampling jarang, tersebar
      const R = px[i], G = px[i+1], B = px[i+2];
      n++;
      uniq.add((R >> 4) + ',' + (G >> 4) + ',' + (B >> 4));
      const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
      if (mx < 45) bucket.gelap++;
      else if (G > R + 12 && G > B + 12) bucket.hijau++;
      else if (R > G + 18 && G >= B) bucket.cokelat++;
      else if (B > R + 12 && B > G - 5) bucket.biru++;
      else if (mx - mn < 26) bucket.abu++;
      else if (R > G + 40 && R > B + 40) bucket.merah++;
      else bucket.lain++;
    }
    // Info kamera/pemain: apakah karakter terlihat di layar?
    const cam = sess.cameraRig.camera, P = sess.player.position;
    const proj = new (cam.position.constructor)(P.x, P.y + 1.0, P.z).project(cam);
    return {
      buffer: [W, H],
      dipakaiPersen: {
        hijau: +(100*bucket.hijau/n).toFixed(1), cokelat: +(100*bucket.cokelat/n).toFixed(1),
        biru: +(100*bucket.biru/n).toFixed(1), abu: +(100*bucket.abu/n).toFixed(1),
        merah: +(100*bucket.merah/n).toFixed(1), gelap: +(100*bucket.gelap/n).toFixed(1),
        lain: +(100*bucket.lain/n).toFixed(1),
      },
      warnaUnik: uniq.size,
      playerDiLayar: { x: +proj.x.toFixed(2), y: +proj.y.toFixed(2), z: +proj.z.toFixed(2) },
      jarakKamera: +cam.position.distanceTo(sess.player.position).toFixed(2),
      sceneVisible: !!sess.renderer,
    };
  })()`);
  console.log('PIXEL REPORT:', JSON.stringify(res, null, 1));
  chrome.kill('SIGKILL');
}
main().catch((e) => { console.error('ERROR', e.message); chrome.kill('SIGKILL'); process.exit(1); });
