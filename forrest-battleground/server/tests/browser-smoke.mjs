// browser-smoke.mjs — QA Fase 2 lewat Chrome headless sungguhan.
// Alur: solo guest → loot → 5 hit bot → death overlay → respawn → exit (cek leak)
//       lalu register/login ke backend nyata → lobby/leaderboard/online count.
// Output di bawah adalah bukti nyata, bukan klaim. SwiftShader: FPS tidak valid
// untuk metrik performa perangkat.
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME_BIN || '/usr/bin/google-chrome';
const FRONT = process.env.FRONT_URL || 'http://127.0.0.1:8099/';
const BACKEND = process.env.BACKEND_URL || '';

const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
  '--window-size=900,1400', '--remote-debugging-port=9333', 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let list = null;
  for (let i = 0; i < 60 && !list; i++) {
    try { list = (await (await fetch('http://127.0.0.1:9333/json/list')).json()).filter((t) => t.type === 'page'); } catch {}
    if (!list?.length) await sleep(250);
  }
  const ws = new WebSocket(list[0].webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', () => rej(new Error('CDP error')), { once: true });
    setTimeout(() => rej(new Error('CDP timeout')), 15000);
  });
  let id = 0; const pending = new Map(); const logs = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled') logs.push(`[console.${m.params.type}] ${m.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
    if (m.method === 'Runtime.exceptionThrown') logs.push(`[exception] ${m.params.exceptionDetails.text}`);
  });
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result)));
    ws.send(JSON.stringify({ id: i, method, params }));
    setTimeout(() => rej(new Error(`timeout ${method}`)), 60000);
  });
  const evRaw = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`eval: ${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description || ''}`);
    return r.result?.value ?? r.result?.result?.value;
  };
  const ev = (expr) => Promise.race([
    evRaw(expr),
    sleep(20000).then(() => { throw new Error('eval 20s timeout: ' + expr.slice(0, 60)); }),
  ]);

  await send('Runtime.enable');
  await send('Page.enable');
  const R = {};
  

  // ---------- Fase A: Solo guest, tanpa backend ----------
  await send('Page.navigate', { url: `${FRONT}?debug=1` });
  await sleep(3000);
  R.webgl = await ev(`!!document.getElementById('gl').getContext('webgl2')`);
  R.titleVisible = await ev(`!document.getElementById('screen-title').classList.contains('hidden')`);
  await ev(`document.getElementById('btn-solo').click()`);
  await sleep(4500);
  await ev(`(async()=>{const m=await import('/src/shared/world.js');window.__fbWorld=m.getWorld();return 1})()`);
  R.hudVisible = await ev(`!document.getElementById('hud').classList.contains('hidden')`);
  R.hp = await ev(`document.getElementById('hp-text').textContent`);
  R.metrics = await ev(`window.__fb.metrics()`);
  R.botCount = await ev(`window.__fb.getSession().combat.bots.length`);

  // loot + pickup
  R.loot = await ev(`(()=>{const s=window.__fb.getSession();
    // pilih loot terdekat yang bukan di dalam rumah (jarak >= 8 m dari collider terdekat),
    // supaya pickup/aim tidak terhalang dinding seperti di dunia nyata.
    const p=s.player.position;const w=window.__fbWorld;
    const pick=w.loot.filter(l=>w.colliders.every(c=>Math.hypot(c.cx-l.x,c.cz-l.z)>(Math.max(c.hx,c.hz)+3)))
      .sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
    s.teleport(pick.x,pick.z);return {type:pick.type,kind:pick.kind}})()`);
  await sleep(500);
  R.prompt = await ev(`document.getElementById('prompt-text').textContent`);
  await ev(`window.__fb.getSession().combat.pickup()`);
  await sleep(200);
  R.weaponAfterPickup = await ev(`document.getElementById('weapon-name').textContent`);

  // bidik ke bot terdekat, lalu 5 serangan busur → mati + kill feed
  R.aimSetup = await ev(`(()=>{const s=window.__fb.getSession();const b=s.combat.bots[0];const p=s.player.position;
    const d=s.cameraRig.aimDirection();
    b.mesh.position.set(p.x+d.x*2.0,p.y,p.z+d.z*2.0);
    s.cameraRig.pitch=0;s.cameraRig.userYawOffset=0;return 'ok'})()`);
  await sleep(400);
  R.aimDebug = await ev(`(()=>{const s=window.__fb.getSession();if(!s)return 'NO SESSION';return {dir:s.cameraRig.aimDirection(),ammo:s.combat.inventory[s.combat.slot]?.ammo,botAlive:s.combat.bots[0].alive}})()`);
  const hits = [];
  for (let i = 0; i < 6; i++) {
    await ev(`window.__fb.getSession().combat.cooldown=0`);
    await ev(`window.__fb.getSession().combat.attack()`);
    await sleep(300);
    const h = await ev(`(()=>{const s=window.__fb.getSession();if(!s)return 'NO_SESSION';const b=s.combat.bots[0];return {hp:b.hp,alive:b.alive,ammo:s.combat.inventory[s.combat.slot]?.ammo,dead:s.player.dead,cd:s.combat.cooldown}})()`);
    hits.push(h);
  }
  R.hitSequence = hits;
  R.killFeed = await ev(`[...document.getElementById('killfeed').children].map(e=>e.textContent)`);

  // kematian pemain oleh bot → overlay → respawn otomatis (3 s) + invuln 2 s
  R.death = await ev(`(()=>{const s=window.__fb.getSession();const b=s.combat.bots[1];const p=s.player.position;const d=s.cameraRig.aimDirection();b.mesh.position.set(p.x+d.x*1.2,p.y,p.z+d.z*1.2);b.hitAt=0;return 'ok'})()`);
  R.hpDuringFight = [];
  for (let i = 0; i < 12; i++) {
    await sleep(2000);
    const st = await ev(`(()=>{const s=window.__fb.getSession();if(!s)return 'gone';return {hp:s.player.hp,dead:s.player.dead,overlayHidden:document.getElementById('screen-death').classList.contains('hidden')}})()`);
    R.hpDuringFight.push(st);
    if (st !== 'gone' && !st.dead && st.hp === 100) break;
  }
  R.hpAfterRespawn = await ev(`window.__fb.getSession().player.hp`);
  R.handAfterRespawn = await ev(`JSON.stringify(window.__fb.getSession().combat.inventory)`);

  // exit → lobby + leak check
  await ev(`window.__fb.exitSolo()`);
  await sleep(800);
  R.exit = await ev(`({session:window.__fb.getSession()===null,title:!document.getElementById('screen-title').classList.contains('hidden'),hudHidden:document.getElementById('hud').classList.contains('hidden'),listeners:(async()=>0)()})`);
  R.busListeners = await ev(`(async()=>{const m=await import('/src/core/bus.js');return ['input:attack','input:look','ui:toggleMap'].map(e=>e+':'+m.countListeners(e))})()`);
  R.sceneChildren = await ev(`window.__fb.getSession()===null?'n/a':0`);

  // ---------- Fase B: register/login backend nyata ----------
  if (BACKEND) {
    await ev(`localStorage.setItem('forest-battleground:settings:v1', JSON.stringify({backendBase:'${BACKEND}',quality:'low',sensitivity:1,invertY:false,showFps:false,lastCharacter:'female'}))`);
    await ev(`window.__restoreOrigin=()=>{}`);
    await send('Page.navigate', { url: `${FRONT}?debug=1` });
    await sleep(3000);
    const user = 'qa_' + Math.random().toString(36).slice(2, 8);
    R.authUser = user;
    await ev(`document.getElementById('auth-username').value='${user}'`);
    await ev(`document.getElementById('auth-password').value='kata-sandi-qa-123'`);
    await ev(`document.getElementById('auth-character').value='female'`);
    // dialog konfirmasi server kustom (window.confirm) harus di-auto-accept di headless.
    await send('Page.enable');
    R.dialog = await ev(`(()=>{window.__dialogs=[];const o=window.confirm;window.confirm=(m)=>{window.__dialogs.push(m);return true};return 'patched'})()`);
    R.registerClick = await ev(`document.getElementById('btn-register').click(),'clicked'`);
    await sleep(6000);
    R.authStatus = await ev(`document.getElementById('auth-status').textContent`);
    R.dialogs = await ev(`window.__dialogs`);
    R.authErr = await ev(`(()=>{try{return window.__lastAuthErr||null}catch{return null}})()`);
    R.lobbyData = await ev(`document.getElementById('lobby-data').textContent`);
    R.logoutVisible = await ev(`!document.getElementById('btn-logout').classList.contains('hidden')`);
    R.soloAfterLogin = await ev(`document.getElementById('btn-solo').disabled===false`);
  }
  const fails = verdict(R);
  console.log('REPORT:', JSON.stringify(R));
  console.log('VERDICT:', fails.length ? 'FAIL' : 'PASS');
  for (const f of fails) console.log('  ✗', f);
  console.log('--- console ---');
  for (const l of logs.slice(0, 40)) console.log(l);
  if (fails.length) process.exitCode = 1;
}

