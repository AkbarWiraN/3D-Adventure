// validation.js — validasi input auth. Satu sumber aturan, tanpa dependency schema.
// prompt.md §4.6: register validation, unique username canonical, generic credential errors.

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

/** Karakter aman: huruf, angka, garis bawah. Tanpa spasi/emoji/kontrol. */
const USERNAME_RE = /^[A-Za-z0-9_]+$/;

/**
 * Username canonical: lowercase, dipakai untuk UNIQUE.
 * Menampilkan username_display asli (case dipertahankan).
 */
export function canonicalUsername(raw) {
  return String(raw).trim().toLowerCase();
}

export function validateUsername(raw) {
  if (typeof raw !== 'string') return { ok: false, code: 'USERNAME_INVALID', message: 'Username wajib berupa teks.' };
  const trimmed = raw.trim();
  if (trimmed.length < USERNAME_MIN || trimmed.length > USERNAME_MAX) {
    return {
      ok: false, code: 'USERNAME_LENGTH',
      message: `Username harus ${USERNAME_MIN}-${USERNAME_MAX} karakter.`,
    };
  }
  if (!USERNAME_RE.test(trimmed)) {
    return {
      ok: false, code: 'USERNAME_CHARSET',
      message: 'Username hanya boleh huruf, angka, dan garis bawah.',
    };
  }
  return { ok: true, value: trimmed, canonical: canonicalUsername(trimmed) };
}

export function validatePassword(raw) {
  if (typeof raw !== 'string') return { ok: false, code: 'PASSWORD_INVALID', message: 'Password wajib berupa teks.' };
  if (raw.length < PASSWORD_MIN) {
    return { ok: false, code: 'PASSWORD_LENGTH', message: `Password minimal ${PASSWORD_MIN} karakter.` };
  }
  if (raw.length > PASSWORD_MAX) {
    return { ok: false, code: 'PASSWORD_LENGTH', message: `Password maksimal ${PASSWORD_MAX} karakter.` };
  }
  // Tidak memaksa simbol: panjang lebih penting, dan aturan ketat mendorong pola lemah.
  if (/^\s+$/.test(raw)) {
    return { ok: false, code: 'PASSWORD_WEAK', message: 'Password tidak boleh hanya spasi.' };
  }
  return { ok: true, value: raw };
}

export function validateCharacter(raw) {
  if (raw === undefined || raw === null) return { ok: true, value: 'male' };
  if (raw !== 'male' && raw !== 'female') {
    return { ok: false, code: 'CHARACTER_INVALID', message: "Karakter harus 'male' atau 'female'." };
  }
  return { ok: true, value: raw };
}

/** Batas paginasi leaderboard (prompt.md: limit bounded). */
export function clampLimit(raw, def = 10, max = 50) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return def;
  return Math.min(n, max);
}

export function clampOffset(raw, max = 100000) {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? Math.min(n, max) : 0;
}
