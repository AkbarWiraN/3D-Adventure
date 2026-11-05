import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
const CHROME = '/usr/bin/google-chrome';
const FRONT = 'http://127.0.0.1:8099/';
const BACKEND = 'http://127.0.0.1:3100';
const PORT = 9750;
const chrome = spawn(CHROME, ['--headless=new','--no-sandbox','--disable-gpu','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader',`--remote-debugging-port=${PORT}`,'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function main() {
  let list = null;
  for (let i = 0; i < 60 && !list; i++) {
    try { list = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter(t => t.type === 'page'); } catch {}
    if (!list?.length) await sleep(250);
  }
  const ws = new WebSocket(list[0].webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  let id = 0; const pending = new Map(); const logs = [];
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled') logs.push(`[${m.params.type}] ` + m.params.args.map(a => a.value ?? a.description ?? '').join(' '));
    if (m.method === 'Runtime.exceptionThrown') logs.push('[exception] ' + JSON.stringify(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result))); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => rej(new Error('timeout ' + method)), 60000); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || '')); return r.result?.value; };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('forest-battleground:settings:v1', JSON.stringify({backendBase:'${BACKEND}',quality:'low',sensitivity:1,invertY:false,showFps:false,lastCharacter:'female'}))` });
  const user = 'dbg_' + Math.random().toString(36).slice(2, 7);
  await fetch(BACKEND + '/api/v1/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:8099' }, body: JSON.stringify({ username: user, password: 'kata-sandi-qa-123', character: 'female' }) });
  await send('Page.navigate', { url: FRONT + '?debug=1' });
  await sleep(3500);
  await ev(`(()=>{window.confirm=()=>true;return 1})()`);
  await ev(`document.getElementById('auth-username').value='${user}'`);
  await ev(`document.getElementById('auth-password').value='kata-sandi-qa-123'`);
  await ev(`document.getElementById('btn-login').click()`);
  await sleep(4000);
  console.log('greeting:', await ev(`document.getElementById('lobby-greeting')?.textContent`));
  await ev(`document.getElementById('btn-lobby-online').click()`);
  await sleep(9000);
  console.log('net state:', JSON.stringify(await ev(`(()=>{const s=window.__fb.getSession();return s&&s.net?{joined:s.net.joined,authed:s.net.authed,url:s.net.url,readyState:s.net.ws?.readyState,sid:s.net.sessionId}:null})()`)));
  console.log('--- console logs ---');
  for (const l of logs.slice(-30)) console.log(l);
}
main().then(() => { chrome.kill(); process.exit(0); }).catch(e => { console.error('ERR', e.message); chrome.kill(); process.exit(1); });