function verdict(R) {
  const fails = [];
  const need = (cond, msg) => { if (!cond) fails.push(msg); };
  need(R.webgl === true, 'WebGL tidak aktif');
  need(R.hudVisible === true, 'HUD tidak muncul di Solo');
  need(R.botCount >= 2, 'bot < 2');
  need(R.weaponAfterPickup === 'Pedang' || R.weaponAfterPickup === 'Busur', 'loot tidak terambil');
  const hps = (R.hitSequence || []).map((h) => h.hp);
  need(hps[0] === 80 && hps[4] === 0, `5 hit tidak tepat: ${hps.join(',')}`);
  need((R.killFeed || []).length === 1, 'kill feed kosong');
  const f = R.hpDuringFight || [];
  need(f.some((x) => x.dead && !x.overlayHidden), 'overlay kematian tidak muncul');
  need(f.some((x) => !x.dead && x.hp === 100), 'respawn tidak pulih ke HP 100');
  need(R.hpAfterRespawn === 100, 'HP setelah respawn bukan 100');
  need(JSON.parse(R.handAfterRespawn).every((x) => x === null), 'tangan tidak kosong setelah respawn');
  need(R.exit.session && R.exit.title && R.exit.hudHidden, 'exit tidak bersih');
  need((R.busListeners || []).every((l) => l.endsWith(':0')), 'listener bus bocor setelah exit');
  if (BACKEND) {
    need(/Masuk sebagai/.test(R.authStatus || ''), `register/login gagal: ${R.authStatus}`);
    need(/pemain 0\/8/.test(R.lobbyData || ''), 'online count salah');
    need(R.logoutVisible === true, 'tombol keluar tidak muncul');
    need(R.soloAfterLogin === true, 'Solo tidak bisa setelah login');
  }
  return fails;
}

main().then(() => { chrome.kill(); process.exit(0); }).catch((e) => { console.error('SMOKE FAIL:', e.message); chrome.kill(); process.exit(1); });
