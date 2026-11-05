// probe-page.mjs — kenapa halaman gagal? cetak error module/console nyata.
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
const CHROME = process.env.CHROME_BIN || '/usr/bin/google-chrome';
const FRONT = process.env.FRONT_URL || 'http://127.0.0.1:8099/';
const chrome = spawn(CHROME, ['--headless=new','--no-sandbox','--disable-gpu','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--remote-debugging-port=9111','about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function main() {
  let list = null;
  for (let i = 0; i < 60 && !list; i++) {
    try { list = (await (await fetch('http://127.0.0.1:9111/json/list')).json()).filter((t) => t.type === 'page'); } catch {}
    if (!list?.length) await sleep(250);
  }
  const ws = new WebSocket(list[0].webSocketDebuggerUrl);
  await new Promise((res) => ws.addEventListener('open', res, { once: true }));
  let id = 0; const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled') console.log('[console.' + m.params.type + ']', m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 400));
    if (m.method === 'Runtime.exceptionThrown') console.log('[exception]', m.params.exceptionDetails.text, (m.params.exceptionDetails.exception?.description || '').slice(0, 400));
    if (m.method === 'Log.entryAdded') console.log('[log.' + m.params.entry.level + ']', m.params.entry.text?.slice(0, 300));
  });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result))); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => rej(new Error('timeout ' + method)), 30000); });
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Page.navigate', { url: `${FRONT}?debug=1` });
  await sleep(6000);
  const r = await send('Runtime.evaluate', { expression: `({hasFb: typeof window.__fb, title: document.title, loading: !document.getElementById('loading').classList.contains('hidden'), fatal: document.getElementById('fatal-msg')?.textContent})`, returnByValue: true });
  console.log('STATE:', JSON.stringify(r.result.value));
}
main().then(() => { chrome.kill(); process.exit(0); }).catch((e) => { console.error('ERR', e.message); chrome.kill(); process.exit(1); });
