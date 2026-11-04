// server.js — entry point. Bind loopback saja (Nginx yang menghadap publik).
import { buildApp } from './app.js';
import { config } from './config.js';
import { runMigrations } from './persistence/migrate.js';
import { closeDb } from './persistence/db.js';

const app = await buildApp();

// Migrasi saat boot: idempotent, bukan CREATE TABLE per request.
try {
  const applied = runMigrations();
  const fresh = applied.filter((r) => r.status === 'applied').map((r) => r.version);
  app.log.info({ fresh, total: applied.length }, 'migrasi selesai');
} catch (err) {
  app.log.error({ err }, 'migrasi gagal — server tidak dijalankan');
  process.exit(1);
}

try {
  await app.listen({ host: config.host, port: config.port });
} catch (err) {
  app.log.error({ err }, 'gagal listen');
  process.exit(1);
}

// Shutdown rapi: SQLite checkpoint (WAL) sebelum keluar.
let shuttingDown = false;
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ sig }, 'shutdown');
    try { await app.close(); } finally { closeDb(); process.exit(0); }
  });
}
