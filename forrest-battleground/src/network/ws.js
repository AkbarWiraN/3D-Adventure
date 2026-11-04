// network/ws.js — klien WSS protokol v1. Token HANYA dari memori (rest.js).
// prompt.md Fase 3 FE butir 1: auth/join flow, reconnect bersih, tanpa retry agresif.
import { getToken, getUser } from './rest.js';
import { CONFIG } from '../config.js';

const AUTH_TIMEOUT_MS = 5000;

/** URL wss:// dari base REST (https -> wss). */
export function wsUrl(base) {
  const u = (base || '').trim().replace(/\/$/, '') || 'https://api-be.bssn.biz.id';
  return u.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:') + '/ws';
}

export class NetClient {
  constructor({ url, onMessage, onStatus } = {}) {
    this.url = url;
    this.onMessage = onMessage || (() => {});
    this.onStatus = onStatus || (() => {});
    this.ws = null;
    this.seq = 0;
    this.sessionId = null;
    this.authed = false;
    this.joined = false;
    this.closedByUs = false;
    this.retries = 0;
  }

  connect() {
    this.closedByUs = false;
    this.onStatus('connecting');
    this.ws = new WebSocket(this.url);

    const authTimer = setTimeout(() => {
      // auth-first: tidak terautentikasi dalam 5 s -> tutup (sama seperti server).
      if (!this.authed) this.close('AUTH_TIMEOUT');
    }, AUTH_TIMEOUT_MS);

    this.ws.addEventListener('open', () => {
      const token = getToken();
      if (!token) { this.close('NO_TOKEN'); return; }
      this.send({ t: 'auth', token });
    });

    this.ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.t === 'auth_ok') { this.authed = true; this.send({ t: 'join', room: 'forest' }); }
      if (msg.t === 'joined') { this.joined = true; this.sessionId = msg.sessionId; this.onStatus('online'); }
      if (msg.t === 'error' && (msg.code === 'TOKEN_EXPIRED' || msg.code === 'TOKEN_INVALID')) {
        this.onStatus('auth_expired');
      }
      this.onMessage(msg);
    });

    this.ws.addEventListener('close', (ev) => {
      clearTimeout(authTimer);
      this.authed = false; this.joined = false;
      if (!this.closedByUs) this.onStatus('disconnected', ev);
    });

    this.ws.addEventListener('error', () => this.onStatus('error'));
    return this;
  }

  send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  /** Intent gerak (bukan posisi). Server yang memegang posisi final. */
  input({ mx, mz, yaw, sprint = false, prone = false, jump = false }) {
    this.send({ t: 'input', v: 1, seq: ++this.seq, mx, mz, yaw, sprint, prone, jump });
  }
  action(kind, slot) { this.send({ t: 'action', v: 1, kind, slot }); }

  /** Exit ke lobby: leave eksplisit + ack; fallback tutup socket. */
  leave() {
    if (this.sessionId) this.send({ t: 'leave', v: 1, sessionId: this.sessionId });
    // Jangan tunggu selamanya: 500 ms lalu tutup apa adanya.
    setTimeout(() => this.close('LEFT'), 500);
  }

  close(reason = 'CLOSED') {
    this.closedByUs = true;
    try { this.ws?.close(1000, reason); } catch { /* sudah tutup */ }
  }
}

export function createClient({ onMessage, onStatus } = {}) {
  return new NetClient({ url: wsUrl(CONFIG.backendBase), onMessage, onStatus });
}
