// realtime/index.js — pasang /ws di app Fastify. Satu sumber: gateway + origin guard.
// @fastify/websocket melewati router Fastify (hooks jalan), tapi upgrade yang
// ditolak origin harus CLOSE (1011 tidak pernah terjadi) — jadi guard dipanggil
// manual di dalam handler supaya pesan tutup jelas.
import websocket from '@fastify/websocket';
import { createRealtime } from './gateway.js';

let realtime = null;

export function getRealtime() { return realtime; }

export async function registerRealtime(app, { allowedOrigins, hardCap = 8 } = {}) {
  // maxPayload 16 KiB ditegakkan di transport (prompt Fase 3 butir 2).
  await app.register(websocket, { options: { maxPayload: 16 * 1024 } });

  realtime = createRealtime({ allowedOrigins, hardCap });

  app.get('/ws', { websocket: true }, (socket, req) => {
    realtime.handleConnection(socket, req);
  });

  app.addHook('onClose', async () => realtime?.stop());
  return realtime;
}
