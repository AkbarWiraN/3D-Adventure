# TASKS — Forrest Battleground (Ancient Survival)

**Sumber kebenaran:** `prompt.md` (spesifikasi induk, 848 baris). File ini hanya status.
**Aturan:** satu putaran cronjob = satu tugas kritikal selesai + terverifikasi. Tandai `[x]` HANYA setelah ada bukti output nyata.

Legenda: `[ ]` belum · `[~]` sedang jalan · `[x]` selesai+terbukti · `[!]` gagal/terblokir · `[M]` PENDING_MANUAL (butuh HP asli)

## Baseline terukur (Fase 1 Ops)

- OS Ubuntu 24.04, kernel 6.8, x86_64
- Node sistem v22.23.3 (dipakai Hermes — JANGAN diubah)
- Node 24.11.0 installed di `/opt/node24` (dipakai backend)
- RAM 3.66 GB (available ~2.5 GB), 2 vCPU, disk 69 GB (20 GB used)
- Port 80/443/3000/3306 kosong; apache2 inactive+disabled, mariadb inactive+disabled
- ufw tidak aktif; htcacheclean masih running (residu, tanpa port)
- `better-sqlite3` + `argon2` build & jalan di Node 24 (terbukti)

---

## FASE 1 — Engine hutan + kontrol + backend skeleton + keamanan origin

### Ops
- [x] [Ops] Baseline VPS tercatat (lihat bagian Baseline di atas)
- [x] [Ops] Node.js 24 LTS di `/opt/node24` (v24.11.0) tanpa mengganggu Node 22 Hermes
- [x] [Ops] systemd unit nonroot untuk backend + enable
  Bukti: `systemctl is-active` → `active`, `is-enabled` → `enabled`; migrasi kedua → `fresh:[]` (idempotent)
- [x] [Ops] Nginx + TLS `api-be.bssn.biz.id` → upstream 127.0.0.1:3000, verifikasi publik
  Bukti: publik `HTTP/2 200` + ACAO tepat + HSTS; tanpa/asing Origin → 403; `/healthz` publik → 403; `http` → 301; LE cert expires 2027-02-02

### Repo
- [x] [Repo] Struktur frontend ESM modular + `src/shared` pure + `server/` + `scripts/` + README + `.gitignore` + `.env.example`
- [x] [Repo] Versi dependensi di-pin + lockfile (server lockfile sudah ada)

### Frontend
- [x] [FE] Boot Three.js ESM pinned/vendor + handler WebGL error/context lost/restored
- [x] [FE] Layar judul/lobby guest/solo + resize/orientation + UI settings
- [x] [FE] Terrain 1024×1024 m deterministic seed, chunk 64 m, ring 2, batas dunia, slope landai
- [x] [FE] Pohon ≥3 varian, semak, rumput pendek/tinggi, batu ≥3 varian, jalan setapak, sun sore, fog/shadow tier
- [x] [FE] Rumah/gubuk dapat dimasuki ≥12, POI/reruntuhan ≥8, colliders sesuai metadata server, loot hotspot
- [x] [FE] InstancedMesh + LOD/culling + material reuse + disposer; monitor draw call/texture/GPU
- [x] [FE] Karakter L/P cosmetic, animasi gerak, kamera third-person 360° halus + camera collision
- [x] [FE] WASD/mouse + sprint + jump + prone; mobile portrait-only joystick kiri, drag-look kanan, multitouch, safe-area
- [x] [FE] Random spawn ≥40 kandidat valid, minimap kiri atas + map overlay zoom/pan + POI, keluar dari Solo ke Lobby
- [x] [FE] Settings backend URL TLS, Test Connection, status + latency + warning custom URL; localStorage nonsecret saja

### Backend
- [x] [BE] Fastify v5 + better-sqlite3 + argon2 terpasang di Node 24 (native addon terbukti jalan)
- [x] [BE] `GET /api/v1/health`, `GET /api/v1/config/public`, healthz loopback, error handler, request ID, Pino aman
  Bukti: `node --test tests/http.test.js` → 10/10 lulus; `curl` Origin sah → 200 + ACAO + Vary; tanpa/asing/null Origin → 403; `/healthz` → `{"ok":true,"db":true}`
- [x] [BE] SQLite WAL + migration runner versioned + schema users/player_stats/elimination_events; FK ON, prepared SQL
  Bukti: `npm run db:migrate` → `001_init: applied`; tabel lengkap; `journal_mode=wal`, `foreign_keys=1`
- [x] [BE] Validasi config + fail-fast production; bind 127.0.0.1:3000; script start/dev/test/db:migrate nyata
  Bukti: `ss` → `LISTEN 127.0.0.1:3000`

