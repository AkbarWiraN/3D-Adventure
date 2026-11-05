// mobile-emu-check.mjs — apakah kontrol mobile landscape BENAR-BENAR berfungsi?
// Mobile WAJIB landscape (permintaan pemilik 5 Nov 2026): portrait memunculkan
// rotate-hint; uji ini memakai viewport landscape 844x390 (iPhone-14-ish, DPR 3).
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const CHROME = process.env.CHROME_BIN || '/usr/bin/google-chrome';
const FRONT = process.env.FRONT_URL || 'http://127.0.0.1:8099/';
const PORT = Number(process.env.CDP_PORT || (9300 + Math.floor(Math.random() * 400)));
const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu',
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
  // Emulasi HP LANDSCAPE: 844x390 DPR3, touch wajib.
  await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 3, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  const R = {};
  await send('Page.navigate', { url: `${FRONT}?debug=1` });
  await sleep(3500);
  R.viewport = await ev(`({w:innerWidth,h:innerHeight,touch:navigator.maxTouchPoints,coarse:matchMedia('(pointer: coarse)').matches,hoverNone:matchMedia('(hover: none)').matches})`);
  await ev(`document.getElementById('btn-solo').click()`);
  await sleep(5000);
  R.mobileControlsVisible = await ev(`!document.getElementById('mobile-controls').classList.contains('hidden')`);
  R.desktopHintHidden = await ev(`document.getElementById('desktop-hint').classList.contains('hidden')`);
  // Landscape → rotate-hint harus TERSEMBUNYI.
  R.rotateHintDisplay = await ev(`getComputedStyle(document.getElementById('rotate-hint')).display`);

  // Portrait → rotate-hint harus MUNCUL (blokir main dalam posisi tegak).
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await sleep(400);
  R.rotateHintInPortrait = await ev(`getComputedStyle(document.getElementById('rotate-hint')).display`);
  await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 3, mobile: true });
  await sleep(400);
  R.rotateHintBackLandscape = await ev(`getComputedStyle(document.getElementById('rotate-hint')).display`);

  // Joystick: pointer events SINTETIS dengan pointerType touch (meniru sentuh nyata).
  R.joy = await ev(`(()=>{const z=document.getElementById('joystick-zone');const r=z.getBoundingClientRect();
    const mk=(t,x,y,pid=1)=>z.dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,pointerId:pid,pointerType:'touch',clientX:x,clientY:y,isPrimary:true}));
    mk('pointerdown',r.left+r.width/2,r.top+r.height/2);
    mk('pointermove',r.left+r.width/2,r.top+r.height/2-40);
    const s=window.__fb.getSession();
    return {hasSession:!!s, moveX:s?.input?.moveX, moveZ:s?.input?.moveZ, sprint:s?.input?.sprint};})()`);

  // Gerak nyata setelah joystick diarahkan (intent harus menghasilkan perpindahan).
  const p0 = await ev(`(()=>{const p=window.__fb.getSession().player.position;return {x:p.x,z:p.z}})()`);
  await sleep(1200);
  const p1 = await ev(`(()=>{const p=window.__fb.getSession().player.position;return {x:p.x,z:p.z}})()`);
  R.moved = Math.hypot(p1.x - p0.x, p1.z - p0.z);
  await ev(`(()=>{const z=document.getElementById('joystick-zone');z.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:1,pointerType:'touch'}));return 1})()`);

  // Multitouch simultan: joystick (pointer 1) + drag-look (pointer 2) harus bisa bersamaan.
  R.multiTouch = await ev(`(()=>{const z=document.getElementById('joystick-zone'),l=document.getElementById('look-zone');
    const rz=z.getBoundingClientRect(),rl=l.getBoundingClientRect();
    const mk=(el,t,x,y,pid)=>el.dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,pointerId:pid,pointerType:'touch',clientX:x,clientY:y,isPrimary:pid===1}));
    mk(z,'pointerdown',rz.left+40,rz.top+40,1);
    mk(l,'pointerdown',rl.left+rl.width-60,rl.top+rl.height/2,2);
    mk(z,'pointermove',rz.left+40,rz.top+10,1);
    mk(l,'pointermove',rl.left+rl.width-120,rl.top+rl.height/2,2);
    const s=window.__fb.getSession();
    const before=s.cameraRig.userYawOffset;
    return {joyActive:s.input.joyY!==0||s.input.joyX!==0, lookPointerId:s.input.lookPointerId??null, yawOffset:before};})()`);

  R.safeAreaCss = await ev(`getComputedStyle(document.documentElement).getPropertyValue('--safe-t').trim()`);
  R.hudNotEmpty = await ev(`document.getElementById('hud').children.length`);

  console.log('MOBILE REPORT:', JSON.stringify(R, null, 1));
  const fails = [];
  if (!R.mobileControlsVisible) fails.push('kontrol mobile TIDAK tampil di HP emulasi');
  if (R.mobileControlsVisible && !(R.joy?.moveX || R.joy?.moveZ)) fails.push('joystick tidak merespons sentuh');
  if (!(R.moved > 0.05)) fails.push('joystick tidak menggerakkan pemain (moved=' + R.moved + ')');
  if (!R.multiTouch?.joyActive) fails.push('joystick+look simultan gagal');
  // Kebijakan orientasi: landscape bebas, portrait diblokir rotate-hint.
  if (R.rotateHintDisplay !== 'none') fails.push('rotate-hint muncul di landscape: ' + R.rotateHintDisplay);
  if (R.rotateHintInPortrait === 'none') fails.push('rotate-hint TIDAK muncul di portrait');
  if (R.rotateHintBackLandscape !== 'none') fails.push('rotate-hint tidak hilang saat kembali landscape');
  console.log('VERDICT:', fails.length ? 'FAIL' : 'PASS');
  for (const f of fails) console.log('  ✗', f);
  if (fails.length) process.exitCode = 1;
}

main().then(() => { chrome.kill(); process.exit(process.exitCode || 0); }).catch((e) => { console.error('MOBILE CHECK ERROR:', e.message); chrome.kill(); process.exit(1); });
