// password.js — Argon2id via paket argon2 (sudah terpasang & terbukti build).
// prompt.md §4.6: Argon2id, tuned untuk 2 core.

import argon2 from 'argon2';

// Parameter di-benchmark di VPS 2 core (lihat progress.log):
// target ~150-250 ms per hash — cukup mahal untuk brute force, cukup murah untuk login.
// memoryCost 19 MiB (19456 KiB) sesuai rekomendasi OWASP minimum untuk Argon2id.
export const ARGON_OPTIONS = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
});

export async function hashPassword(plain) {
  return argon2.hash(plain, ARGON_OPTIONS);
}

export async function verifyPassword(hash, plain) {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    // Hash rusak/tidak dikenal → jangan pernah melempar ke handler (bocor info).
    return false;
  }
}

/**
 * Butuh hash palsu untuk menyamakan waktu respons saat user tidak ada.
 * Mencegah enumerasi akun lewat timing.
 */
let dummyHashPromise = null;
export function dummyHash() {
  if (!dummyHashPromise) dummyHashPromise = hashPassword('dummy-password-for-timing');
  return dummyHashPromise;
}
