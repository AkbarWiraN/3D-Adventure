// app.js — rakit Fastify: logging aman, request ID, error handler, CORS exact, origin guard.
import Fastify from 'fastify';
import crypto from 'node:crypto';
import cors from '@fastify/cors';
import { config } from './config.js';
import { createOriginGuard } from './security/origin.js';
import { registerSystemRoutes } from './http/routes/system.js';
import { registerAuthRoutes } from './http/routes/auth.js';
import { registerUserRoutes } from './http/routes/users.js';
import { registerMapRoutes } from './http/routes/maps.js';
import { registerLeaderboardRoutes } from './http/routes/leaderboard.js';
import { registerRealtime, getRealtime } from './realtime/index.js';

export async function buildApp(opts = {}) {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || (config.isProd ? 'info' : 'warn'),
      // Jangan pernah log token/password/secret.
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["x-auth-token"]',
          'body.password',
          'body.token',
        ],
        censor: '[REDACTED]',
      },
    },
    genReqId: () => crypto.randomUUID(),
    trustProxy: '127.0.0.1',
    bodyLimit: 16 * 1024, // cap body request (prompt.md §5.2)
    ...opts,
  });

  // --- CORS: SATU sumber kebijakan (Fastify), jangan duplikasi di Nginx.
  await app.register(cors, {
    origin(origin, cb) {
      // Tanpa Origin (curl/monitoring) -> jangan pernah set ACAO. Guard yang memutuskan 403.
      if (typeof origin !== 'string' || !config.origins.includes(origin)) return cb(null, false);
      return cb(null, true);
    },
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: false, // bearer token, bukan cookie
    maxAge: 600,
  });

  // --- Origin guard: exact allowlist, tolak asing/null/missing (kecuali /healthz internal).
  // HANYA untuk request HTTP biasa. Upgrade WebSocket ditangani gateway sendiri
  // (Fase 3): handshake yang ditolak harus CLOSE 1008, bukan balas HTTP 403 —
  // browser tidak bisa membaca body 403 di upgrade.
  app.addHook('onRequest', (req, reply, done) => {
    if (req.url === '/ws' || req.url.startsWith('/ws?')) return done();
    return createOriginGuard(config.origins)(req, reply, done);
  });

  // --- Request ID dikirim balik supaya klien bisa korelasikan log (tanpa bocor isi).
  app.addHook('onSend', async (req, reply) => {
    reply.header('x-request-id', req.id);
  });

  // --- 404 konsisten dengan format error lain (jangan pakai default Fastify).
  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({
      error: { code: 'NOT_FOUND', message: `Rute tidak ditemukan: ${req.method} ${req.url}` },
    });
  });

  // --- Error handler: pesan bersih, tanpa stacktrace ke client.
  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err, reqId: req.id }, 'request gagal');
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    const code =
      status === 400 ? 'BAD_REQUEST' :
      status === 403 ? 'FORBIDDEN' :
      status === 404 ? 'NOT_FOUND' :
      status === 409 ? 'CONFLICT' :
      status === 422 ? 'UNPROCESSABLE' :
      status === 429 ? 'RATE_LIMITED' :
      status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR';
    reply.code(status).send({
      error: {
        code,
        message: status >= 500 ? 'Terjadi kesalahan internal' : err.message,
      },
    });
  });

  await registerSystemRoutes(app);
  await registerAuthRoutes(app);
  await registerUserRoutes(app);
  await registerMapRoutes(app);
  await registerLeaderboardRoutes(app);

  // Fase 3: gateway WSS authoritative di proses yang sama (Origin exact + auth-first).
  // Tidak dipasang saat test HTTP yang tidak membutuhkannya (opts.skipRealtime).
  if (!opts.skipRealtime) {
    await registerRealtime(app, { allowedOrigins: config.origins, hardCap: config.roomHardCap });
  }
  return app;
}
