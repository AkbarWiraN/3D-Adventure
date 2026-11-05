// realtime/protocol.js — protokol v1: validasi frame KETAT, satu sumber kebenaran.
// prompt.md Fase 3 butir 2: schema strict, max frame 16 KiB, seq anti-replay.
// PURE (tanpa I/O) supaya bisa diuji tanpa server.
import { PROTOCOL_VERSION, WEAPONS, NETWORK } from '../../../src/shared/constants.js';

export const MAX_FRAME_BYTES = 16 * 1024;
export const AUTH_TIMEOUT_MS = 5000;
export const MAX_INPUT_PER_SEC = NETWORK.MAX_INPUT_PER_SEC;
export const MAX_ATTACK_PER_SEC = NETWORK.MAX_ATTACK_PER_SEC;

const C2S = new Set(['auth', 'join', 'input', 'action', 'leave', 'ping']);
const ACTION_KINDS = new Set(['attack', 'pickup', 'drop', 'throw', 'slot']);

const isStr = (v, max) => typeof v === 'string' && v.length <= max;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isBool = (v) => typeof v === 'boolean';

function fail(code) { return { ok: false, code }; }

/**
 * Parse & validasi satu frame client. Tidak pernah melempar.
 * @param {Buffer|string} raw
 * @returns {{ok:true,type:string,msg:object}|{ok:false,code:string}}
 */
export function parseFrame(raw) {
  let buf;
  try {
    buf = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw), 'utf8');
  } catch { return fail('FRAME_NOT_BUFFER'); }

  if (buf.length === 0) return fail('FRAME_EMPTY');
  if (buf.length > MAX_FRAME_BYTES) return fail('FRAME_TOO_LARGE');

  let msg;
  try { msg = JSON.parse(buf.toString('utf8')); } catch { return fail('FRAME_NOT_JSON'); }
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return fail('FRAME_NOT_OBJECT');

  const t = msg.t;
  if (!isStr(t, 24) || !C2S.has(t)) return fail('TYPE_UNKNOWN');
  // Versi protokol: wajib sama. Pesan tanpa v dianggap v1 (aman, hanya untuk ping).
  if (msg.v !== undefined && msg.v !== PROTOCOL_VERSION) return fail('VERSION_MISMATCH');

  switch (t) {
    case 'ping':
      return { ok: true, type: t, msg: { t, v: PROTOCOL_VERSION } };

    case 'auth': {
      if (!isStr(msg.token, 2048)) return fail('AUTH_BAD_TOKEN');
      return { ok: true, type: t, msg: { t, token: msg.token } };
    }

    case 'join': {
      // Room tunggal 'forest'. Room lain ditolak eksplisit (jangan diam-diam fallback).
      const room = msg.room === undefined ? 'forest' : msg.room;
      if (!isStr(room, 32) || room !== 'forest') return fail('JOIN_BAD_ROOM');
      return { ok: true, type: t, msg: { t, room } };
    }

    case 'input': {
      if (!Number.isInteger(msg.seq) || msg.seq < 0 || msg.seq > 0xffffffff) return fail('INPUT_BAD_SEQ');
      if (!isNum(msg.mx) || !isNum(msg.mz)) return fail('INPUT_BAD_MOVE');
      if (Math.abs(msg.mx) > 1.0001 || Math.abs(msg.mz) > 1.0001) return fail('INPUT_MOVE_RANGE');
      if (!isNum(msg.yaw)) return fail('INPUT_BAD_YAW');
      if (msg.sprint !== undefined && !isBool(msg.sprint)) return fail('INPUT_BAD_FLAGS');
      if (msg.prone !== undefined && !isBool(msg.prone)) return fail('INPUT_BAD_FLAGS');
      if (msg.jump !== undefined && !isBool(msg.jump)) return fail('INPUT_BAD_FLAGS');
      return {
        ok: true, type: t,
        msg: {
          t, seq: msg.seq,
          mx: Math.max(-1, Math.min(1, msg.mx)),
          mz: Math.max(-1, Math.min(1, msg.mz)),
          yaw: msg.yaw,
          sprint: msg.sprint === true,
          prone: msg.prone === true,
          jump: msg.jump === true,
        },
      };
    }

    case 'action': {
      if (!isStr(msg.kind, 16) || !ACTION_KINDS.has(msg.kind)) return fail('ACTION_BAD_KIND');
      if (msg.kind === 'slot' && !(Number.isInteger(msg.slot) && msg.slot >= 0 && msg.slot <= 1)) {
        return fail('ACTION_BAD_SLOT');
      }
      return { ok: true, type: t, msg: { t, kind: msg.kind, slot: msg.slot } };
    }

    case 'leave': {
      // sessionId harus scoped: server bandingkan dengan sid pemilik socket.
      if (!isStr(msg.sessionId, 64)) return fail('LEAVE_BAD_SESSION');
      return { ok: true, type: t, msg: { t, sessionId: msg.sessionId } };
    }
  }
  return fail('TYPE_UNKNOWN');
}

/** Pesan server→client. Satu tempat supaya bentuknya konsisten. */
export function serverMsg(type, extra = {}) {
  return JSON.stringify({ t: type, v: PROTOCOL_VERSION, ...extra });
}

/** Nama senjata untuk HUD (sama dengan client combatRules). */
export function weaponClassOf(item) {
  if (!item) return 'unarmed';
  if (item.type === 'arrows') return 'arrowAmmo';
  return item.type;
}

export function weaponRule(id) { return WEAPONS[id] || WEAPONS.unarmed; }
