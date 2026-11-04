// rateLimit.js — pembatas laju in-memory sederhana per IP dan per username.
// prompt.md §4.6: rate limit register/login. Tanpa dependency tambahan.
// Catatan: in-memory = hilang saat restart & tidak lintas proses. Cukup untuk 1 proses.

const buckets = new Map();

/**
 * @param {string} key  mis. "login:ip:1.2.3.4" atau "login:user:andi"
 * @param {{max:number, windowMs:number}} opt
 * @returns {{allowed:boolean, retryAfterSec:number, remaining:number}}
 */
export function take(key, { max, windowMs }) {
  const now = Date.now();
  let b = buckets.get(key);

  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }

  b.count += 1;
  const allowed = b.count <= max;
  return {
    allowed,
    remaining: Math.max(0, max - b.count),
    retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
  };
}

/** Hapus bucket kedaluwarsa secara berkala supaya Map tidak tumbuh tanpa batas. */
export function sweep() {
  const now = Date.now();
  let removed = 0;
  for (const [k, b] of buckets) {
    if (now >= b.resetAt) { buckets.delete(k); removed++; }
  }
  return removed;
}

/** Untuk pengujian. */
export function resetAll() {
  buckets.clear();
}

export function size() {
  return buckets.size;
}

// Sweep tiap 5 menit; unref supaya tidak menahan proses saat test.
const timer = setInterval(sweep, 5 * 60 * 1000);
if (typeof timer.unref === 'function') timer.unref();
