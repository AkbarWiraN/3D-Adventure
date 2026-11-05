// realtime/gateway.js — satu gateway WSS di proses Fastify yang sama.
// prompt.md Fase 3: Origin handshake exact + auth-first (auth ≤5s atau close).
// Satu session per akun (duplicate login: socket lama ditutup). Tidak menulis posisi ke SQLite.
import { parseFrame, serverMsg, AUTH_TIMEOUT_MS } from './protocol.js';
import { NETWORK } from '../../../src/shared/constants.js';
import { Room } from './room.js';
import { verifyToken } from '../auth/token.js';
import { findById } from '../persistence/usersRepo.js';
import crypto from 'node:crypto';

export function createRealtime({
  allowedOrigins,
  rooms = ['forest'],
  hardCap = 8,
  onLog = () => {},
  heartbeatPingMs = NETWORK.HEARTBEAT_PING_MS,
  heartbeatTimeoutMs = NETWORK.HEARTBEAT_TIMEOUT_MS,
} = {}) {
  const allow = new Set(allowedOrigins || []);
  const room = new Room({ roomId: 'forest', hardCap });

  // sessionId -> socket, userId -> sessionId (satu avatar aktif per akun)
  const sockets = new Map();
  const byUser = new Map();
  const timers = [];

  /** Handshake: Origin harus EXACT sama dengan allowlist production. */
  function checkHandshake(req) {
    const origin = req.headers?.origin;
    // Tidak ada Origin (curl/native) => tolak. Ini filter browser, bukan pengganti auth.
    if (typeof origin !== 'string' || !allow.has(origin)) {
      return { ok: false, code: 'ORIGIN_FORBIDDEN' };
    }
    return { ok: true };
  }

  function closeSocket(socket, code, reason) {
    try { socket.close(code, reason); } catch { /* sudah tutup */ }
  }

  function handleConnection(socket, req) {
    const hs = checkHandshake(req);
    if (!hs.ok) {
      onLog('ws_origin_rejected', { origin: req.headers?.origin ?? null });
      return closeSocket(socket, 1008, hs.code);
    }
    if (room.isFull()) return closeSocket(socket, 1013, 'ROOM_FULL');

    const sessionId = crypto.randomUUID();
    const state = {
      sessionId, socket, authed: false, userId: null, username: null, character: 'male',
      // Heartbeat WS-level: server ping; klien WAJIB pong (browser menjawab otomatis).
      // `lastPongAt` dipakai loop untuk terminate koneksi zombie (koneksi mati tanpa FIN).
      lastPongAt: Date.now(),
      authDeadline: setTimeout(() => {
        if (!state.authed) closeSocket(socket, 1008, 'AUTH_TIMEOUT');
      }, AUTH_TIMEOUT_MS),
    };
    socket.on('pong', () => { state.lastPongAt = Date.now(); });
    timers.push(state.authDeadline);
    sockets.set(sessionId, state);

    socket.on('message', (raw) => {
      // Batas payload keras di transport (16 KiB) — jangan percaya klien.
      const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
      if (buf.length > 16 * 1024) return closeSocket(socket, 1009, 'FRAME_TOO_LARGE');

      const parsed = parseFrame(buf);
      if (!parsed.ok) {
        // Protokol rusak = tutup. Jangan bandingkan pesan belum terautentikasi.
        if (!state.authed) return closeSocket(socket, 1008, parsed.code);
        send(sessionId, 'error', { code: parsed.code });
        return;
      }
      try {
        dispatch(state, parsed.msg);
      } catch (err) {
        onLog('ws_handler_error', { err: String(err?.message || err) });
        if (!state.authed) closeSocket(socket, 1011, 'HANDLER_ERROR');
      }
    });

    socket.on('close', () => {
      clearTimeout(state.authDeadline);
      sockets.delete(sessionId);
      if (state.userId) {
        if (byUser.get(state.userId) === sessionId) byUser.delete(state.userId);
        room.leave(sessionId, 'disconnect');
      }
    });

    socket.on('error', (err) => onLog('ws_socket_error', { err: String(err?.message || err) }));
  }

  function dispatch(state, m) {
    switch (m.t) {
      case 'ping':
        return send(state.sessionId, 'pong');

      case 'auth': {
        if (state.authed) return send(state.sessionId, 'error', { code: 'ALREADY_AUTHED' });
        const res = verifyToken(m.token);
        if (!res.ok) {
          return closeSocket(state.socket, 1008, res.code === 'TOKEN_EXPIRED' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID');
        }
        const user = findById(res.claims.sub);
        if (!user) return closeSocket(state.socket, 1008, 'TOKEN_INVALID');
        state.userId = user.id; state.username = user.username_display; state.character = user.character;
        state.authed = true;
        clearTimeout(state.authDeadline);
        send(state.sessionId, 'auth_ok', { username: user.username_display, character: user.character });
        return;
      }

      case 'join': {
        if (!state.authed) return closeSocket(state.socket, 1008, 'NOT_AUTHED');
        // Satu avatar aktif per akun: tutup socket lama (duplicate login).
        const old = byUser.get(state.userId);
        if (old && old !== state.sessionId && sockets.has(old)) {
          closeSocket(sockets.get(old).socket, 1000, 'DUPLICATE_SESSION');
          sockets.delete(old);
          room.leave(old, 'duplicate');
        }
        byUser.set(state.userId, state.sessionId);
        const p = room.join({
          sessionId: state.sessionId, userId: state.userId,
          username: state.username, character: state.character,
        });
        send(state.sessionId, 'joined', {
          sessionId: state.sessionId,
          room: m.room, worldVersion: room.world.version,
          tickHz: 20, snapshotHz: 10, hardCap: room.hardCap,
          spawn: { x: p.x, y: p.y, z: p.z },
        });
        // Snapshot awal supaya klien tidak perlu menunggu 100 ms pertama.
        send(state.sessionId, 'snapshot', room.snapshotFor(state.sessionId));
        return;
      }

      case 'input': {
        if (!state.authed) return closeSocket(state.socket, 1008, 'NOT_AUTHED');
        const r = room.applyInput(state.sessionId, m);
        if (!r.ok) send(state.sessionId, 'error', { code: r.code });
        return;
      }

      case 'action': {
        if (!state.authed) return closeSocket(state.socket, 1008, 'NOT_AUTHED');
        let r;
        if (m.kind === 'attack') r = room.attack(state.sessionId);
        else if (m.kind === 'pickup') r = room.pickup(state.sessionId);
        else if (m.kind === 'slot') r = room.setSlot(state.sessionId, m.slot);
        else if (m.kind === 'drop') r = room.drop(state.sessionId, false);
        else if (m.kind === 'throw') r = room.drop(state.sessionId, true);
        else r = { ok: false, code: 'ACTION_BAD_KIND' };
        if (!r.ok) send(state.sessionId, 'error', { code: r.code });
        else if (r.hit) send(state.sessionId, 'hit', r.hit);
        return;
      }

      case 'leave': {
        if (!state.authed) return closeSocket(state.socket, 1008, 'NOT_AUTHED');
        // Scoped: hanya pemilik sid yang boleh keluar.
        if (m.sessionId !== state.sessionId) {
          return send(state.sessionId, 'error', { code: 'LEAVE_SESSION_MISMATCH' });
        }
        room.leave(state.sessionId, 'leave');
        byUser.delete(state.userId);
        send(state.sessionId, 'leave_ack', { sessionId: state.sessionId });
        return closeSocket(state.socket, 1000, 'LEFT');
      }
    }
  }

  function send(sessionId, type, extra = {}) {
    const st = sockets.get(sessionId);
    if (!st) return;
    const payload = serverMsg(type, extra);
    if (Buffer.byteLength(payload) > 16 * 1024) return;
    try {
      if (st.socket.readyState === 1) st.socket.send(payload);
    } catch { /* socket mati */ }
  }

  function broadcast(type, extra = {}) {
    const payload = serverMsg(type, extra);
    if (Buffer.byteLength(payload) > 16 * 1024) return;
    for (const st of sockets.values()) {
      if (!st.authed) continue;
      try { if (st.socket.readyState === 1) st.socket.send(payload); } catch { /* mati */ }
    }
  }

  // ------------------------------------------------------------- loop
  let last = 0;
  let snapAcc = 0, mapAcc = 0, hbAcc = 0;
  const loop = setInterval(() => {
    const t = Date.now();
    const dt = last ? (t - last) / 1000 : 0.05;
    last = t;
    room.step(Math.min(dt, 0.1));
    hbAcc += dt;
    if (hbAcc >= heartbeatPingMs / 1000) {
      hbAcc = 0;
      const cutoff = Date.now() - heartbeatTimeoutMs - heartbeatPingMs;
      for (const st of sockets.values()) {
        // Koneksi zombie: pong terakhir sudah melewati satu interval penuh tanpa jawaban.
        // Jangan terminate yang sudah closing/closed (readyState 2/3).
        if (st.socket.readyState >= 2) continue;
        if (st.lastPongAt < cutoff) {
          onLog('ws_heartbeat_timeout', { sessionId: st.sessionId, userId: st.userId });
          try { st.socket.terminate(); } catch { closeSocket(st.socket, 1001, 'HEARTBEAT_TIMEOUT'); }
          continue;
        }
        try { st.socket.ping(); } catch { /* sudah tutup */ }
      }
    }
    snapAcc += dt; mapAcc += dt;
    if (snapAcc >= 0.1) {
      snapAcc = 0;
      for (const sid of [...sockets.keys()]) {
        const st = sockets.get(sid);
        if (st?.authed) send(sid, 'snapshot', room.snapshotFor(sid));
      }
    }
    if (mapAcc >= 0.5) {
      mapAcc = 0;
      for (const sid of [...sockets.keys()]) {
        const st = sockets.get(sid);
        if (st?.authed) send(sid, 'enemy_map', room.enemyMapFor(sid));
      }
    }
  }, 1000 / 20);
  if (typeof loop.unref === 'function') loop.unref();

  room.onEvent = (name, payload) => {
    if (name === 'kill') broadcast('kill', { ...payload });
    if (name === 'join' || name === 'leave') broadcast(name, { ...payload, online: room.onlineCount });
    // Loot: state authoritative. Klien butuh tahu item yang hilang/muncul supaya
    // HUD (prompt pickup) dan mesh dunia konsisten.
    if (name === 'loot_taken') broadcast('loot_taken', { ...payload });
    if (name === 'loot_spawn') broadcast('loot_spawn', { ...payload });
    if (name === 'loot_respawn') broadcast('loot_respawn', { ...payload });
  };

  return {
    room,
    handleConnection,
    /** Tutup sesi WS aktif milik userId (dipakai POST /auth/logout, §4.2). */
    kickUser(userId) {
      const sid = byUser.get(userId);
      if (!sid) return false;
      const st = sockets.get(sid);
      if (!st) return false;
      room.leave(sid, 'revoked');
      byUser.delete(userId);
      closeSocket(st.socket, 1008, 'SESSION_REVOKED');
      return true;
    },
    status() {
      return {
        roomId: room.roomId,
        online: room.onlineCount,
        hardCap: room.hardCap,
        players: [...room.players.values()].map((p) => ({ sessionId: p.sessionId, username: p.username })),
      };
    },
    stop() {
      clearInterval(loop);
      for (const t of timers) clearTimeout(t);
      for (const st of sockets.values()) { try { st.socket.close(); } catch { /* ignore */ } }
      sockets.clear(); byUser.clear();
    },
  };
}
