// probe-boot.mjs — berapa lama sampai window.__fb siap?
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
const CHROME = process.env.CHROME_BIN || '/usr/bin/google-chrome';
const FRONT = process.env.FRONT_URL || 'http://127.0.0.1:8099/';
const chrome = spawn(CHROME, ['--headless=new','--no-sandbox','--disable-gpu','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--remote-debugging-port=9113','about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function main() {
  let list = null;
  for (let i = 0; i < 60 && !list; i++) {
    try { list = (await (await fetch('http://127.0.0.1:9113/json/list')).json()).filter((t) => t.type === 'page'); } catch {}
    if (!list?.length) await sleep(250);
  }
  const ws = new WebSocket(list[0].webSocketDebuggerUrl);
  await new Promise((res) => ws.addEventListener('open', res, { once: true }));
  let id = 0; const pending = new Map();
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } if (m.method === 'Runtime.exceptionThrown') console.log('[exc]', m.params.exceptionDetails.text); });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result))); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => rej(new Error('timeout')), 30000); });
  const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
  await send('Runtime.enable'); await send('Page.enable');
  const t0 = Date.now();
  await send('Page.navigate', { url: `${FRONT}?debug=1` });
  for (let i = 0; i < 40; i++) {
    const ok = await ev(`typeof window.__fb === 'object'`);
    if (ok) { console.log('__fb siap setelah', Date.now() - t0, 'ms'); break; }
    await sleep(250);
  }
  const t1 = Date.now();
  await ev(`document.getElementById('btn-solo').click()`);
  for (let i = 0; i < 40; i++) {
    const s = await ev(`window.__fb.getSession() !== null`);
    if (s) { console.log('session siap setelah', Date.now() - t1, 'ms (dari klik)'); break; }
    await sleep(250);
  }
  console.log('metrics:', JSON.stringify(await ev(`window.__fb.getSession()?.metrics()`)));
}
main().then(() => { chrome.kill(); process.exit(0); }).catch((e) => { console.error('ERR', e.message); chrome.kill(); process.exit(1); });
