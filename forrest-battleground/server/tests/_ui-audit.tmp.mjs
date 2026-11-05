// Audit visual multi-device: iPhone landscape (740x390), iPhone portrait (390x844),
// iPad landscape (1024x768), desktop (1366x768). Assert: tak ada scroll overflow,
// rotate-hint sesuai orientasi, panel muat layar.
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
import fs from 'node:fs';
const CHROME = '/usr/bin/google-chrome';
const FRONT = 'http://127.0.0.1:8099/';
const PORT = 9350;
const chrome = spawn(CHROME, ['--headless=new','--no-sandbox','--disable-gpu','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader',`--remote-debugging-port=${PORT}`,'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const DEVICES = [
  { name: 'iphone-landscape',  w: 740,  h: 390, dpr: 3, mobile: true },
  { name: 'iphone-portrait',   w: 390,  h: 844, dpr: 3, mobile: true },
  { name: 'ipad-landscape',    w: 1024, h: 768, dpr: 2, mobile: true },
  { name: 'ipad-portrait',     w: 768,  h: 1024, dpr: 2, mobile: true },
  { name: 'desktop',           w: 1366, h: 768, dpr: 1, mobile: false },
];
async function main() {
  let list = null;
  for (let i = 0; i < 60 && !list; i++) {
    try { list = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter(t => t.type === 'page'); } catch {}
    if (!list?.length) await sleep(250);
  }
  const ws = new WebSocket(list[0].webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  let id = 0; const pending = new Map();
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result))); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => rej(new Error('timeout ' + method)), 60000); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result?.value; };
  const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`/tmp/audit-${name}.png`, Buffer.from(r.data, 'base64')); };
  await send('Runtime.enable'); await send('Page.enable');

  const R = {};
  for (const d of DEVICES) {
    await send('Emulation.setDeviceMetricsOverride', { width: d.w, height: d.h, deviceScaleFactor: d.dpr, mobile: d.mobile });
    if (d.mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    else await send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await send('Page.navigate', { url: FRONT + '?debug=1' });
    await sleep(2600);
    R[d.name] = await ev(`(()=>{
      const rh = getComputedStyle(document.getElementById('rotate-hint')).display;
      const ov = document.getElementById('screen-title');
      const panel = ov.querySelector('.panel');
      const pr = panel.getBoundingClientRect();
      // ukur apakah konten panel melebihi viewport
      return {
        rotateHint: rh,
        viewport: innerWidth + 'x' + innerHeight,
        panelBox: Math.round(pr.width) + 'x' + Math.round(pr.height),
        panelTop: Math.round(pr.top), panelBottom: Math.round(pr.bottom),
        cutTop: pr.top < 0, cutBottom: pr.bottom > innerHeight,
        overlayScrollable: ov.scrollHeight > ov.clientHeight,
        scrollH: ov.scrollHeight, clientH: ov.clientHeight,
      };
    })()`);
    await shot(d.name);
  }
  console.log(JSON.stringify(R, null, 1));
  const fails = [];
  // Kebijakan: mobile/tablet portrait -> hint MUNCUL; landscape/desktop -> hilang.
  if (R['iphone-landscape'].rotateHint !== 'none') fails.push('hint muncul di iphone-landscape');
  if (R['iphone-portrait'].rotateHint === 'none') fails.push('hint TIDAK muncul di iphone-portrait');
  if (R['ipad-landscape'].rotateHint !== 'none') fails.push('hint muncul di ipad-landscape');
  if (R['ipad-portrait'].rotateHint === 'none') fails.push('hint TIDAK muncul di ipad-portrait (tablet tetap diminta landscape)');
  if (R['desktop'].rotateHint !== 'none') fails.push('hint muncul di desktop');
  // Konten tidak boleh kepotong di semua device yang boleh main (landscape/desktop).
  for (const n of ['iphone-landscape', 'ipad-landscape', 'desktop']) {
    if (R[n].cutTop || R[n].cutBottom) fails.push(`${n}: panel kepotong (top=${R[n].panelTop}, bottom=${R[n].panelBottom}, vh=${R[n].viewport})`);
  }
  console.log('VERDICT:', fails.length ? 'FAIL' : 'PASS');
  for (const f of fails) console.log('  ✗', f);
  if (fails.length) process.exitCode = 1;
}
main().then(() => { chrome.kill(); process.exit(process.exitCode || 0); }).catch(e => { console.error('ERR', e.message); chrome.kill(); process.exit(1); });
