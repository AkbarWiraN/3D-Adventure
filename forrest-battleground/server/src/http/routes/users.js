// users.js — profil sendiri: baca & ubah karakter. prompt.md §4.1.
import { requireAuth } from '../../auth/requireAuth.js';
import { validateCharacter } from '../../auth/validation.js';
import { getPublicById, setCharacter, ensureStats, toPublicUser } from '../../persistence/usersRepo.js';

export async function registerUserRoutes(app) {
  app.addHook('onRequest', (req, reply, done) => {
    if (req.url.split('?')[0] === '/api/v1/users/me' && !['GET','PATCH'].includes(req.method)) return reply.code(405).send({ error: { code:'METHOD_NOT_ALLOWED', message:'Metode tidak diizinkan.' } });
    done();
  });
  // Profil sendiri — hanya data milik pemanggil (ownership: dari token, bukan dari body).
  app.get('/api/v1/users/me', { preHandler: requireAuth }, async (req, reply) => {
    const row = getPublicById(req.user.id);
    if (!row) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Akun tidak ditemukan.' } });
    return reply.send({ user: toPublicUser(row) });
  });

  // Ubah karakter kosmetik saja. Tidak ada field yang bisa mengubah stats/id.
  app.patch('/api/v1/users/me', { preHandler: requireAuth }, async (req, reply) => {
    const body = req.body || {};
    const keys = Object.keys(body);
    const allowed = ['character'];
    const unknown = keys.filter((k) => !allowed.includes(k));
    if (unknown.length > 0) {
      return reply.code(400).send({
        error: { code: 'FIELD_NOT_ALLOWED', message: `Field tidak boleh diubah: ${unknown.join(', ')}` },
      });
    }

    const c = validateCharacter(body.character);
    if (!c.ok) return reply.code(400).send({ error: { code: c.code, message: c.message } });

    ensureStats(req.user.id);
    const updated = setCharacter(req.user.id, c.value);
    return reply.send({ user: toPublicUser(updated) });
  });
}
