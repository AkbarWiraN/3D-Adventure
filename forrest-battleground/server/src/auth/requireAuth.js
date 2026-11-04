// requireAuth.js — preHandler: wajib Bearer token sah.
// prompt.md §4.6: semua rute terlindungi 401 tanpa token, walaupun Origin dipalsukan.
// PENTING: autentikasi TIDAK bergantung pada Origin — Origin hanya menyaring, bukan membuktikan.

import { readBearer, verifyToken } from '../auth/token.js';
import { findById } from '../persistence/usersRepo.js';

export function requireAuth(req, reply, done) {
  const token = readBearer(req.headers);
  if (!token) {
    reply.code(401).send({ error: { code: 'NO_TOKEN', message: 'Perlu login.' } });
    return;
  }

  const res = verifyToken(token);
  if (!res.ok) {
    const code = res.code === 'TOKEN_EXPIRED' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
    reply.code(401).send({
      error: {
        code,
        message: code === 'TOKEN_EXPIRED' ? 'Sesi kedaluwarsa, silakan login ulang.' : 'Token tidak sah.',
      },
    });
    return;
  }

  const user = findById(res.claims.sub);
  if (!user) {
    // Token sah tapi akun sudah tidak ada (mis. DB direset) → perlakukan sebagai tidak sah.
    reply.code(401).send({ error: { code: 'TOKEN_INVALID', message: 'Akun tidak ditemukan.' } });
    return;
  }

  req.user = user;
  req.tokenClaims = res.claims;
  done();
}
