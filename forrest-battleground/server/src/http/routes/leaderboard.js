// leaderboard.js — baca saja. TIDAK ADA endpoint tulis (prompt.md §4.6 butir 5).
// Kill/death hanya ditulis oleh ledger PvP server pada Fase 3.

import { requireAuth } from '../../auth/requireAuth.js';
import { clampLimit, clampOffset } from '../../auth/validation.js';
import { top, rankOf } from '../../persistence/leaderboardRepo.js';

export async function registerLeaderboardRoutes(app) {
  app.addHook('onRequest', (req, reply, done) => {
    if (req.url.split('?')[0] === '/api/v1/leaderboard' && !['GET'].includes(req.method)) return reply.code(405).send({ error:{code:'METHOD_NOT_ALLOWED',message:'Leaderboard bersifat hanya-baca.'} });
    done();
  });
  app.get('/api/v1/leaderboard', { preHandler: requireAuth }, async (req, reply) => {
    const limit = clampLimit(req.query?.limit, 10, 50);
    const { total: count } = top({ limit: 0, offset: 0 });
    const maxOffset = Math.min(100000,Math.max(0,count-limit));
    const offset = clampOffset(req.query?.offset, maxOffset);
    const mapId = typeof req.query?.mapId === 'string' ? req.query.mapId : 'forest';
    if(mapId!=='forest')return reply.code(400).send({error:{code:'MAP_INVALID',message:'Map tidak dikenal.'}});

    const result = top({ limit, offset });
    return reply.send({ mapId, ...result, pvpActive:false });
  });

  app.get('/api/v1/leaderboard/me', { preHandler: requireAuth }, async (req, reply) => {
    const mine = rankOf(req.user.id);
    if (!mine) {
      return reply.send({
        rank: null, kills: 0, deaths: 0, kdr: 0, total: 0,
        message: 'Belum ada data peringkat.',
      });
    }
    return reply.send({ ...mine });
  });
}
