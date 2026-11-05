// probe-solo.mjs — kenapa startSolo menghasilkan session null?
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
const CHROME = process.env.CHROME_BIN || '/usr/bin/google-chrome';
const FRONT = process.env.FRONT_URL || 'http://127.0.0.1:8099/';
const chrome = spawn(CHROME, ['--headless=new','--no-sandbox','--disable-gpu','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--remote-debugging-port=9112','about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function main() {
  let list = null;
  for (let i = 0; i < 60 && !list; i++) {
    try { list = (await (await fetch('http://127.0.0.1:9112/json/list')).json()).filter((t) => t.type === 'page'); } catch {}
    if (!list?.length) await sleep(250);
  }
  const ws = new WebSocket(list[0].webSocketDebuggerUrl);
  await new Promise((res) => ws.addEventListener('open', res, { once: true }));
  let id = 0; const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled') console.log('[console.' + m.params.type + ']', m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 500));
    if (m.method === 'Runtime.exceptionThrown') console.log('[exception]', m.params.exceptionDetails.text, (m.params.exceptionDetails.exception?.description || '').slice(0, 600));
  });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result))); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => rej(new Error('timeout ' + method)), 30000); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return r.exceptionDetails ? { ERR: r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || '').slice(0, 300) } : r.result?.value; };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: `${FRONT}?debug=1` });
  await sleep(4000);
  console.log('before click:', JSON.stringify(await ev(`({sess: window.__fb.getSession()===null, fatalHidden: document.getElementById('fatal').classList.contains('hidden'), fatalMsg: document.getElementById('fatal-msg').textContent.slice(0,200)})`)));
  await ev(`document.getElementById('btn-solo').click()`);
  await sleep(5000);
  console.log('after click :', JSON.stringify(await ev(`({sess: window.__fb.getSession()===null, hudHidden: document.getElementById('hud').classList.contains('hidden'), fatalHidden: document.getElementById('fatal').classList.contains('hidden'), fatalMsg: document.getElementById('fatal-msg').textContent.slice(0,300), loadingHidden: document.getElementById('loading').classList.contains('hidden')})`)));
  // Coba langsung bikin session untuk melihat error aslinya
  console.log('direct try:', JSON.stringify(await ev(`(async()=>{try{const m=await import('/src/core/session.js');const s=new m.SoloSession({canvas:document.getElementById('gl'),screens:{isMapOpen:()=>false,hideMap(){},show(){},showLoading(){},hideLoading(){},showFatal(){}}});return 'OK '+(s?1:0);}catch(e){return 'FAIL '+ (e&&e.message) + ' | ' + (e&&e.stack||'').split('\\n').slice(0,3).join(' <- ');}})()`)));
}
main().then(() => { chrome.kill(); process.exit(0); }).catch((e) => { console.error('ERR', e.message); chrome.kill(); process.exit(1); });
