// app.js — rakit Fastify: logging aman, request ID, error handler, CORS exact, origin guard.
import Fastify from 'fastify';
import crypto from 'node:crypto';
import cors from '@fastify/cors';
import { config } from './config.js';
import { createOriginGuard } from './security/origin.js';
import { registerSystemRoutes } from './http/routes/system.js';

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
    trustProxy: true,
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
  app.addHook('onRequest', createOriginGuard(config.origins));

  // --- Error handler: pesan bersih, tanpa stacktrace ke client.
  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err, reqId: req.id }, 'request gagal');
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    reply.code(status).send({
      error: {
        code: status === 400 ? 'BAD_REQUEST' : status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
        message: status >= 500 ? 'Terjadi kesalahan internal' : err.message,
      },
    });
  });

  await registerSystemRoutes(app);
  return app;
}
