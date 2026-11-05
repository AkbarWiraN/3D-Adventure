# Forest Battleground — Ancient Survival

Third-person 3D open-world survival combat (MVP 4 fase). Frontend Three.js ESM tanpa
build tool (GitHub Pages), backend Fastify + better-sqlite3 + Argon2id di VPS Tencent
(systemd nonroot, nginx TLS reverse proxy, WSS authoritative 20 Hz).

- Frontend (produksi): `https://akbarwiran.github.io/3D-Adventure/forrest-battleground/`
- Three.js **0.180.0** di-pin & di-vendor (`vendor/three.module.js` + `three.core.js`) — tidak pakai CDN `latest`, Solo tahan offline
- Backend  (produksi): `https://api-be.bssn.biz.id` (Node bind `127.0.0.1:3000`, tidak publik)
- Spesifikasi induk: `prompt.md` · Status/bukti: `TASKS.md` · Acceptance: `ACCEPTANCE.md` · Ops/rollback: `OPS_CHECKLIST.md`

---

## 1. Jalankan lokal (development)

Prasyarat: **Node 24 LTS** (di VPS ada di `/opt/node24`; lokal bebas asal ≥22 untuk
frontend, tapi backend wajib Node yang sama dengan saat `npm ci` — native addon
`better-sqlite3`/`argon2` terkunci ke ABI Node).

```sh
# Frontend (tanpa build tool)
npm ci
npm test                 # unit frontend (49)
npm run serve            # http://127.0.0.1:8099 — buka di browser, Solo jalan TANPA backend

# Backend (terminal lain)
cd server
npm ci
cp .env.example .env     # isi AUTH_SECRET: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npm run db:migrate       # migrasi versioned, idempotent (001_init)
npm start                # bind 127.0.0.1:3000
npm test                 # 36 test (http/security/auth/realtime 13, termasuk heartbeat & logout revoke)
```

Browser QA headless (Chrome + WebGL SwiftShader — FPS tidak mewakili HP asli):

```sh
npm run serve &
/opt/node24/bin/node server/tests/browser-smoke.mjs     # Solo→loot→5 hit→death→respawn→exit; register→login→lobby (perlu backend QA)
/opt/node24/bin/node server/tests/online-smoke.mjs      # register→login→Online→WSS join→exit
BACKEND_URL=http://127.0.0.1:3100 QA_USER=... QA_PASS=... /opt/node24/bin/node server/tests/browser-smoke.mjs
```

Gotcha: selalu `PATH=/opt/node24/bin:$PATH` sebelum `npm test`/`npm start` di VPS —
tanpa itu `/usr/bin/node` v22 dipakai dan native addon gagal load (`ERR_DLOPEN_FAILED`).

## 2. Deploy produksi (VPS Tencent + GitHub Pages)

### Backend (sekali pasang)

```sh
# 1. Node 24 di /opt/node24 (jangan sentuh Node sistem milik tool lain)
# 2. Kode + env
cd ~/3D-Adventure/forrest-battleground/server && PATH=/opt/node24/bin:$PATH npm ci
install -m 600 /dev/null .env && $EDITOR .env   # NODE_ENV=production, FRONTEND_ORIGINS=https://akbarwiran.github.io, AUTH_SECRET acak 64 hex, DATABASE_FILE=/var/lib/forest-battleground/game.sqlite
sudo install -d -o ubuntu -g ubuntu /var/lib/forest-battleground
PATH=/opt/node24/bin:$PATH npm run db:migrate
# 3. systemd nonroot + timer ops
sudo systemctl enable --now forest-battleground.service   # User=ubuntu, MemoryMax=1500M, ProtectSystem=full
sudo systemctl enable --now fb-backup.timer               # backup SQLite harian 03:17 (Online Backup API, retensi 7 harian + 4 mingguan)
sudo systemctl enable --now fb-disk-check.timer           # alarm disk <10 GB harian 04:03 (journal)
# 4. nginx TLS (vhost /etc/nginx/sites-available/api-be.bssn.biz.id)
#    :80 → 301 https + ACME challenge; :443 → proxy 127.0.0.1:3000, Upgrade WS, HSTS.
sudo certbot --nginx -d api-be.bssn.biz.id                # LE auto-renew via certbot.timer
sudo nginx -t && sudo systemctl reload nginx
```

DNS/TLS: `api-be.bssn.biz.id` A-record → IP VPS (Cloudflare DNS-only / langsung);
port publik hanya 80/443 (3000 & SQLite tidak terekspos). Default vhost nginx
`return 444` untuk Host asing.

### Frontend (tiap push ke main)

Workflow `.github/workflows/pages.yml` (repo `3D-Adventure`): `npm run build:pages`
(whitelist ketat 5 entry: index/style/src/vendor/favicon) → `audit-dist.mjs` →
gerbang kedua menolak `.env*`/`*.sqlite*`/`*.md` di dist → artifact `_site/forrest-battleground/`.
Semua import relatif — aman di subpath Pages. Tidak ada secret/backend di bundle.

### Verifikasi produksi (smoke terskrip)

```sh
/opt/node24/bin/node server/tests/prod-smoke.mjs   # 14/14 vs api-be.bssn.biz.id:
# origin guard 403/200, 401 tanpa JWT, register/login, users/me, leaderboard,
# forest/status (online=joined WS saja), WS origin-deny 1008, auth+join room,
# forged token 401, logout → revokasi jti (token lama 401)
```

## 3. Backup / restore / rollback

- **Backup**: `server/scripts/backup-db.mjs` (SQLite Online Backup API — konsisten walau
  server menulis; JANGAN `cp` file DB yang sedang WAL). Output `backups/game-*.sqlite`
  mode 0600; retensi harian >7 hari dihapus, backup Senin ≤4 pekan.