### Security
- [x] [Sec] CORS EXACT `https://akbarwiran.github.io` di production; localhost hanya development; OPTIONS + Vary:Origin diuji lewat HTTP server nyata
- [x] [Sec] Tolak Origin asing/null/missing di API browser-facing (kecuali healthz internal); dokumentasikan batas spoofing
  Bukti: curl Origin sah → 200 + ACAO tepat; tanpa Origin → 403; /healthz publik → 403
- [x] [Sec] Nginx/TLS plan, tanpa secret di frontend/repo, build Pages whitelist `dist/` saja; audit dist bebas backend/.env/DB
  Bukti: scripts/build-pages.mjs whitelist 5 entry + audit ganda di CI; dist 32 file tanpa server/.env/sqlite/md; test suite juga menolak private key & argon2id

### QA
- [x] [QA] Unit test Node: spawn deterministic, movement, chunk + world bounds
  Bukti: tests/unit/{world,spawn,chunk}.test.js → 41/41 LULUS (spawn dalam collider, determinisme chunk, batas dunia)
- [x] [QA] HTTP integration test server nyata: Origin valid/tidak valid/preflight, request malformed
  Bukti: server/tests/{http,security}.test.js → 22/22 LULUS; 2 bug nyata ditemukan & diperbaiki (404 tidak terformat, x-request-id hilang)
- [x] [QA] Smoke browser desktop + emulasi mobile portrait; FPS/chunk/drawcall; catat yang belum diuji di HP asli
- [x] [QA] `npm ci`, `npm test`, `npm run build:pages` lulus; update checklist + status + decision log + checkpoint
  Bukti: unit 41/41; HTTP 22/22; build:pages 32 file 2.04 MB audit lolos; benchmark ab 574 req/s 0 failed; deploy Pages commit 0bcdda6 SUCCESS

**DoD Fase 1:** hutan + kontrol playable Solo desktop & portrait, peta + exit jalan; API server nyata jalan di VPS tanpa membuka port Node publik; SQLite migrated; Origin tested; bundle Pages hanya aset frontend.

---

## FASE 2 — Solo combat + register/login/lobby/leaderboard REST nyata
_(IN PROGRESS — browser QA nyata LULUS: Chrome headless + WebGL SwiftShader, `server/tests/browser-smoke.mjs` → VERDICT PASS)_

Terverifikasi di browser sungguhan (bukan klaim):
- Solo guest: loot POI → pedang → 5 hit valid (100→80→60→40→20→0) → kill feed "Bot dikalahkan"
- Pemain mati oleh bot → overlay kematian → respawn otomatis 3 s → HP 100 + tangan kosong
- Keluar ke Lobby: sesi null, HUD hidden, 0 listener bus tersisa (tidak bocor)
- Register → login → lobby: onlineCount 0/8 (authoritative, bukan hitungan akun), peringkat sendiri, leaderboard kosong, tombol Keluar tampil, Solo tetap bisa
- Backend 23/23, unit 42/42, `npm run build:pages` 35 file 2.05 MB audit lolos

Bug nyata ditemukan lewat QA browser ini dan sudah diperbaiki:
1. Respawn loop — `die()` menjaga `player.dead` sehingga `_respawnAt` tak pernah di-set saat pemicu dari luar; sekarang idempoten lewat `_respawnAt`
2. `aimDirection()` memakai `_look` dari frame render lama → bidikan meleset setelah gerak/teleport; sekarang ambil orientasi kamera terkini
3. Kapsul bot memakai y absolut 0.9 padat di terrain; sekarang `terrainHeight(x,z)+0.9`
4. Loot di dalam rumah terhalang dinding (LOS bekerja) — uji memakai loot POI luar

BELUM TERBUKTI: HP asli (FPS/panas/baterai), multitouch sentuh nyata, safe-area notch, CPU/RSS produksi, deploy. Lihat PENDING_MANUAL.

## FASE 3 — Multiplayer authoritative WSS + leaderboard kill/death + exit/rejoin
_(belum dimulai)_

## FASE 4 — Hardening, optimasi VPS, deploy GitHub Pages + Tencent, uji akhir
_(belum dimulai)_

---

## Butuh Keputusan

_(kosong)_

## PENDING_MANUAL (butuh HP asli)

- [M] Uji FPS/panas/baterai di HP Android & iOS nyata — FPS headless 4-8 tidak valid (SwiftShader)
- [M] Uji multitouch joystick + drag-look simultan di layar sentuh nyata
- [M] Cek safe-area notch di iPhone nyata


## PENDING_MANUAL (butuh HP asli)

- [M] [QA] Uji FPS/panas/baterai di HP Android & iOS nyata — FPS headless (4-8) tidak valid karena SwiftShader
- [M] [FE] Uji multitouch joystick + drag-look simultan di layar sentuh nyata
- [M] [FE] Cek safe-area (notch) di iPhone nyata

