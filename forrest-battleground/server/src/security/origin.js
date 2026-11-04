// security/origin.js — kebijakan Origin EXACT (prompt.md §4.3).
// Batas keamanan nyata: ini HANYA melindungi browser. curl/native client
// bisa memalsukan header Origin. Semua endpoint berhak wajib Bearer auth.
export function createOriginGuard(allowedOrigins) {
  const allowSet = new Set(allowedOrigins);

  return function originGuard(req, reply, done) {
    // /healthz internal (loopback-only lewat Nginx) sengaja bebas kebijakan
    // origin supaya monitoring CLI tidak perlu menyamar sebagai browser.
    if (req.url === '/healthz' || req.url.startsWith('/healthz?')) return done();

    const origin = req.headers.origin;
    // Vary selalu diset: respons bergantung pada Origin, baik diizinkan atau tidak.
    reply.header('Vary', 'Origin');

    if (typeof origin !== 'string' || !allowSet.has(origin)) {
      req.log?.warn({ origin: origin ?? null, url: req.url }, 'origin ditolak');
      return reply.code(403).send({
        error: { code: 'ORIGIN_FORBIDDEN', message: 'Origin tidak diizinkan' },
      });
    }
    return done();
  };
}
