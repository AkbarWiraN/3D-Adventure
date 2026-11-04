// bus.js — event bus minimal. Menghindari ketergantungan silang antar modul.
const listeners = new Map();

export function on(evt, fn) {
  if (!listeners.has(evt)) listeners.set(evt, new Set());
  listeners.get(evt).add(fn);
  return () => off(evt, fn);
}

export function off(evt, fn) {
  listeners.get(evt)?.delete(fn);
}

export function emit(evt, payload) {
  const set = listeners.get(evt);
  if (!set) return;
  for (const fn of set) {
    try { fn(payload); } catch (err) { console.error(`[bus:${evt}]`, err); }
  }
}

/** Hapus semua listener satu event (dipakai saat keluar Solo). */
export function clear(evt) {
  if (evt) listeners.delete(evt);
  else listeners.clear();
}

export function countListeners(evt) {
  return listeners.get(evt)?.size ?? 0;
}