- **Restore drill**: `server/tests/restore-drill.mjs` (integrity + row count + query
  leaderboard di DB hasil restore). Sudah didrill nyata di produksi (downtime <60 s).
- **Rollback**: prosedur lengkap kode/DB/frontend/nginx di `OPS_CHECKLIST.md`
  §"Prosedur ROLLBACK". Migrasi additive+idempotent → rollback kode tidak perlu
  rollback schema.

## 4. Variabel lingkungan (`server/.env`, chmod 600, JANGAN commit)

| Var | Contoh | Keterangan |
|---|---|---|
| `NODE_ENV` | `production` | fail-fast bila secret/Origin kosong/wildcard |
| `HOST` / `PORT` | `127.0.0.1` / `3000` | jangan bind 0.0.0.0 |
| `FRONTEND_ORIGINS` | `https://akbarwiran.github.io` | EXACT, tanpa slash/path; localhost hanya development |
| `AUTH_SECRET` | 64 hex acak | JWT HS256; rotate = semua token invalid |
| `ACCESS_TOKEN_TTL_SECONDS` | `1200` | token RAM-only di FE; refresh = login ulang |
| `DATABASE_FILE` | `/var/lib/forest-battleground/game.sqlite` | WAL, foreign_keys=ON |
| `WORLD_SEED` / `WORLD_VERSION` | `20261104` / `forest-v1` | harus sama dgn FE (shared) |
| `ROOM_HARD_CAP` | `8` | 16 lulus load test loopback, tapi produksi tetap 8 sampai uji 2 perangkat nyata |
| `TICK_HZ` / `SNAPSHOT_HZ` / `ENEMY_MAP_HZ` | `20`/`10`/`2` | realtime |
| `COMBAT_LOGOUT_SECONDS` | `10` | jendela kredit kill damager terakhir |

Override khusus QA (JANGAN di produksi): `REGISTER_RATE_MAX` (default produksi
5 register/15 mnt/IP), `WS_HEARTBEAT_PING_MS/WS_HEARTBEAT_TIMEOUT_MS`.

## 5. REST API v1 (ringkas)

Base: `https://api-be.bssn.biz.id`. Browser wajib Origin allowlist; semua route
terproteksi → 401 tanpa Bearer. Body JSON ≤ batas server; error kredensial generik.

| Method | Route | Auth | Fungsi |
|---|---|---:|---|
| GET | `/api/v1/health` · `/api/v1/config/public` | No (Origin) | status + config publik (tanpa secret) |
| POST | `/api/v1/auth/register` · `/login` | No (Origin) | rate-limited; Argon2id ~115 ms/hash @2vCPU |
| POST | `/api/v1/auth/logout` | Yes | revoke jti (denylist in-memory) + tutup WS aktif (1008 SESSION_REVOKED) |
| GET/PATCH | `/api/v1/users/me` | Yes | profil / ganti karakter kosmetik (L/P) |
| GET | `/api/v1/maps` · `/api/v1/maps/forest/status` | Yes | onlineCount = joined WS, bukan akun login |
| GET | `/api/v1/leaderboard?mapId=forest&limit≤50&offset` · `/leaderboard/me` | Yes | read-only; tidak ada route tulis stat |

WSS: `wss://api-be.bssn.biz.id/ws` — Origin exact, auth-first ≤5 s, protocol v1,
frame ≤16 KiB, seq anti-replay, heartbeat ping 30 s / timeout 10 s (zombie di-terminate),
tick 20 Hz, snapshot AoI 10 Hz, minimap musuh anonim 2 Hz.

Kontrak detail + skenario uji: `SPEC.md`/`prompt.md` §4–§7; bukti: `ACCEPTANCE.md` (AT-01..32).

## 6. Panduan UI pemain

- **Lobby** (setelah login): tab Beranda / Karakter (L/P) / Map / Leaderboard / Pengaturan Akun.
- **Solo / Offline Practice**: jalan penuh tanpa server (bot lokal, tidak memengaruhi leaderboard).
- **Main Online**: butuh login; WSS ke room `forest` (cap 8).
- **Desktop**: WASD + mouse 360°, Shift sprint, Space jump, Z prone (toggle), E loot/interact,
  G drop, T lempar, 1/2 ganti slot, klik kiri attack, tahan klik kanan aim bow (scope zoom),
  M map overlay, Esc pause.
- **Mobile**: WAJIB landscape (portrait → rotate-hint); joystick kiri + drag-look kanan
  (multitouch), tombol aksi kanan bawah (SERANG / BIDIK tahan / LONCAT / LEMPAR);
  safe-area notch ditangani env().
- **Keluar ke Lobby** selalu ada (normal/pause/map/layar mati) — idempotent, online count akurat.
- **Pengaturan backend URL**: default resmi; custom URL menampilkan peringatan sebelum
  kirim password; Test Connection (latency/status); ganti server = logout + WS diputus.

## 7. Kebijakan kredensial

Password → Argon2id, token JWT hanya di memori frontend (reload = login ulang),
`.env`/DB/token/password dilarang masuk git/URL/log/localStorage. Origin allowlist
adalah defense-in-depth browser, BUKAN jaminan — nonbrowser bisa spoof Origin, jadi
auth + rate limit + server-authoritative tetap lapisan wajib. Leaderboard tidak bisa
ditulis lewat REST/WS klien (kill hanya dari event PvP server, ledger idempoten).

Status jujur: Fase 1–4 VERIFIED by-test; uji HP asli (FPS/panas/baterai, multitouch
nyata, notch) masih PENDING_MANUAL — lihat `TASKS.md` §PENDING_MANUAL.
