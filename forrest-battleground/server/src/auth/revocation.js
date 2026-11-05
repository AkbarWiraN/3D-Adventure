// revocation.js — denylist jti in-memory untuk explicit logout (prompt.md §4.2:
// "opsional token jti denylist in-memory hingga expiry"; token stolen tetap
// berisiko sampai expired — TTL pendek adalah mitigasi utama).
// In-memory karena single-process; denylist hilang saat restart (token max 20 m).

const revoked = new Map(); // jti -> expMs

export function revokeJti(jti, expMs) {
  if (typeof jti !== 'string' || !jti) return;
  if (typeof expMs === 'number' && expMs <= Date.now()) return; // sudah kedaluwarsa
  revoked.set(jti, expMs);
}

export function isRevoked(jti) {
  const exp = revoked.get(jti);
  if (exp === undefined) return false;
  if (exp <= Date.now()) { revoked.delete(jti); return false; }
  return true;
}

export function sweepRevocations() {
  const now = Date.now();
  for (const [jti, exp] of revoked) if (exp <= now) revoked.delete(jti);
}

// HANYA untuk test.
export function _resetRevocations() { revoked.clear(); }
