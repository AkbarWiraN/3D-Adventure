// auth.js — register/login. prompt.md §4.1, §4.6, §4.3 acceptance H.
import { hashPassword, verifyPassword, dummyHash } from '../../auth/password.js';
import { issueToken } from '../../auth/token.js';
import {
  validateUsername, validatePassword, validateCharacter, canonicalUsername,
} from '../../auth/validation.js';
import { createUser, findByCanonical, getPublicById, toPublicUser } from '../../persistence/usersRepo.js';
import { take as rateTake, check as rateCheck, commit as rateCommit } from '../../security/rateLimit.js';

// Batas laju (prompt.md §4.6). Ketat untuk register, sedang untuk login.
const REGISTER_LIMIT = { max: 5, windowMs: 15 * 60 * 1000 };   // 5 / 15 menit / IP
const LOGIN_IP_LIMIT = { max: 20, windowMs: 15 * 60 * 1000 };  // 20 / 15 menit / IP
const LOGIN_USER_LIMIT = { max: 8, windowMs: 15 * 60 * 1000 }; // 8 / 15 menit / akun

const clientIp = (req) => req.ip || 'unknown';

export async function registerAuthRoutes(app) {
  app.post('/api/v1/auth/register', async (req, reply) => {
    const ip = clientIp(req);
    // Hanya register SUKSES yang menghitung kuota: percobaan gagal validasi
    // (username dipakai, password lemah) tidak boleh menghabiskan kuota orang lain.
    const rl = rateCheck(`register:ip:${ip}`, REGISTER_LIMIT);
    if (!rl.allowed) {
      return reply.code(429).header('Retry-After', rl.retryAfterSec).send({
        error: { code: 'RATE_LIMITED', message: `Terlalu banyak percobaan. Coba lagi dalam ${rl.retryAfterSec} detik.` },
      });
    }

    const body = req.body || {};
    const u = validateUsername(body.username);
    if (!u.ok) return reply.code(400).send({ error: { code: u.code, message: u.message } });

    const p = validatePassword(body.password);
    if (!p.ok) return reply.code(400).send({ error: { code: p.code, message: p.message } });

    const c = validateCharacter(body.character);
    if (!c.ok) return reply.code(400).send({ error: { code: c.code, message: c.message } });

    const hash = await hashPassword(p.value);

    let created;
    try {
      created = createUser({
        display: u.value,
        canonical: u.canonical,
        hash,
        character: c.value,
      });
    } catch (err) {
      if (err.code === 'USERNAME_TAKEN') {
        return reply.code(409).send({ error: { code: 'USERNAME_TAKEN', message: 'Username sudah dipakai. Pilih yang lain.' } });
      }
      throw err;
    }

    const { token, expiresAt } = issueToken({
      sub: created.id, username: created.username, character: created.character,
    });

    req.log.info({ userId: created.id }, 'akun baru terdaftar');
    rateCommit(`register:ip:${ip}`, REGISTER_LIMIT); // kuota hanya naik saat akun benar-benar dibuat
    return reply.code(201).send({ token, expiresAt, user: toPublicUser(created) });
  });

  app.post('/api/v1/auth/login', async (req, reply) => {
    const ip = clientIp(req);
    const rlIp = rateTake(`login:ip:${ip}`, LOGIN_IP_LIMIT);
    if (!rlIp.allowed) {
      return reply.code(429).header('Retry-After', rlIp.retryAfterSec).send({
        error: { code: 'RATE_LIMITED', message: `Terlalu banyak percobaan. Coba lagi dalam ${rlIp.retryAfterSec} detik.` },
      });
    }

    const body = req.body || {};
    const rawUser = typeof body.username === 'string' ? body.username.trim() : '';
    const rawPass = typeof body.password === 'string' ? body.password : '';

    // Pesan SELALU sama untuk user tidak ada / password salah (anti-enumerasi).
    const GENERIC = { code: 'CREDENTIALS_INVALID', message: 'Username atau password salah.' };

    // Batas per akun juga, supaya satu akun tidak bisa dihajar dari banyak IP.
    let canonical = null;
    try { canonical = canonicalUsername(rawUser); } catch { /* diabaikan */ }
    if (canonical) {
      const rlUser = rateTake(`login:user:${canonical}`, LOGIN_USER_LIMIT);
      if (!rlUser.allowed) {
        return reply.code(429).header('Retry-After', rlUser.retryAfterSec).send({
          error: { code: 'RATE_LIMITED', message: `Akun ini terkunci sementara. Coba lagi dalam ${rlUser.retryAfterSec} detik.` },
        });
      }
    }

    if (rawUser.length === 0 || rawUser.length > 64 || rawPass.length === 0 || rawPass.length > 200) {
      return reply.code(401).send({ error: GENERIC });
    }

    const row = findByCanonical(canonical);
    if (!row) {
      // Verifikasi hash palsu: waktu respons serupa walau akun tidak ada.
      await verifyPassword(await dummyHash(), rawPass);
      return reply.code(401).send({ error: GENERIC });
    }

    const ok = await verifyPassword(row.password_hash, rawPass);
    if (!ok) return reply.code(401).send({ error: GENERIC });

    const user = toPublicUser(getPublicById(row.id));
    const { token, expiresAt } = issueToken({
      sub: row.id, username: row.username_display, character: row.character,
    });

    req.log.info({ userId: row.id }, 'login berhasil');
    return reply.send({ token, expiresAt, user });
  });
}
