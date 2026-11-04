// http/routes/system.js — Fase 1: /api/v1/health, /api/v1/config/public, /healthz
import { config } from '../../config.js';
import { getDb } from '../../persistence/db.js';

const STARTED_AT = Date.now();

export async function registerSystemRoutes(app) {
  // --- /healthz: internal, loopback-only (Nginx upstream). Tanpa rincian sensitif.
  app.get('/healthz', async (req, reply) => {
    let dbOk = false;
    try {
      dbOk = getDb().prepare('SELECT 1 AS one').get().one === 1;
    } catch (err) {
      req.log.error({ err }, 'healthz db check gagal');
    }
    if (!dbOk) return reply.code(503).send({ ok: false, db: false });
    return { ok: true, db: true };
  });

  // --- API v1 browser-facing (kena origin guard + CORS)
  await app.register(
    async (scope) => {
      scope.get(
        '/health',
        {
          schema: {
            response: {
              200: {
                type: 'object',
                additionalProperties: false,
                required: ['status', 'version', 'uptimeSec', 'timestamp'],
                properties: {
                  status: { type: 'string' },
                  version: { type: 'string' },
                  uptimeSec: { type: 'integer' },
                  timestamp: { type: 'string' },
                },
              },
            },
          },
        },
        async () => ({
          status: 'ok',
          version: config.version,
          uptimeSec: Math.floor((Date.now() - STARTED_AT) / 1000),
          timestamp: new Date().toISOString(),
        })
      );

      scope.get(
        '/config/public',
        {
          schema: {
            response: {
              200: {
                type: 'object',
                additionalProperties: false,
                required: ['protocolVersion', 'worldVersion', 'mapId', 'roomHardCap', 'supportedFeatures'],
                properties: {
                  protocolVersion: { type: 'integer' },
                  worldVersion: { type: 'string' },
                  mapId: { type: 'string' },
                  roomHardCap: { type: 'integer' },
                  supportedFeatures: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        async () => ({
          protocolVersion: 1,
          worldVersion: config.worldVersion,
          mapId: 'forest',
          roomHardCap: config.roomHardCap,
          // Hanya fitur yang BENAR-BENAR ada di fase ini (jangan klaim palsu).
          supportedFeatures: ['solo', 'settings', 'health', 'config'],
        })
      );
    },
    { prefix: '/api/v1' }
  );
}
