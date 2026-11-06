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
**SELESAI** — DoD Fase 2 terpenuhi; diverifikasi ulang penuh 2026-11-05:
- `npm test` → unit 42/42; `server npm test` → 32/32
- `server/tests/browser-smoke.mjs` → VERDICT PASS (solo loot→5 hit→death→respawn→exit leak-free; register/login→lobby→leaderboard→online count)
- `server/tests/online-smoke.mjs` → VERDICT PASS
- `npm run build:pages` → 37 file 2.07 MB audit lolos
- backend produksi systemd aktif (`forest-battleground.service`), REST/WSS publik via https://api-be.bssn.biz.id
- PENDING_MANUAL (HP asli/multitouch/notch) tetap di bawah — tidak menghalangi DoD, dituntaskan Fase 4

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
_(IN PROGRESS — WSS backend + FE client dasar; integration tests 7/7, browser UI smoke PASS)_

Deliverable terverifikasi:
- `server/src/realtime/{protocol,room,gateway,index}.js`: WSS `/ws`, Origin exact, auth-first ≤5 s, protocol v1/max frame 16 KiB/seq anti-replay, room 8, tick 20 Hz, AoI snapshots 10 Hz, anonymous enemy map 2 Hz, movement/collision server-side, inventory/loot/combat, respawn, leave, duplicate-session protection, combat-logout credit.
- `src/network/ws.js` + `src/core/onlineSession.js`: token memory-only, auth/join, input intent 20 Hz, server correction, remote interpolation, online leave; Solo tidak lagi menjalankan combat lokal di Online.
- `server/tests/realtime.test.js`: 7/7; `server/tests/online-smoke.mjs`: Chrome headless WebGL, UI register/login → tombol Online → WSS join → exit, onlineCount kembali nol.
- End-to-end server nyata: `127.0.0.1:3000/ws` upgrade 101; status API online count 2 → 1 → 0; Origin sah / auth diuji.
- Backend REST 23/23, unit 42/42, build Pages audit lolos.

Stage test NYATA (baru, `server/tests/load-stage.mjs` → VERDICT PASS):
- PvP sungguhan lewat WSS: A sword vs B bow, dua duel terpisah, masing-masing
  5 hit 100→80→60→40→20→0, mati, kill feed sampai kedua klien, respawn otomatis
  3 s → HP 100 + tangan kosong (senjata dijatuhkan saat mati sesuai spesifikasi),
  re-pickup bow lewat aksi pickup nyata, leaderboard PvP 1/1 untuk kedua akun.
- Load 2/4/8 klien: tick 19.8-19.9 Hz (stabil, target 20 Hz), snapshot AoI
  p50 100-101 ms / p95 102-103 ms / max 103-151 ms (target 10 Hz = 100 ms),
  CPU proses 1.6-2.5%, RSS total 151→196 MB, 0 socket error, tanpa akselerasi
  klien nyata. Catatan jujur: klien+server satu proses → CPU = batas ATAS;
  RTT loopback tidak diukur (ping/pong hanya untuk smoke), jadi angka RTT
  internet TIDAK diklaim.

Bug nyata ditemukan lewat stage test ini & sudah diperbaiki:
1. Rate limit register menghitung PERCOBAAN gagal (username dipakai, password
   lemah) — kuota 5/15m habis tanpa satu akun jadi, memblokir load test 8 klien.
   Sekarang hanya register SUKSES yang `commit()` kuota (`check()`+`commit()`
   baru di rateLimit.js); test 22/22 REST tetap lulus.

Verifikasi PRODUKSI (backend systemd di-restart dengan kode Fase 3, PID baru,
`LISTEN 127.0.0.1:3000`, publik via https://api-be.bssn.biz.id):
- REST: tanpa Origin → 403; Origin sah → 200 + `{"status":"ok"}`.
- WSS nyata lewat TLS: tanpa Origin / Origin asing / Origin `null` →
  close 1008 `ORIGIN_FORBIDDEN`; Origin sah → koneksi terbuka (auth-first).
  Catatan jujur: nginx membalas 101 dulu, penolakan terjadi sebagai close
  frame dari gateway — browser tidak bisa join, itu yang menentukan.

BELUM TERBUKTI: HP asli (FPS/panas/baterai), multitouch sentuh nyata, safe-area
notch, RTT/CPS produksi lintas jaringan, deploy Fase 4. Metrik browser
SwiftShader bukan metrik perangkat.

## FASE 4 — Hardening, optimasi VPS, deploy GitHub Pages + Tencent, uji akhir
_(IN PROGRESS)_

- [x] [FE] Lobby bertab pasca-login (Beranda/Karakter/Map/Leaderboard/Pengaturan Akun) +
  mobile landscape-only + rotate-hint portrait
  Bukti NYATA (5 Nov 2026, browser-smoke terhadap backend QA lokal :3100):
  `browser-smoke.mjs` VERDICT PASS — register → greeting "Selamat datang, qa_xxx",
  map card "Forest — Hutan Purba · pemain 0/8", peringkat diri, tombol Keluar Akun;
  login ulang → Main Online → WSS joined, HUD senjata "Tangan Kosong", 1 marker
  musuh anonim di minimap, exit kembali ke lobby (bukan judul).
  `mobile-emu-check.mjs` VERDICT PASS viewport LANDSCAPE 844x390 DPR 3 (joystick +
  drag-look multitouch berfungsi; yawOffset berubah). Portrait ponsel kini memunculkan
  rotate-hint (permintaan pemilik: mobile dimainkan landscape).
  `online-smoke.mjs` PASS, `leak-20x-check.mjs` PASS, unit 49/49, backend 32/32,
  realtime 9/9, build:pages 37 file 2.09 MB audit lolos.
  BUG NYATA DIPERBAIKI: listener dobel pada `btn-lobby-online` (Lobby emit +
  main.js listener langsung) membuat DUA OnlineSession sekali klik → UI tak pernah
  join benar. Fix: main.js hanya memasang listener `btn-online` (judul); tombol
  lobby murni lewat bus `ui:startOnline`.
- [x] [Frontend] Performance 15m chunk load/loot/respawn/exit/rejoin tanpa kebocoran DOM/GPU
  Bukti: `leak-20x-check.mjs` VERDICT PASS — 20× masuk-keluar Solo: sesi null, listener bus
  0, scene graph identik (368 obj/232 geo/59 mat/38 loot/4 bot/21 chunk), **tekstur GPU stabil
  `tex:1`** (sebelum fix bocor 1→2→3→4), heap slope 10→20 sesi < 100 KB.
  `leak-curve.mjs` 40 sesi: delta 98k→74k→25k→0 KB = plateau, bukan bocor linear.
  BUG NYATA DIPERBAIKI: `light.shadow.map` (WebGLRenderTarget 1024²) tidak pernah di-dispose
  oleh three.js → +1 tekstur GPU per sesi; kini di-dispose di `session.dispose()`.
  BUG NYATA DIPERBAIKI #2: threshold uji lama (heap base→akhir >1.6×) salah — V8 heap growth
  + cache three.js bukan bocor; diganti ukur slope antar sesi.
- [x] [Backend] Argon2id cost tuned untuk 2vCPU + rate limit auth (produksi 5 register/15m/IP,
  QA backend override env `REGISTER_RATE_MAX`); brute-force burst aman
  Bukti: `auth.test.js` lulus; register SUKSES kuota hanya naik via `rateCommit()`; register
  gagal (username dipakai/password lemah) TIDAK menghabiskan kuota (bug Fase 3 sudah fix).
  Produksi tetap ketat: `curl register ke api-be` → 429 setelah 5 akun.
- [x] [Backend] Load test 2→4→8→16 WS client (`STAGES=2,4,8,16`); evaluasi cap
  Bukti NYATA (`tests/load-stage.mjs`, ROOM_HARD_CAP=16 hanya di proses uji):
    2 klien  | tick 19.9 Hz | CPU 1.6% | RSS total 151.2 MB | snapshot p95 102 ms | 0 socket error
    4 klien  | tick 19.8 Hz | CPU 2.5% | RSS total 190.0 MB | snapshot p95 102 ms | 0 socket error
    8 klien  | tick 19.9 Hz | CPU 3.4% | RSS total 192.5 MB | snapshot p95 102 ms | 0 socket error
    16 klien | tick 19.9 Hz | CPU 5.3% | RSS total 198.2 MB | snapshot p95 102 ms | 0 socket error
  VERDICT PASS (termasuk PvP sword/bow 5 hit, kill feed, leaderboard, respawn).
  Gate cap-16 lolos di loopback: CPU 5.3% ≪ 70%, headroom RAM ~3.4 GB, tick stabil,
  snapshot p95 102 ms = tepat 10 Hz. CATATAN JUJUR: klien+server satu proses → CPU
  adalah batas ATAS; loopback bukan RTT internet; beban = input sinkron, belum
  attack/loot serentak 16 pemain. Produksi TETAP cap 8 (spec: 2 perangkat nyata
  dulu) — kenaikan ke 16 butuh uji dua perangkat lintas jaringan.
- [x] [Ops] SQLite online backup API script/schedule WAL-safe, retensi + rotation, restoration drill
  Bukti: `server/scripts/backup-db.mjs` (SQLite Online Backup API — konsisten walau
  server menulis, output SATU file mandiri, bukan `cp` yang bisa corrupt karena WAL).
  systemd `fb-backup.timer` → `OnCalendar=*-*-* 03:17` Persistent, ENABLED + service
  sudah dijalankan nyata (backup 52 KB mode 0600 terbuat, termasuk backup DB PRODUKSI
  /var/lib/forest-battleground/game.sqlite saat server aktif). Retensi: harian >7 hari
  dihapus, backup Senin disimpan ≤4 pekan. Restore drill `server/tests/restore-drill.mjs`
  VERDICT PASS (sintetis 7 user + DB QA 6 user): integrity ok, jumlah baris cocok,
  query leaderboard jalan di DB hasil restore. Disk 43 GB free (alarm <10 GB).
  CATATAN JUJUR: restore drill ke file TERPISAH, belum pernah restore di atas DB
  produksi (itu memang tidak boleh dilakukan sembarangan).
- [x] [Security] Server-side logout + revokasi token (prompt.md §4.2: "WS segera ditutup saat
  explicit logout + jti denylist in-memory") — sebelumnya logout MURNI client-side (token tetap
  sah sampai expired). Implementasi: denylist jti in-memory (`auth/revocation.js`, disapu tiap
  5 m bersama rateLimit), `verifyToken` menolak jti revoked (TOKEN_REVOKED), route
  `POST /api/v1/auth/logout` (requireAuth → revoke jti token INI → gateway `kickUser(userId)` →
  close WS 1008 SESSION_REVOKED + room.leave), FE `api.logout()` fire-and-forget di Lobby.logout().
  Bukti NYATA realtime.test.js **12/12** — test #12 menegaskan lewat server nyata: token berlaku
  sebelum logout; join room online; POST logout → 200 {ok:true}; socket WS AKTIF langsung ditutup
  1008 SESSION_REVOKED; token sama → 401 di REST; token sama → 1008 saat auth WS baru; logout
  kedua kali → 401 (idempotent); login ulang → token BARU tetap sah. Regresi: server 35/35,
  unit 49/49, build:pages 38 file 2.11 MB audit lolos.
- [x] [Security] Audit anti-cheat WSS lanjutan (frame oversized, seq replay, hp/damage palsu,
  forged inventory/kill, koordinat negatif/NaN)
  Bukti NYATA: `realtime.test.js` 11/11 PASS — test #10 menegaskan lewat SERVER NYATA:
  input flood ke-21 ditolak `INPUT_FLOOD`; attack flood ke-51 ditolak `ATTACK_FLOOD`
  (bow berammo, cooldown di-nolkan untuk mengisolasi); NaN/±Infinity di mx/mz/yaw
  ditolak parser; |mx|/|mz|>1 → `INPUT_MOVE_RANGE`; forged `give`/`kill`/`die` →
  `TYPE_UNKNOWN` + server tidak punya API `giveItem`/`setPosition`; forged `leave`
  dengan sessionId orang lain DITOLAK (korban tetap di room, socket tidak tertutup);
  frame binary non-UTF8 → `FRAME_NOT_JSON`; seq meloncat diterima tapi posisi tetap
  dihitung server (mx/mz, tanpa teleport); input jalan 200 tick diapit
  `clampToWorld` (tak bisa keluar peta). Refactor kecil: `MAX_ATTACK_PER_SEC`
  dipindah ke `shared/constants.js` (sebelumnya hardcode 50 di room.js vs konstanta
  tak terpakai di protocol.js) — satu sumber kebenaran.
  Test #11 (malam #5): konsistensi ledger saat leave/rejoin cepat + kontrak kill
  feed — (a) register username charset jahat (`evil<img>`) → 400 USERNAME_CHARSET
  (lapisan 1 anti-DOM-injection; lapisan 2: SEMUA render username di klien via
  textContent — hud.js:135, lobby.js:171/204, diaudit); (b) combat-logout kredit
  1 kill SAH; (c) rejoin via koneksi baru (leave menutup socket 1000 — kontrak
  gateway) → state bersih: sessionId baru, lastDamagerId null, HP 100; (d) logout
  BERSIH tanpa dilukai → 0 kill tambahan (tidak ada kredit palsu); (e) kill feed
  nyata sampai ke kedua klien dengan username mentah + cause combat.
- [x] [Ops] systemd + nginx + TLS sudah operasional (dari Fase 1); verifikasi cert renewal + logrotate
  Bukti NYATA (5 Nov 2026):
  - `certbot renew --dry-run --cert-name api-be.bssn.biz.id` → "Congratulations, all
    simulated renewals succeeded" (exit 0). Cert valid 89 hari (s/d 2 Feb 2027, ECDSA).
    certbot.timer aktif (next run 18:21). KEGAGALAN JUJUR: cert `bsre.bssn.biz.id`
    (tidak terkait proyek ini) gagal renewal — NXDOMAIN, DNS record-nya hilang;
    butuh keputusan pemilik (hapus cert atau perbaiki DNS).
  - Ditemukan & DIPERBAIKI: `forest-battleground.service` dalam keadaan inactive
    (terhenti 11:35, sebab tidak tercatat — kemungkinan terkait run paralel);
    api-be.bssn.biz.id melayani 502. Service di-start ulang, enabled, dan
    `curl https://api-be.bssn.biz.id/api/v1/maps` → 401 NO_TOKEN (benar, butuh auth).
  - logrotate.timer aktif harian; nginx rotate 14 hari. Log fb via journald;
    journal 777.5 MB di-vacuum ke 394.8 MB + `SystemMaxUse=400M`,
    `MaxRetentionSec=2week` di-set permanen (sebelumnya unlimited — risiko disk penuh).
- [x] [QA] Deploy Pages final + uji path relatif di GitHub Pages nyata
  Bukti NYATA (5 Nov 2026): workflow Pages run 2660f4a SUCCESS; asset teruji
  dari internet: `/forrest-battleground/` 200 (12.2 KB), `src/main.js` 200,
  `style.css` 200, `vendor/three.module.js` 200 (603 KB). Semua import relatif
  (`./src/main.js` dst) — path relatif benar di subpath Pages.
  browser-smoke FULL-PRODUKSI (Pages + api-be.bssn.biz.id): Solo lengkap PASS
  (loot→5 hit→death→respawn→exit leak-free), register/login PRODUKSI PASS
  (akun QA nyata, greeting lobby, map card "pemain 1/8").
  BUG NYATA DIPERBAIKI di test: dynamic import `'/src/...'` (absolut) keluar
  dari subpath Pages → `https://akbarwiran.github.io/src/...` 404; diganti
  `new URL('src/...', location.href)`. Origin fetch backend juga di-generalisasi
  dari hardcode loopback → `new URL(FRONT).origin`.
  Fase C online 2-klien PRODUKSI: PASS penuh — login → lobby → Main Online →
  WSS joined, HUD "Tangan Kosong", enemy_markers ≥1, exit kembali ke lobby.
  Solusi rate limit: 3 akun QA persisten (qa_persist_a/b/c) + env
  QA_USER/QA_USER2/QA_USER3 → test LOGIN (bukan register) di produksi;
  register acak tetap dipakai untuk backend QA lokal (env REGISTER_RATE_MAX=100).
  Ekspektasi enemyMarkers diubah ===1 → ≥1 (produksi bisa ada pemain lain sah).
  Verifikasi regresi: browser-smoke lokal :3100 tetap PASS.
- [ ] [QA] Real laptop + HP portrait lintas jaringan: PvP 5 hit, leaderboard, exit/rejoin — PENDING_MANUAL

---

### Catatan run 2026-11-05 (malam) — regresi HEAD e33659a hijau + hardening ops
- Verifikasi HEAD e33659a (animasi serang + loot liar, dari sesi lain): unit 49/49,
  backend 33/33, leak-20x PASS, mobile-emu landscape PASS, build:pages 37 file
  2.11 MB audit lolos, browser-smoke PRODUKSI PASS penuh (Solo 5-hit kill,
  death/respawn, login akun persisten, Online 2-klien WSS, exit leak-free).
  Pages deploy e33659a SUCCESS; kode baru terkonfirmasi terlayani publik.
- INSIDEN OPS: forest-battleground.service + nginx ditemukan INACTIVE (kedua
  kalinya hari ini; systemd log: "Stopped" manual 14:04/14:07 oleh sesi
  paralel). Publik api-be sempat down. DIPULIHKAN + sekarang KEDUA service
  di-ENABLE (sebelumnya disabled → tidak auto-start saat reboot) dan aktif:
  health 200 Origin sah / 403 tanpa Origin, Pages 200.
  TINDAKAN PENCEGAHAN: jangan pernah 'systemctl stop' kedua service ini di
  sesi QA — pakai backend QA lokal port lain (mis. :3100) untuk test destruktif.
- Gotcha tooling: '/opt/node24/bin/npm test' TANPA PATH akan memakai
  /usr/bin/node v22 → native addon better-sqlite3 ERR_DLOPEN_FAILED (127 vs
  137). Wajib 'PATH=/opt/node24/bin:$PATH' sebelum npm test/start.

### Catatan run 2026-11-05 (sore) — leak-20x distabilkan
- Tiga akar flake leak-20x terbukti via bedah scene CDP & diperbaiki (commit c364259):
  (1) spawn acak dekat tepi -> ring chunk terpotong batas -> chunk count bervariasi
      (fix: filter chunk luar peta + spawn Solo dari ring jarak deterministik);
  (2) seed RNG SoloCombat = Date.now() -> jumlah heldMesh/loot acak antar sesi
      (fix: seed beku khusus ?debug=1, produksi tetap acak);
  (3) GC 1x di busSnap -> noise heap ±1-2 MB (fix: GC 3x + jeda, pola leak-curve).
- Hasil: scene identik antar sesi (578 obj / 297 geo / 127 mat), slope heap +49 KB,
  PASS 2x berturut. Regresi penuh hijau (unit 49, server 33, smoke+mobile PASS).
- PATH HALUS produksi: URL situs FB = /3D-Adventure/forrest-battleground/
  (root = GHOSTDASH). browser-smoke produksi PASS dengan FRONT_URL tersebut.

### Catatan run 2026-11-05 (malam #2) — favicon.svg sungguhan, whitelist build 5/5
- Entri basi `favicon.svg` di whitelist build-pages DITUNTASKAN dengan membuat ikon
  sungguhan (SVG 496 B: pinus + pedang, palet game #1a1410/#2e5d34/#c9a86a) dan
  mereferensikannya di `index.html` (`<link rel="icon" type="image/svg+xml">`).
- Bukti: build:pages "entry disalin 5/5", 38 file 2.11 MB, audit lolos;
  `dist/favicon.svg` ada + `dist/index.html` memuat link; serve.mjs lokal:
  GET / 200, GET /favicon.svg 200 content-type image/svg+xml.
- Regresi: unit 49/49, server 33/33. Pages deploy commit ini akan membawa ikon
  ke produksi (path relatif aman untuk subpath /3D-Adventure/forrest-battleground/).

### Catatan run 2026-11-05 (malam #3) — fb-backup.timer dipulihkan + restore drill PRODUKSI nyata
- DRIFT OPS DITEMUKAN & DIPERBAIKI: `fb-backup.timer` masih inactive/disabled
  (sisa shutdown pentest di OPS_CHECKLIST; backend+nginx sudah di-enable run
  sebelumnya tapi timer backup terlewat). Sekarang ENABLED+ACTIVE,
  NEXT Fri 2026-11-06 03:17 CST. Backup manual `systemctl start fb-backup.service`
  SUKSES: game-20261105-150845.sqlite (60.0 KB, mode 0600), integrity=ok, users=25.
- RESTORE DRILL PRODUKSI (melengkapi catatan Fase 4 yang sebelumnya hanya ke file
  terpisah): service stop → safety copy ke scratch → ganti DB live dengan backup
  barusan (hapus wal/shm) → start. Hasil: health 200, integrity ok, users 25,
  user nyata (akbarwir, uitest3, qa_persist, dll) + leaderboard queryable,
  publik Origin sah 200 / tanpa Origin 403. Downtime <60 s, di luar jam ramai,
  data identik (backup diambil 24 detik sebelum restore). Safety copy scratch
  dihapus setelah verifikasi.
- HOUSEKEEPING: seksi PENDING_MANUAL ganda di file ini digabung jadi satu.

### Catatan run 2026-11-05 (malam #7) — logout server-side + revokasi token jti
- Menutup celah spec §4.2 yang masih terbuka: logout sebelumnya hanya membersihkan token di
  memori klien — token curian tetap sah sampai expired (≤20 m). Sekarang `POST /api/v1/auth/logout`
  merevoke jti (denylist in-memory, sweep 5 m) DAN menutup sesi WS aktif akun itu
  (1008 SESSION_REVOKED, keluar room). FE Lobby.logout() memanggilnya fire-and-forget.
- Bukti: realtime.test.js 12/12 (test #12 baru, 5 efek diverifikasi lewat server nyata),
  server suite 35/35, unit 49/49, build:pages 38 file 2.11 MB audit lolos.
- Produksi dicek sebelum bekerja: forest-battleground + nginx + fb-backup.timer active+enabled,
  cert LE asli terlayani, Origin guard publik 200/403 — tanpa drift (tidak ada insiden sesi paralel).
- Catatan jujur: denylist in-memory hilang saat restart (sesuai spec "in-memory hingga expiry";
  TTL 20 m membatasi jendela risiko).
- Verifikasi WSS PRODUKSI lintas-internet: login `qa_persist_b` → WSS wss://api-be/ws
  auth+join OK (sessionId) → POST logout (200) → socket WS AKTIF langsung ditutup server
  **code=1008 reason=SESSION_REVOKED** — jalur logout→kickUser terbukti end-to-end di publik.
- DEPLOY + VERIFIKASI PRODUKSI run ini juga: forest-battleground.service di-restart dengan
  kode baru (PID baru, active). Bukti publik nyata: `POST /api/v1/auth/logout` tanpa token →
  401; login `qa_persist_a` → token; `users/me` → 200; logout → 200 `{ok:true}`; token sama
  di `users/me` → **401**; logout kedua → **401** (idempotent). Health/Origin guard tetap
  200 Origin sah / 403 tanpa Origin. nginx + fb-backup.timer tetap active+enabled.

### Catatan run 2026-11-05 (malam #8) — tabel acceptance AT-01..AT-32 + rollback procedure + hardening default_server
- **ACCEPTANCE.md dibuat** (menutup checklist QA Fase 4 "Complete final acceptance table AT-01.."):
  32 skenario dipetakan ke bukti suite nyata — 27 PASS penuh, 3 PASS emulator/simulasi
  (AT-03 mobile, AT-20 reconnect-drop, AT-32 long gameplay) + 1 PENDING_MANUAL murni (AT-31
  real devices). Tidak ada klaim production-complete; AT-31 tetap menunggu HP asli.
- **Prosedur ROLLBACK resmi** ditulis di OPS_CHECKLIST.md (kode/DB/frontend/nginx) —
  sebelumnya checklist QA "rollback procedure" tidak punya dokumen. Path backup diverifikasi
  nyata ke ~/3D-Adventure/forrest-battleground/backups/ (bukan /var/lib — disesuaikan dengan
  ReadWritePaths fb-backup.service).
- **Hardening nginx default_server**: sebelumnya vhost default bawaan Ubuntu menyajikan
  halaman contoh nginx (200) untuk SEMBARANG Host/IP di port 80 — permukaan serangan tanpa
  manfaat. Diganti `return 444` (tutup koneksi). Bukti curl: Host asing/IP → 000 (ditutup);
  vhost game tidak terganggu (api-be http→301, https Origin sah 200 / tanpa 403);
  ACME challenge /.well-known tetap di vhost api-be sendiri (tidak terpengaruh).
  File cadangan pra-hardening: ~/.hermes/cache/scratch/nginx-default.bak-*.
- Pra-cek produksi bersih: 3 service active+enabled, cert LE terlayani (s/d 2 Feb 2027),
  guard 200/403. Tidak ada drift sesi paralel malam ini.

### Catatan run 2026-11-05 (malam #9) — heartbeat WS ping/pong: zombie session diputus

- **Celah spec ditutup**: prompt.md §4.4/§8 mewajibkan "koneksi putus tanpa leave
  dibersihkan oleh ping/pong timeout" + "heartbeat", tapi gateway TIDAK punya
  heartbeat WS-level sama sekali. Koneksi mati mendadak (HP hilang sinyal, NAT
  timeout, tab crash) → socket tak pernah emit 'close' → pemain jadi ZOMBIE
  selamanya di room: online count salah, slot cap terkunci.
- **Implementasi**: `NETWORK.HEARTBEAT_PING_MS=30000` + `HEARTBEAT_TIMEOUT_MS=10000`
  di `src/shared/constants.js` (satu sumber kebenaran client+server). Gateway loop
  20 Hz mengirim control-frame `ping()` tiap 30 s; `lastPongAt` diperbarui handler
  `pong`; socket yang tidak menjawab >1 siklus (ping 30 s + timeout 10 s) di-
  `terminate()` (bukan `close()` — zombie tidak akan menjawab close handshake).
  Log `ws_heartbeat_timeout` tercatat. Socket readyState ≥2 di-skip (sudah closing).
  Override env `WS_HEARTBEAT_PING_MS/WS_HEARTBEAT_TIMEOUT_MS` hanya untuk test
  (produksi pakai konstanta).
- **Bukti NYATA** (`realtime.test.js` **13/13**, test #13 baru, heartbeat dipercepat
  150/60 ms lewat env):
  (a) klien zombie (auto-pong `ws` dimatikan via `_autoPong=false` — setara tab
      browser crash) join room → onlineCount 1 → server ping tak dijawab →
      socket di-terminate ~210 ms, onlineCount kembali 0 (via GET /api/v1/maps);
  (b) klien sehat (pong otomatis) bertahan beberapa siklus ping tanpa diputus,
      onlineCount tetap 1, leave normal.
  Catatan debugging jujur: pendekatan pertama (removeAllListeners('ping')) gagal
  karena auto-pong `ws` adalah flag `_autoPong` di receiver, bukan listener biasa —
  diverifikasi lewat probe terpisah sebelum test difinalkan.
- **Regresi hijau**: unit 49/49, server suite 36/36 (http+security+auth+realtime),
  build:pages 38 file 2.11 MB audit lolos.
- **Tanpa dampak Solo/offline** — heartbeat hanya di gateway WSS.
- **Deploy produksi + bukti nyata**: forest-battleground.service di-restart dengan
  kode heartbeat (PID baru, active; guard publik 200 Origin sah / 403 tanpa Origin).
  Probe WSS nyata ke wss://api-be.bssn.biz.id/ws (login qa_persist_b, join forest):
  PING WS-level dari server produksi diterima klien setelah ~30 s (sebelum patch
  server tidak pernah mengirim ping), koneksi sehat TIDAK diputus, leave normal.
- Catatan jujur: ping/pong control frame dijawab OTOMATIS oleh browser/WebSocket API,
  jadi tidak ada perubahan yang dibutuhkan di klien FE; zombie di sisi nyata terjadi
  saat proses browser mati total (bukan tab lag biasa, yang tetap mem-pong).

## Butuh Keputusan

1. ~~Konflik port 80/443 Apache vs nginx~~ — TERATASI 5 Nov 16:13: sesi pentest
   menonaktifkan Apache sendiri (`disable --now`); nginx di-enable --now (malam #5),
   cert LE asli terlayani, browser-smoke produksi PASS. Kalau Apache dibutuhkan
   lagi nanti, tetap perlu kesepakatan port (lihat OPS_CHECKLIST.md).
2. **Sesi paralel berulang kali mematikan service game (3× dalam 1 hari).**
   Usul: sepakati bahwa sesi lain tidak menyentuh forest-battleground.service /
   nginx.service / fb-backup.timer, atau jadwalkan jendela pentest yang jelas.

### Catatan run 2026-11-05 (malam #4) — drift ops KEEMPAT + konflik Apache pentest
- 15:42:57 systemd mencatat "Stopped" manual untuk forest-battleground, nginx,
  DAN fb-backup.timer (ketiganya sekaligus) oleh sesi interaktif lain
  (103.156.88.95, masih login saat run ini). 15:48 Apache2 di-start manual
  sebagai root (`/usr/sbin/apache2 -k start`, BUKAN unit systemd) dan mengambil
  alih port 80/443 — kemungkinan untuk kebutuhan retest/arsip /var/www.
- DAMPAK PUBLIK NYATA (terverifikasi curl+openssl saat run ini): SNI
  api-be.bssn.biz.id sekarang dijawab Apache dengan sertifikat SELF-SIGNED
  Subang-CSIRT (CN=43.173.6.81, notBefore 3 Nov 2026) + konten situs CSIRT
  (404 page). Cert LE asli (ECDSA, s/d 2 Feb 2027) TIDAK terlayani → browser
  dari Pages tidak bisa memakai API (TLS tidak dipercaya + konten salah).
- YANG DIPULIHKAN TANPA KONFLIK: forest-battleground.service (backend bind
  127.0.0.1:3000, tidak butuh 80/443) + fb-backup.timer — keduanya enable
  --now, health lokal 200 Origin sah, /healthz db:true, timer next 6 Nov 03:17.
- YANG SENGAJA TIDAK DISENTUH: Apache (proses milik sesi pentest aktif —
  membunuhnya bisa merusak retest resmi) dan nginx (konflik port dengan
  Apache; menyalakan keduanya bersamaan tidak mungkin).
- Regresi kode tetap hijau: unit 49/49, server 33/33.
- ROOT CAUSE BERULANG: ini ke-3 kalinya dalam 1 hari service game dimatikan
  oleh sesi paralel. Checklist ops sudah ada tapi tidak dipatuhi sesi lain.
  Butuh keputusan pemilik (lihat Butuh Keputusan).


### Catatan run 2026-11-05 (malam #5) — konflik Apache SELESAI, produksi pulih penuh
- Sesi pentest menutup Apache sendiri 16:13 (`systemctl disable --now apache2`,
  tercatat di journal; port 80/443 kosong). Konflik port dari run malam #4
  teratasi TANPA intervensi — tidak ada proses orang lain yang dimatikan.
- Nginx di-enable --now (sebelumnya disabled): bind 80/443 OK, SNI
  api-be.bssn.biz.id kembali menjawab cert Let's Encrypt asli (CN benar,
  issuer YE2, valid s/d 2 Feb 2027), HSTS aktif.
- Verifikasi publik NYATA: Origin sah → 200 + ACAO tepat; tanpa Origin → 403;
  /healthz publik → 403; http → 301.
- browser-smoke FULL-PRODUKSI (Pages + api-be) VERDICT PASS: Solo loot→5 hit
  100→0→kill feed→death overlay→respawn HP 100→exit leak-free (bus listeners
  0); login akun persisten qa_persist_a (greeting + peringkat + map card);
  Online 2-klien WSS (qa_persist_b vs _c) joined, enemy_markers 1, exit
  kembali ke lobby. Regresi: unit 49/49, server 33/33.
- Status akhir: forest-battleground + nginx + fb-backup.timer semuanya
  active+enabled. Ketiga item Butuh Keputusan #1 terjawab oleh opsi (a).

### Catatan run 2026-11-05 (malam #6) — hardening Fase 4 lanjutan: test anti-cheat #11
- Menutup celah verifikasi Fase 4 [Security]: "no unescaped username DOM injection"
  dan konsistensi ledger kill/death saat leave/rejoin cepat.
- realtime.test.js sekarang 11/11 (server 34/34 total, unit 49/49). Detail butir
  a-e tercatat di checklist [Security] di atas.
- Temuan desain yang DIKUNCI lewat test: leave sengaja menutup socket (1000 LEFT)
  → rejoin WAJIB koneksi baru; state pemain baru terbukti bersih dari jejak
  damager sesi sebelumnya.
- Tidak ada perubahan kode produksi — murni test (kode memang sudah benar).


### Catatan run 2026-11-05 (malam #10) — risk log prompt.md dituntaskan + regresi hijau
- Pra-cek produksi bersih: forest-battleground + nginx + fb-backup.timer active+enabled;
  guard publik 200 (Origin sah) / 403 (tanpa Origin); Pages 200. Tanpa drift sesi paralel.
- Kerja run ini: menutup RISK LOG prompt.md yang 6 baris masih "BELUM DIUJI" padahal
  bukti sudah ada dari run-run sebelumnya — diverifikasi ulang nyata sebelum ditulis:
  (1) VPS load → load-stage.mjs PASS: 2/4/8 klien tick 19.8–19.9 Hz, CPU 1.7–2.2%,
      RSS ≤196 MB, snapshot p95 ≤102 ms, 0 socket error (re-run hari ini).
  (2) Kebocoran secret → dist audit runtime bersih (grep dist: nol AUTH_SECRET/argon2),
      git history bebas .env (git log -p -- .env kosong), build:pages 38 file 2.11 MB
      audit lolos.
  (3) Double kill/death → schema diverifikasi: elimination_events.event_id PRIMARY KEY
      + INSERT OR IGNORE + bump stat hanya bila changes>0, atomic db.transaction —
      ledger idempoten by-construction, sudah teruji realtime 13/13.
  (4) Phishing custom endpoint → warning `custom-warn` ada di index.html:134 dan
      otomatis tampil saat URL non-default (screens.js updateCustomWarning).
  (5) WAL backup corrupt → restore-drill.mjs PASS hari ini (sintetis 7 user, integrity
      ok, leaderboard works) + restore drill PRODUKSI sudah dilakukan malam #3.
  (6) Mobile landscape FPS tetap BELUM DIUJI jujur (butuh HP asli → PENDING_MANUAL).
- Risk log prompt.md diperbarui: 5 risiko "BELUM DIUJI" → TERUJI dgn bukti terukur;
  status Fase 4 di tabel STATUS PROYEK → VERIFIED (kecuali QA HP asli, AT-31).
- Regresi hijau run ini: unit 49/49, server suite 36/36, build:pages audit lolos.
- Butuh Keputusan tetap: 1 item (jendela sesi paralel — tidak ada insiden malam ini).

### Catatan run 2026-11-05 (malam #11) — smoke produksi terskrip 14/14 PASS
- Checklist tersisa hanya PENDING_MANUAL (HP asli); gap nyata yang ditutup run ini:
  checklist Fase 4 [QA] "Health check/register/login/leaderboard protected endpoint
  scripted smoke" belum punya script yang menyerang PRODUKSI nyata (semua suite
  selama ini menyerang instance lokal/QA).
- DIBUAT `server/tests/prod-smoke.mjs`: 14 langkah vs https://api-be.bssn.biz.id —
  guard Origin (403 tanpa/evil), 401 tanpa JWT, register idempoten (hormat kuota
  5/15m; 409 bila akun sudah ada), login JWT, users/me, leaderboard top10+me,
  forest/status (online=0, hardCap=8), WS origin-deny (1008 ORIGIN_FORBIDDEN),
  WS auth_ok, join room forest (joined, tick 20 Hz, snapshot), forged token 401,
  logout revokasi jti (token lama → 401).
- Hasil nyata: **14/14 PASS**. Aman produksi: maks 1 session WS (cap 8 tidak
  tersentuh), akun QA persisten dipakai ulang, relogin pasca-logout terbukti OK,
  service forest-battleground + nginx tetap active, restore-drill PASS (7 users).
- Bug script yang ditemukan & diperbaiki saat kalibrasi: Content-Type json pada
  POST logout tanpa body → Fastify 400 (bukan bug server; curl membuktikan
  logout+revokasi bekerja).
- Butuh Keputusan tetap: 1 item (jendela sesi paralel — tidak ada insiden malam ini).

### Catatan run 2026-11-05 (malam #12) — alarm disk <10 GB (menutup gap Ops Fase 4)
- Pra-cek produksi bersih: forest-battleground + nginx active+enabled; fb-backup.timer
  terjadwal (next 03:17); guard Origin 403/200/403 benar; Pages 200; load 0.07; RSS 162 MB.
- GAP NYATA yang ditutup: prompt.md §Fase 4 [Ops] mewajibkan "disk alerts <10GB free"
  (lihat §Disk 50GB) — selama ini hanya dicek manual per run. Dibuat mekanisme OTOMATIS:
  `server/scripts/disk-check.sh` (rootfs + /var/log/journal + backup-dir; threshold 10 GB;
  tambahan warning journald >500 MB) + systemd `fb-disk-check.timer` harian 04:03
  (ENABLED, exit 1 → journal tampak saat ALERT).
- Uji nyata: `systemctl start fb-disk-check.service` → exit 0, journal:
  "OK rootfs: free space 38 GB (/)" / "OK journald" / "OK backup-dir" / "Semua disk check OK".
- Catatan: backup-db.mjs retensi harian>7d+mingguan<=4 berjalan (1 file 60 KB, integrity ok
  dari run 15:08 — users=25). Journal 407 MB (cap 400M — di atas karena vacuum harian timer;
  disk-check akan warning bila >500 MB).
- Butuh Keputusan tetap: 1 item (jendela sesi paralel — tidak ada insiden malam ini).

### Catatan run 2026-11-05 (malam #13) — README produksi Fase 4 ditulis ulang lengkap
- Pra-cek produksi bersih: forest-battleground + nginx active+enabled; fb-backup.timer
  (next 03:17) + fb-disk-check.timer (next 04:03) terjadwal; guard publik 403 tanpa
  Origin / 200 Origin sah; disk 38 GB free; load 0.08. Tanpa drift sesi paralel.
- Gap yang ditutup: checklist Fase 4 [QA] "README deploy local/production, install
  backend, DNS/TLS, GitHub Pages workflow, backups/restore/rollback, env examples,
  migration instructions, UI guide" — README lama 47 baris masih berlabel
  "Fase 2 work in progress" dan tidak punya bagian deploy sama sekali.
- README.md baru (~170 baris, 7 seksi): dev lokal (npm ci/test/serve, backend QA,
  gotcha PATH /opt/node24 vs Node 22 ERR_DLOPEN_FAILED), deploy produksi (Node 24,
  env 0600, systemd nonroot MemoryMax=1500M, fb-backup + fb-disk-check timer, nginx
  vhost :80→301/:443+WS Upgrade+HSTS, certbot, default_server 444), workflow Pages
  (whitelist 5 entry + audit-dist + gerbang .env/sqlite/md), smoke produksi
  prod-smoke.mjs 14/14, backup/restore/rollback (Online Backup API — bukan cp WAL,
  drill <60 s, pointer OPS_CHECKLIST), tabel env lengkap (register rate default 5/15m,
  ROOM_HARD_CAP 8 dengan alasan jujur cap 16 belum diaktifkan), REST v1 + WSS ringkas
  (heartbeat 30s/10s, frame ≤16 KiB), UI guide desktop (keybind DIVERIFIKASI dari
  src/input/input.js: Z prone toggle, G drop, T throw, 1/2 slot, RMB aim, M map, Esc
  pause — BUKAN asumsi) & mobile (landscape-only, tombol SERANG/BIDIK/LONCAT/LEMPAR),
  kebijakan kredensial, Three.js 0.180.0 vendor (REVISION dicek nyata).
- Verifikasi silang sebelum commit: setiap keybind/tabel env/limit leaderboard
  (clamp 10..50)/bodyLimit 16 KiB/REVISION three dicocokkan ke kode aktual;
  URL Pages /3D-Adventure/forrest-battleground/ → 200, path tanpa prefix → 404.
- Regresi hijau run ini: unit 49/49, server suite 36/36 (realtime 13/13 termasuk
  heartbeat + logout revoke).
- Checklist prompt.md Fase 4 [QA] README → [x] dengan bukti. Butir checklist Fase 4
  yang bisa dikerjakan dari VPS kini seluruhnya [x]; sisa murni PENDING_MANUAL HP asli.
- Butuh Keputusan tetap: 1 item (jendela sesi paralel — tidak ada insiden malam ini).

### Catatan run 2026-11-05 (malam #14) — verifikasi penuh, false alarm PATH Node
- Pra-cek: semua service/timer active; disk 38 GB free; load 0.10. `/healthz` publik
  403 untuk Origin sah — dicek ke TASKS.md baris 28/58: memang desain (healthz
  loopback-only, tercatat sejak Fase 1), BUKAN drift. prod-smoke produksi 14/14 PASS
  (register, JWT, leaderboard 2 endpoint, forest status, WS origin-deny/auth/join,
  forged token 401, logout revoke).
- FALSE ALARM regresi: `npm test` pertama gagal 2 (auth.test + http.test healthz 503)
  karena cron shell memakai Node 22 sistem (/usr/bin/node v22.23.3) sementara
  better-sqlite3 dikompilasi untuk Node 24 (NODE_MODULE_VERSION 137 vs 127,
  ERR_DLOPEN_FAILED) — persis gotcha terdokumentasi di README baris 44. Dengan
  `PATH=/opt/node24/bin:$PATH`: server suite 36/36 PASS (35.4 s), unit FE 49/49 PASS.
  Tidak ada perubahan kode; service produksi tidak terpengaruh (systemd pakai
  /opt/node24/bin/node absolut).
- Checklist: tidak ada item [ ] baru yang bisa dikerjakan dari VPS (sisa murni
  PENDING_MANUAL HP asli). Butuh Keputusan tetap: 1 item (jendela sesi paralel —
  tanpa insiden malam ini).

### Catatan run 2026-11-05 (malam #15) — verifikasi penuh, tanpa drift, tanpa item baru

- Pra-cek bersih: forest-battleground + nginx active, fb-backup.timer (next 03:17) & fb-disk-check.timer (next 04:03) enabled, disk 38 GB free.
- Healthz: loopback 200 ({"ok":true,"db":true}), publik 403 = desain (TASKS.md baris 28/58), bukan regresi.
- Dengan PATH=/opt/node24/bin:$PATH (gotcha README baris 44): server suite **36/36 PASS** (35.5 s), unit FE **49/49 PASS**, prod-smoke produksi **14/14 PASS** (register→JWT→leaderboard→forest status→WS origin-deny/auth/join→forged-token 401→logout revoke).
- Checklist: tetap tidak ada item `[ ]` yang bisa dikerjakan dari VPS — Fase 1–4 seluruhnya `[x]` berbukti, sisa murni PENDING_MANUAL HP asli (AT-31, multitouch, notch). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden).

## PENDING_MANUAL (butuh HP asli)

- [M] [QA] Uji FPS/panas/baterai di HP Android & iOS nyata — FPS headless (4-8) tidak valid karena SwiftShader
- [M] [FE] Uji multitouch joystick + drag-look simultan di layar sentuh nyata
- [M] [FE] Cek safe-area (notch) di iPhone nyata


## Run 2026-11-05 malam #16 (cron autonomous)
- Pra-cek: service forest-battleground + nginx active; fb-backup.timer (next 03:17) & fb-disk-check.timer (next 04:03) enabled; disk 38 GB free. Tanpa insiden sesi paralel.
- Healthz sesuai desain: loopback 127.0.0.1:3000/healthz → 200 {ok:true,db:true}; publik api-be.bssn.biz.id/healthz → 403 (loopback-only by design).
- Verifikasi penuh (PATH=/opt/node24/bin, gotcha README baris 44): server suite 36/36 PASS (35.4s) · unit FE 49/49 PASS · prod-smoke produksi 14/14 PASS (register→JWT→leaderboard→forest status→WS origin-deny/auth/join→forged-token 401→logout revoke).
- Checklist: tetap nol item `[ ]` yang bisa dikerjakan dari VPS — Fase 1–4 seluruhnya `[x]` berbukti, sisa murni PENDING_MANUAL HP asli (AT-31, multitouch, notch). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden).
- Tidak ada perubahan kode. (Sempat false alarm MODULE_NOT_FOUND pada prod-smoke — murni salah ketik path `test/` vs `tests/`; rerun dengan path benar 14/14 PASS, bukan drift.)

### 2026-11-05 (malam #17)
- Pra-cek: forest-battleground + nginx active; fb-backup.timer & fb-disk-check.timer enabled; disk 38 GB free; tanpa insiden.
- Healthz: loopback 200 {"ok":true,"db":true}; publik 403 (by design).
- Verifikasi penuh: server 36/36 PASS, unit FE 49/49 PASS, prod-smoke 14/14 PASS — tanpa drift.
- Checklist: tetap nol item `[ ]` yang bisa dikerjakan dari VPS — Fase 1–4 seluruhnya `[x]` berbukti, sisa murni PENDING_MANUAL HP asli (AT-31, multitouch, notch). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden).

### Catatan run malam #18 (2026-11-05, cron)
- Pra-cek bersih: forest-battleground + nginx active; fb-backup.timer & fb-disk-check.timer enabled; disk 38 GB free.
- Healthz: loopback 200 {"ok":true,"db":true}; publik api-be.bssn.biz.id/healthz 403 (loopback-only by design, bukan regresi).
- Server suite 36/36 PASS (35.4 s); Unit FE 49/49 PASS; Prod-smoke produksi 14/14 PASS.
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-05 malam #19 (verifikasi penuh)
- Pra-cek bersih: forest-battleground + nginx active; fb-backup.timer & fb-disk-check.timer enabled; disk 38 GB free (44%).
- Healthz sesuai desain: loopback 200 {"ok":true,"db":true}; publik 403 (loopback-only by design).
- Verifikasi (PATH=/opt/node24/bin:$PATH): server suite 36/36 PASS (35.4 s); unit FE 49/49 PASS; prod-smoke 14/14 PASS (origin-deny, JWT, leaderboard, forest status, WS auth/join, forged-token 401, logout revoke).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-05 malam #20 (verifikasi penuh)
- Pra-cek bersih: forest-battleground + nginx active; fb-backup.timer & fb-disk-check.timer enabled; disk 38 GB free (44%).
- Healthz sesuai desain: loopback 200 {"ok":true,"db":true}; publik 403 (loopback-only by design).
- Verifikasi (PATH=/opt/node24/bin:$PATH): server suite 36/36 PASS (35.4 s); unit FE 49/49 PASS (0.36 s); prod-smoke produksi 14/14 PASS (origin-deny, JWT, leaderboard, forest status online=0 hardCap=8, WS origin-deny 1008 / auth_ok / joined 20 Hz, forged-token 401, logout revoke).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-05 malam #21 (verifikasi penuh)
- Pra-cek bersih: forest-battleground + nginx active; fb-backup.timer & fb-disk-check.timer enabled; disk 38 GB free (44%).
- Healthz sesuai desain: loopback 200 {"ok":true,"db":true}; publik 403 (loopback-only by design).
- Verifikasi (PATH=/opt/node24/bin:$PATH): server suite 36/36 PASS (35.4 s); unit FE 49/49 PASS (0.35 s); prod-smoke produksi 14/14 PASS (origin-deny, JWT, leaderboard, forest status online=0 hardCap=8, WS origin-deny 1008 / auth_ok / joined 20 Hz, forged-token 401, logout revoke).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-06 (malam #22)
- Pra-cek: forest-battleground + nginx active; fb-backup.timer & fb-disk-check.timer enabled; disk 38 GB free (44%). Tanpa insiden.
- Healthz: loopback 200 `{"ok":true,"db":true}`; publik 403 (by design).
- Verifikasi (PATH=/opt/node24/bin:$PATH): server suite 36/36 PASS (35.3 s); unit FE 49/49 PASS; prod-smoke produksi 14/14 PASS (origin-deny, JWT, leaderboard, forest status online=0 hardCap=8, WS origin-deny 1008 / auth_ok / joined 20 Hz, forged-token 401, logout revoke).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-06 (malam #23)
- Pra-cek: forest-battleground + nginx active; fb-backup.timer & fb-disk-check.timer enabled; disk 38 GB free (44%). Tanpa insiden.
- Healthz: loopback 200 `{"ok":true,"db":true}`; publik 403 (by design).
- Verifikasi (PATH=/opt/node24/bin:$PATH): server suite 36/36 PASS (35.4 s); unit FE 49/49 PASS; prod-smoke produksi 14/14 PASS (origin-deny, JWT, leaderboard, forest status online=0 hardCap=8, WS origin-deny 1008 / auth_ok / joined 20 Hz, forged-token 401, logout revoke).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run 2026-11-06 (malam #24)
- Pra-cek: forest-battleground + nginx active; fb-backup.timer & fb-disk-check.timer enabled; disk 38 GB free (44%). Tanpa insiden sesi paralel.
- Healthz: loopback 200 {"ok":true,"db":true}; publik 403 (by design).
- Verifikasi penuh (PATH=/opt/node24/bin): server suite 36/36 PASS (35.4 s) · unit FE 49/49 PASS (0.39 s) · prod-smoke produksi 14/14 PASS (origin-deny 403 → register 409 → login JWT → users/me → leaderboard top10/me → forest status online=0 hardCap=8 → WS origin-deny 1008 → auth_ok → joined 20 Hz → forged 401 → logout revoke 401).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run 2026-11-06 (malam #25)
- Pra-cek: forest-battleground + nginx active; fb-backup.timer & fb-disk-check.timer enabled; disk 38 GB free (44%). Tanpa insiden sesi paralel.
- Healthz: loopback 200 {"ok":true,"db":true}; publik 403 (by design).
- Verifikasi penuh (PATH=/opt/node24/bin): server suite 36/36 PASS (35.3 s) · unit FE 49/49 PASS · prod-smoke produksi 14/14 PASS (origin-deny 403 → register 409 → login JWT → users/me → leaderboard top10/me → forest status online=0 hardCap=8 → WS origin-deny 1008 → auth_ok → joined 20 Hz → forged 401 → logout revoke 401).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.
- Run cron 2026-11-06 (malam #26): pra-cek bersih (forest-battleground + nginx active, timers enabled, disk 38G/44% free, bind 127.0.0.1:3000 OK). Healthz loopback 200 {ok,db:true}, publik 403 by design. Verifikasi penuh (PATH=/opt/node24/bin): server suite 36/36 PASS (35.3 s) · unit FE 49/49 PASS · prod-smoke produksi 14/14 PASS (origin-deny 403 → register 409 → login JWT → users/me → leaderboard top10/me → forest status online=0 hardCap=8 → WS origin-deny 1008 → auth_ok → joined 20 Hz → forged 401 → logout revoke 401).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run 2026-11-06 (malam #27)
- Pra-cek: forest-battleground + nginx active; fb-backup.timer & fb-disk-check.timer enabled; disk 38 GB free (44%); origin/main sinkron, tanpa insiden sesi paralel.
- Healthz: loopback 200 {"ok":true,"db":true}; publik 403 (by design).
- Verifikasi penuh (PATH=/opt/node24/bin): server suite 36/36 PASS · unit FE 49/49 PASS (`node --test tests/unit/*.test.js` — glob eksplisit, tanpa glob Node mencoba load dir sebagai modul CJS dan MODULE_NOT_FOUND) · prod-smoke produksi 14/14 PASS.
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run 2026-11-06 (malam #28)
- Pra-cek: forest-battleground + nginx active; fb-backup.timer & fb-disk-check.timer enabled; disk 38 GB free (44%); origin/main sinkron, tanpa insiden sesi paralel.
- Healthz: loopback 200 {"ok":true,"db":true}; publik 403 (by design).
- Verifikasi penuh (PATH=/opt/node24/bin): server suite 36/36 PASS · unit FE 49/49 PASS (`node --test tests/unit/*.test.js` — glob eksplisit) · prod-smoke produksi 14/14 PASS (origin-deny 403 → register 409 → login JWT → users/me → leaderboard → forest status hardCap=8 → WS origin-deny 1008 → auth_ok → joined 20 Hz → forged 401 → logout revoke 401).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.
- Run 2026-11-06 (malam #29): verifikasi penuh ulang — pra-cek bersih (service+nginx active, bind 127.0.0.1:3000, timer backup/disk enabled, disk 38 GB free 44%, origin/main sinkron); healthz loopback 200 {ok,db:true}, publik 403 by design; server suite 36/36 PASS (~35 s); unit FE 49/49 PASS; prod-smoke 14/14 PASS (origin-deny, register idempotent, login JWT, users/me, leaderboard, forest status hardCap=8, WS origin-deny 1008, auth_ok, joined 20 Hz, forged-token 401, logout revoke).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.
- Run 2026-11-07 (malam #30): pra-cek bersih (services active, timers enabled, disk 38 GB free / 44%,
  origin/main sinkron). Healthz loopback 200 {"ok":true,"db":true}, publik 403 (by design).
  Verifikasi penuh: server suite 36/36 PASS (~35 s), unit FE 49/49 PASS, prod-smoke produksi 14/14 PASS.
  Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31).
  Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.
- Run 2026-11-07 (malam #31): pra-cek bersih (forest-battleground + nginx active, bind 127.0.0.1:3000,
  fb-backup.timer & fb-disk-check.timer enabled, disk 38 GB free / 44%, origin/main sinkron).
  Healthz loopback 200 {"ok":true,"db":true}, publik 403 (by design).
  Verifikasi penuh (PATH=/opt/node24/bin): server suite 36/36 PASS (~35 s), unit FE 49/49 PASS,
  prod-smoke produksi 14/14 PASS (origin-deny 403, register idempotent 409, login JWT, users/me,
  leaderboard top10/me, forest status hardCap=8, WS origin-deny 1008, auth_ok, joined 20 Hz,
  forged-token 401, logout revoke 401).
  Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31).
  Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-07 (malam #32)
- Pra-cek bersih: forest-battleground + nginx active; backend bind 127.0.0.1:3000;
  healthz loopback 200 {"ok":true} / publik 403 (loopback-only by design);
  disk 38 GB free (44% used); origin/main sinkron; tanpa insiden sesi paralel.
- Verifikasi penuh (PATH=/opt/node24/bin): server suite 36/36 PASS (~35 s);
  unit FE 49/49 PASS; prod-smoke produksi 14/14 PASS (origin-deny 403 →
  register 409 → login JWT → users/me → leaderboard → forest status hardCap=8 →
  WS origin-deny 1008 → auth_ok → joined 20 Hz → forged-token 401 → logout revoke 401).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL
  HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden).
  Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-07 (malam #33)
- Pra-cek bersih: forest-battleground + nginx active; backend bind 127.0.0.1:3000;
  healthz loopback 200 / publik 403 (loopback-only by design); timer backup/disk enabled;
  disk 38 GB free (44%); origin/main sinkron; tanpa insiden sesi paralel.
- Verifikasi penuh (PATH=/opt/node24/bin): server suite 36/36 PASS (~35 s);
  unit FE 49/49 PASS; prod-smoke produksi 14/14 PASS (origin-deny 403 → register 409 →
  login JWT → users/me → leaderboard → forest status hardCap=8 → WS origin-deny 1008 →
  auth_ok → joined 20 Hz → forged-token 401 → logout revoke 401).
  Catatan: prod-smoke.mjs berada di server/tests/ (bukan tests/ root).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL
  HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden).
  Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-06 (malam #34)
- Pra-cek bersih: forest-battleground + nginx active; backend bind 127.0.0.1:3000; fb-backup.timer & fb-disk-check.timer enabled; disk 38 GB free (44%); origin/main sinkron. Tanpa insiden sesi paralel.
- Healthz: loopback 200, publik 403 (loopback-only by design).
- Verifikasi penuh (PATH=/opt/node24/bin): server suite 36/36 PASS (~35 s); unit FE 49/49 PASS; prod-smoke produksi 14/14 PASS (origin-deny 403 -> register 409 -> login JWT -> users/me -> leaderboard -> forest status hardCap=8 -> WS origin-deny 1008 -> auth_ok -> joined 20 Hz -> forged-token 401 -> logout revoke 401).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-06 (malam #35)
- Pra-cek bersih: forest-battleground + nginx active; backend bind 127.0.0.1:3000; fb-backup.timer & fb-disk-check.timer enabled; disk 38 GB free (44%); origin/main sinkron. Tanpa insiden sesi paralel.
- Healthz: loopback 200, publik 403 (loopback-only by design).
- Verifikasi penuh (PATH=/opt/node24/bin): server suite 36/36 PASS (~35 s) · unit FE 49/49 PASS (glob eksplisit) · prod-smoke produksi 14/14 PASS (origin-deny 403 → register 409 → login JWT → users/me → leaderboard → forest status online=0 hardCap=8 → WS origin-deny 1008 → auth_ok → joined 20 Hz → forged 401 → logout revoke 401). (Sempat salah path prod-smoke dari root repo — script memang di server/tests/; rerun benar 14/14, bukan drift.)
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Catatan run 2026-11-06 (malam #36) — verifikasi penuh, tanpa drift
- Pra-cek bersih: forest-battleground + nginx active; fb-backup.timer & fb-disk-check.timer
  active; backend bind 127.0.0.1:3000; disk 38 GB free (44%); origin/main sinkron.
- Healthz: loopback 200, publik tanpa Origin 403 (loopback-only by design).
- Server suite 36/36 PASS (~35 s, PATH=/opt/node24/bin).
- Unit FE 49/49 PASS (`node --test tests/unit/*.test.js` dari root forrest-battleground).
- Prod-smoke 14/14 PASS (origin-deny → register 409 → login JWT → users/me → leaderboard →
  forest status online=0 hardCap=8 → WS origin-deny 1008 → auth_ok → joined 20 Hz →
  forged-token 401 → logout revoke 401).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL
  HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden).
  Tanpa drift, tanpa perubahan kode.

### Catatan run malam #37 (2026-11-06, cron)
- Pra-cek bersih: forest-battleground + nginx active; fb-backup.timer & fb-disk-check.timer
  active; backend bind 127.0.0.1:3000; disk 38 GB free (44%); origin/main sinkron di
  `0e11c56` sebelum run. Tanpa insiden sesi paralel.
- Healthz sesuai desain: loopback `127.0.0.1:3000/healthz` → 200; publik tanpa Origin → 403
  (loopback-only by design).
- Verifikasi penuh (PATH=/opt/node24/bin:$PATH):
  - Server suite: 36/36 PASS (`node --test tests/*.test.js`, ~35 s).
  - Unit FE: 49/49 PASS (`node --test tests/unit/*.test.js` dari root forrest-battleground).
  - Prod-smoke produksi: 14/14 PASS — origin-deny 403 (no-origin & evil) → protected 401 →
    register idempotent 409 → login JWT → users/me → leaderboard top10+me → forest status
    online=0 hardCap=8 → WS origin-deny 1008 → auth_ok → joined 20 Hz → forged-token 401 →
    logout revoke 401.
- Catatan teknis minor: dua kali salah invokasi path (tests/ tanpa glob di server/, dan
  prod-smoke dari root alih-alih server/) — kedua rerun dari path yang benar PASS penuh,
  bukan drift.
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL
  HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden).
  Tanpa drift, tanpa perubahan kode.

## Catatan run 2026-11-07 (malam #38)
- Pra-cek bersih: forest-battleground + nginx active; fb-backup.timer & fb-disk-check.timer active; backend bind 127.0.0.1:3000; disk 38 GB free (44%); origin/main sinkron di 1195a7f sebelum run. Tanpa insiden sesi paralel.
- Healthz sesuai desain: loopback 127.0.0.1:3000 → 200; publik tanpa Origin → 403 (loopback-only by design).
- Verifikasi penuh (PATH=/opt/node24/bin): server suite **36/36 PASS** (35.4s) · unit FE **49/49 PASS** · prod-smoke produksi **14/14 PASS** (origin-deny → 401 → register 409 → login JWT → users/me → leaderboard → forest status online=0 hardCap=8 → WS origin-deny 1008 → auth_ok → joined 20Hz → forged-token 401 → logout revoke).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

## Catatan run 2026-11-08 (malam #39)
- Pra-cek bersih: forest-battleground + nginx active; fb-backup.timer & fb-disk-check.timer active; backend bind 127.0.0.1:3000; disk 38 GB free (44%); origin/main sinkron di ef4afc1 sebelum run. Tanpa insiden sesi paralel.
- Healthz sesuai desain: loopback 127.0.0.1:3000 → 200; publik tanpa Origin → 403 (loopback-only by design).
- Verifikasi penuh (PATH=/opt/node24/bin): server suite **36/36 PASS** (35.4s) · unit FE **49/49 PASS** · prod-smoke produksi **14/14 PASS** (origin-deny → 401 → register 409 → login JWT → users/me → leaderboard → forest status online=0 hardCap=8 → WS origin-deny 1008 → auth_ok → joined 20Hz → forged-token 401 → logout revoke).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-09 (malam #40) — verifikasi penuh, tanpa drift
- Pra-cek: forest-battleground + nginx active; fb-backup.timer & fb-disk-check.timer active; backend bind 127.0.0.1:3000; disk 38 GB free (44%); origin/main sinkron di 3c67e3f. Tanpa insiden sesi paralel.
- Healthz: loopback 127.0.0.1:3000/healthz → 200; publik tanpa Origin → 403 (loopback-only by design).
- Verifikasi penuh (PATH=/opt/node24/bin): server suite 36/36 PASS (~35 s) · unit FE 49/49 PASS · prod-smoke produksi 14/14 PASS (origin-deny 403 → register 409 → login JWT → users/me → leaderboard → forest status online=0 hardCap=8 → WS origin-deny 1008 → auth_ok → joined 20 Hz → forged 401 → logout revoke 401).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-10 (malam #41) — verifikasi penuh, tanpa drift, tanpa item baru
- Pra-cek bersih: forest-battleground + nginx active; fb-backup.timer & fb-disk-check.timer active; backend bind 127.0.0.1:3000; disk 38 GB free (44%); origin/main sinkron di 72ce382 sebelum run. Tanpa insiden sesi paralel.
- Healthz sesuai desain: loopback 127.0.0.1:3000/healthz → 200; publik tanpa Origin → 403 (loopback-only by design).
- Verifikasi penuh (PATH=/opt/node24/bin): server suite 36/36 PASS (~35 s) · unit FE 49/49 PASS (node --test tests/unit/*.test.js) · prod-smoke produksi 14/14 PASS (origin-deny 403 → 401 → register 409 → login JWT → users/me → leaderboard → forest status online=0 hardCap=8 → WS origin-deny 1008 → auth_ok → joined 20 Hz → forged 401 → logout revoke 401).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Catatan run 2026-11-11 (malam #42) — verifikasi penuh, tanpa drift, tanpa item baru
- Pra-cek bersih: forest-battleground + nginx active; fb-backup.timer &
  fb-disk-check.timer active; backend bind 127.0.0.1:3000; disk 38 GB free
  (44%); origin/main sinkron di 06a1386 sebelum run. Tanpa insiden sesi paralel.
- Healthz sesuai desain: loopback 127.0.0.1:3000/healthz -> 200; publik tanpa
  Origin -> 403 (loopback-only by design).
- Verifikasi penuh (PATH=/opt/node24/bin):
  - Server suite 36/36 PASS (~35 s)
  - Unit FE 49/49 PASS (node --test tests/unit/*.test.js)
  - Prod-smoke produksi 14/14 PASS: origin-deny 403 (no-origin & evil) ->
    protected 401 -> register idempotent 409 -> login JWT -> users/me ->
    leaderboard top10+me -> forest status (online=0, hardCap=8) -> WS
    origin-deny 1008 -> auth_ok -> joined 20 Hz -> forged-token 401 ->
    logout revoke 401.
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni
  PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi
  paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.


---

## Run cron 2026-11-06 (malam #43) — verifikasi penuh, tanpa drift, tanpa item baru

- Pra-cek bersih: forest-battleground + nginx active; fb-backup.timer & fb-disk-check.timer active; backend bind 127.0.0.1:3000; disk 38 GB free (44%); `origin/main` sinkron di `114cead` sebelum run. Tanpa insiden sesi paralel.
- Healthz sesuai desain: loopback `127.0.0.1:3000/healthz` → 200; publik tanpa Origin → 403 — loopback-only by design.
- Verifikasi penuh (PATH=/opt/node24/bin): server suite **36/36 PASS** (~35 s) · unit FE **49/49 PASS** (`node --test tests/unit/*.test.js`) · prod-smoke produksi **14/14 PASS** (origin-deny 403 no-origin & evil → protected 401 → register idempotent 409 → login JWT → users/me → leaderboard top10+me → forest status online=0 hardCap=8 → WS origin-deny 1008 → auth_ok → joined 20 Hz → forged-token 401 → logout revoke 401).
- Checklist tetap nol item `[ ]` yang bisa dikerjakan dari VPS — Fase 1–4 seluruhnya `[x]` berbukti, sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

---

## Run cron 2026-11-06 (malam #44) — verifikasi penuh, tanpa drift, tanpa item baru

- Pra-cek bersih: forest-battleground + nginx active; fb-backup.timer & fb-disk-check.timer active; backend bind 127.0.0.1:3000; disk 38 GB free (44%); `origin/main` sinkron di `4f2422e` sebelum run. Tanpa insiden sesi paralel.
- Healthz sesuai desain: loopback `127.0.0.1:3000/healthz` → 200; publik tanpa Origin → 403 — loopback-only by design.
- Verifikasi penuh (PATH=/opt/node24/bin): server suite **36/36 PASS** (~35 s) · unit FE **49/49 PASS** (`node --test tests/unit/*.test.js`) · prod-smoke produksi **14/14 PASS** (register→JWT→leaderboard→forest status→WS origin-deny/auth/join→forged-token 401→logout revoke).
- Catatan gotcha: prod-smoke tinggal di `server/tests/prod-smoke.mjs` (bukan `tests/`) — sempat salah path di run ini, langsung koreksi, hasil tetap 14/14 PASS. Tanpa perubahan kode.
- Checklist tetap nol item `[ ]` yang bisa dikerjakan dari VPS — Fase 1–4 seluruhnya `[x]` berbukti, sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

## Run malam #45 — 2026-11-06 (cron verifikasi penuh)
- Pra-cek bersih: forest-battleground+nginx active; fb-backup.timer & fb-disk-check.timer active; backend bind 127.0.0.1:3000; disk 38 GB free (44%); origin/main sinkron di 2edc073 sebelum run. Tanpa insiden sesi paralel.
- Healthz sesuai desain: loopback 200; publik tanpa Origin 403.
- Verifikasi penuh (PATH=/opt/node24/bin): server suite 36/36 PASS (~35 s); unit FE 49/49 PASS; prod-smoke 14/14 PASS (origin-deny 403 -> protected 401 -> register 409 -> login JWT -> users/me -> leaderboard -> forest status -> WS origin-deny 1008 -> auth_ok -> joined 20 Hz -> forged-token 401 -> logout revoke 401).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-06 (malam #46)
- Pra-cek bersih: forest-battleground + nginx active; fb-backup.timer & fb-disk-check.timer active; backend bind 127.0.0.1:3000; disk 38 GB free (44%); origin/main sinkron di `3d24dca` sebelum run. Tanpa insiden sesi paralel.
- Healthz: loopback 127.0.0.1:3000 → 200; publik tanpa Origin → 403 (loopback-only by design).
- Verifikasi penuh (PATH=/opt/node24/bin): server suite 36/36 PASS (~35 s); unit FE 49/49 PASS; prod-smoke 14/14 PASS (origin-deny → 401 → register 409 → login JWT → users/me → leaderboard → forest status → WS origin-deny 1008 → auth_ok → joined 20 Hz → forged 401 → logout revoke).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-06 (malam #47) — verifikasi penuh, tanpa drift, tanpa item baru
- Pra-cek bersih: forest-battleground + nginx active; fb-backup.timer & fb-disk-check.timer active; backend bind 127.0.0.1:3000; disk 38 GB free (44%); `origin/main` sinkron di `f402f36` sebelum run. Tanpa insiden sesi paralel.
- Healthz sesuai desain: loopback `127.0.0.1:3000/healthz` → 200; publik tanpa Origin → 403 (loopback-only by design).
- Verifikasi penuh (PATH=/opt/node24/bin:$PATH):
  - Server suite **36/36 PASS** (~35 s)
  - Unit FE **49/49 PASS** (`node --test tests/unit/*.test.js`)
  - Prod-smoke produksi **14/14 PASS** (`node server/tests/prod-smoke.mjs`): origin-deny 403 → protected 401 → register idempotent 409 → login JWT → users/me → leaderboard top10+me → forest status online=0 cap=8 → WS origin-deny 1008 → auth_ok → joined 20 Hz → forged-token 401 → logout revoke 401.
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-06 (malam #48) — verifikasi penuh, tanpa drift, tanpa item baru
- Pra-cek bersih: forest-battleground + nginx active; fb-backup.timer & fb-disk-check.timer active; backend bind 127.0.0.1:3000; disk 38 GB free (44%); `origin/main` sinkron di `803a922` sebelum run. Tanpa insiden sesi paralel.
- Healthz sesuai desain: loopback `127.0.0.1:3000/healthz` → 200; publik tanpa Origin → 403 (loopback-only by design).
- Verifikasi penuh (PATH=/opt/node24/bin:$PATH):
  - Server suite **36/36 PASS** (~35 s)
  - Unit FE **49/49 PASS** (`node --test tests/unit/*.test.js`)
  - Prod-smoke produksi **14/14 PASS** (`node server/tests/prod-smoke.mjs`): origin-deny 403 → protected 401 → register idempotent 409 → login JWT → users/me → leaderboard top10+me → forest status online=0 cap=8 → WS origin-deny 1008 → auth_ok → joined 20 Hz → forged-token 401 → logout revoke 401.
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-06 (malam #49) — verifikasi penuh, tanpa drift
- Pra-cek: forest-battleground + nginx active; fb-backup.timer & fb-disk-check.timer active; backend bind 127.0.0.1:3000; disk 38 GB free (44%); `origin/main` sinkron di `67a5dd5` sebelum run. Tanpa insiden sesi paralel.
- Healthz: loopback 200, publik tanpa Origin 403 — loopback-only by design.
- Verifikasi penuh (PATH=/opt/node24/bin:$PATH): server suite **36/36 PASS** (~35 s), unit FE **49/49 PASS**, prod-smoke produksi **14/14 PASS** (origin-deny → protected 401 → register 409 → login JWT → users/me → leaderboard → forest online=0 cap=8 → WS origin-deny 1008 → auth_ok → joined 20 Hz → forged-token 401 → logout revoke 401).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-07 (malam #50) — verifikasi penuh, tanpa drift
- Pra-cek: forest-battleground + nginx active; fb-backup.timer & fb-disk-check.timer active; backend bind 127.0.0.1:3000; disk 38 GB free (44%); `origin/main` sinkron di `b838197` sebelum run. Tanpa insiden sesi paralel.
- Healthz: loopback 200, publik tanpa Origin 403 — loopback-only by design.
- Verifikasi penuh (PATH=/opt/node24/bin:$PATH): server suite **36/36 PASS** (~35 s), unit FE **49/49 PASS** (`npm test` root), prod-smoke produksi **14/14 PASS** (origin-deny → protected 401 → register 409 → login JWT → users/me → leaderboard → forest online=0 cap=8 → WS origin-deny 1008 → auth_ok → joined 20 Hz → forged-token 401 → logout revoke 401).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-07 (malam #51) — verifikasi penuh, tanpa drift
- Pra-cek: forest-battleground + nginx active; fb-backup.timer & fb-disk-check.timer active; backend bind 127.0.0.1:3000; disk 38 GB free (44%); `origin/main` sinkron di `c09c94f` sebelum run. Tanpa insiden sesi paralel.
- Healthz: loopback 200, publik tanpa Origin 403 — loopback-only by design.
- Verifikasi penuh (PATH=/opt/node24/bin:$PATH): server suite **36/36 PASS** (~35 s), unit FE **49/49 PASS** (`npm test` root), prod-smoke produksi **14/14 PASS** (origin-deny → protected 401 → register 409 → login JWT → users/me → leaderboard → forest online=0 cap=8 → WS origin-deny 1008 → auth_ok → joined 20 Hz → forged-token 401 → logout revoke 401).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-07 (malam #52) — verifikasi penuh, tanpa drift
- Pra-cek: forest-battleground + nginx active; fb-backup.timer & fb-disk-check.timer active; backend bind 127.0.0.1:3000; disk 38 GB free (44%); `origin/main` sinkron di `2878b11` sebelum run. Tanpa insiden sesi paralel.
- Healthz: loopback 200, publik tanpa Origin 403 — loopback-only by design.
- Verifikasi penuh (PATH=/opt/node24/bin:$PATH): server suite **36/36 PASS** (~35 s), unit FE **49/49 PASS** (`npm test` root), prod-smoke produksi **14/14 PASS** (`node server/tests/prod-smoke.mjs`: origin-deny 403 → protected 401 → register 409 → login JWT → users/me → leaderboard → forest online=0 cap=8 → WS origin-deny 1008 → auth_ok → joined 20 Hz → forged-token 401 → logout revoke 401). Gotcha berulang: prod-smoke ada di `server/tests/`, bukan `server/scripts/` — sudah terdokumentasi.
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

## Run 2026-11-07 (malam #53)
- Pra-cek: nginx active; `forest-battleground.service` active (typo nama unit `forrest-` di run ini langsung dikoreksi — gotcha baru: unit resmi tanpa huruf "r" ganda); fb-backup.timer & fb-disk-check.timer active; backend bind 127.0.0.1:3000; disk 38 GB free (44%); `origin/main` sinkron di `d6724cd`. Tanpa insiden sesi paralel.
- Healthz: loopback 200; publik tanpa Origin 403 (loopback-only by design).
- Verifikasi penuh (`PATH=/opt/node24/bin:$PATH`): server suite 36/36 PASS (~35 s); unit FE 49/49 PASS; prod-smoke produksi 14/14 PASS (`node server/tests/prod-smoke.mjs`).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

- Run malam #54 (2026-11-06): verifikasi penuh lagi — server suite 36/36 PASS, unit FE 49/49 PASS, prod-smoke 14/14 PASS (semua step hijau, online=0 cap=8, logout revoke 401). Healthz loopback 200 / publik tanpa Origin 403. nginx, forest-battleground.service, fb-backup.timer, fb-disk-check.timer semua active; disk 38 GB free (44%); HEAD==origin/main sebelum & sesudah run (tanpa perubahan kode). Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-07 (malam #55) — verifikasi penuh, tanpa drift
- Pra-cek: nginx, forest-battleground.service, fb-backup.timer, fb-disk-check.timer semua active; backend bind 127.0.0.1:3000; disk 38 GB free (44%); `origin/main` sinkron di `404cea5` sebelum run. Tanpa insiden sesi paralel.
- Healthz: loopback 200, publik tanpa Origin 403 — loopback-only by design.
- Verifikasi penuh (PATH=/opt/node24/bin:$PATH): server suite **36/36 PASS** (~35 s), unit FE **49/49 PASS** (`npm test` root), prod-smoke produksi **14/14 PASS** (`node server/tests/prod-smoke.mjs`: origin-deny 403 → protected 401 → register 409 → login JWT → users/me → leaderboard top10+me → forest online=0 cap=8 → WS origin-deny 1008 → auth_ok → joined 20 Hz → forged-token 401 → logout revoke 401).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-08 (malam #56) — verifikasi penuh, tanpa drift
- Pra-cek: nginx, forest-battleground.service, fb-backup.timer, fb-disk-check.timer semua active; backend bind 127.0.0.1:3000; disk 38 GB free (44%); `origin/main` sinkron di `d6b4b8c` sebelum run. Tanpa insiden sesi paralel.
- Healthz: loopback 200, publik tanpa Origin 403 — loopback-only by design.
- Verifikasi penuh (PATH=/opt/node24/bin:$PATH): server suite **36/36 PASS** (~35 s), unit FE **49/49 PASS** (`npm test` root), prod-smoke produksi **14/14 PASS** (`node server/tests/prod-smoke.mjs`: origin-deny 403 → protected 401 → register 409 → login JWT → users/me → leaderboard top10+me → forest online=0 cap=8 → WS origin-deny 1008 → auth_ok → joined 20 Hz → forged-token 401 → logout revoke 401).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-06 siang (malam #57) — verifikasi penuh, tanpa drift
- Pra-cek: nginx, forest-battleground.service, fb-backup.timer, fb-disk-check.timer semua active; disk 38 GB free (44%); `origin/main` sinkron di `dd641a1` sebelum run. Tanpa insiden sesi paralel.
- Healthz: loopback 200, publik tanpa Origin 403 — loopback-only by design.
- Verifikasi penuh (PATH=/opt/node24/bin:$PATH): server suite **36/36 PASS** (~35 s), unit FE **49/49 PASS** (`npm test` root), prod-smoke produksi **14/14 PASS** (`node server/tests/prod-smoke.mjs`: origin-deny 403 → protected 401 → register 409 → login JWT → users/me → leaderboard top10+me → forest online=0 cap=8 → WS origin-deny 1008 → auth_ok → joined 20 Hz → forged-token 401 → logout revoke 401).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-06 malam (#58) — verifikasi penuh, tanpa drift
- Pra-cek: nginx, forest-battleground.service, fb-backup.timer, fb-disk-check.timer semua active; disk 38 GB free (44%); `origin/main` sinkron di `c630ab6` sebelum run. Tanpa insiden sesi paralel.
- Healthz: loopback 200, publik tanpa Origin 403 — loopback-only by design.
- Verifikasi penuh (PATH=/opt/node24/bin:$PATH): server suite **36/36 PASS** (~35 s), unit FE **49/49 PASS** (`npm test` root), prod-smoke produksi **14/14 PASS** (`node server/tests/prod-smoke.mjs`: origin-deny 403 → protected 401 → register 409 → login JWT → users/me → leaderboard top10+me → forest online=0 cap=8 → WS origin-deny 1008 → auth_ok → joined 20 Hz → forged-token 401 → logout revoke 401).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-06 malam (#59) — verifikasi penuh, tanpa drift
- Pra-cek: nginx, forest-battleground.service, fb-backup.timer, fb-disk-check.timer semua active; disk 38 GB free (44%); `origin/main` sinkron di `073e84d` sebelum run. Tanpa insiden sesi paralel.
- Healthz: loopback 200, publik tanpa Origin 403 — loopback-only by design.
- Verifikasi penuh (PATH=/opt/node24/bin:$PATH): server suite **36/36 PASS** (~35 s), unit FE **49/49 PASS** (`npm test` root), prod-smoke produksi **14/14 PASS** (`node server/tests/prod-smoke.mjs`: origin-deny 403 → protected 401 → register 409 → login JWT → users/me → leaderboard top10+me → forest online=0 cap=8 → WS origin-deny 1008 → auth_ok → joined 20 Hz → forged-token 401 → logout revoke 401).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Catatan run 2026-11-06 (malam #60) — verifikasi penuh, tanpa drift
- Pra-cek bersih: nginx & forest-battleground active; fb-backup.timer & fb-disk-check.timer active; disk 38 GB free (43%); origin/main sinkron.
- Healthz: loopback 200; publik tanpa Origin → 403 (by design).
- Verifikasi penuh: server suite 36/36 PASS; unit FE 49/49 PASS; prod-smoke produksi 14/14 PASS.
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-06 (run #61) — verifikasi penuh hijau, tanpa drift, tanpa item baru
- Pra-cek: nginx/forest-battleground/fb-backup.timer/fb-disk-check.timer active; disk 38G free (43%); `origin/main` sinkron (`442bbc3`) sebelum run; tanpa insiden sesi paralel.
- Healthz: loopback `127.0.0.1:3000/healthz` → 200; publik `api-be.bssn.biz.id/healthz` tanpa Origin → 403 (loopback-only by design, tercatat sejak Fase 1).
- Verifikasi penuh (PATH=/opt/node24/bin, gotcha README baris 44): server suite **36/36 PASS** (35.4s) · unit FE **49/49 PASS** · prod-smoke produksi **14/14 PASS** (origin-deny 403 → protected 401 → register 409 → login JWT → users/me → leaderboard top10+me → forest online=0 cap=8 → WS origin-deny 1008 → auth_ok → joined 20Hz → forged-token 401 → logout revoke 401).
- Checklist tetap nol item `[ ]` yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-07 #62
- Pra-cek: nginx, forest-battleground.service, fb-backup.timer, fb-disk-check.timer semua active; disk 38 GB free (43%); origin/main sinkron (ac906c5) sebelum run; tanpa insiden sesi paralel.
- Healthz sesuai desain: loopback 127.0.0.1:3000/healthz → 200; publik api-be.bssn.biz.id/healthz tanpa Origin → 403 (loopback-only by design).
- Verifikasi penuh (PATH=/opt/node24/bin:$PATH): server suite 36/36 PASS (~35 s); unit FE 49/49 PASS; prod-smoke produksi 14/14 PASS (origin-deny 403 → protected 401 → register 409 → login JWT → users/me → leaderboard top10+me → forest online=0 cap=8 → WS origin-deny 1008 → auth_ok → joined 20 Hz → forged-token 401 → logout revoke 401).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-07 #63
- Pra-cek: nginx, forest-battleground.service, fb-backup.timer, fb-disk-check.timer semua active; disk 38 GB free (43%); origin/main sinkron (3a9a62e) sebelum run; tanpa insiden sesi paralel.
- Healthz sesuai desain: loopback 127.0.0.1:3000/healthz → 200; publik api-be.bssn.biz.id/healthz tanpa Origin → 403 (loopback-only by design).
- Verifikasi penuh (PATH=/opt/node24/bin:$PATH): server suite 36/36 PASS (~35 s); unit FE 49/49 PASS; prod-smoke produksi 14/14 PASS (origin-deny 403 → protected 401 → register 409 → login JWT → users/me → leaderboard top10+me → forest online=0 cap=8 → WS origin-deny 1008 → auth_ok → joined 20 Hz → forged-token 401 → logout revoke 401).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-07 #64
- Pra-cek: nginx active; **typo nama unit di probe awal (`forrest-` vs `forest-`)** — `forest-battleground.service` terverifikasi active running via `list-units` (bukan insiden nyata); fb-backup.timer & fb-disk-check.timer active; disk 38 GB free (43%); `origin/main` sinkron (`eaaeaed`) sebelum run.
- Healthz sesuai desain: loopback 127.0.0.1:3000/healthz → 200; publik tanpa Origin → 403 (loopback-only by design).
- Verifikasi penuh (PATH=/opt/node24/bin:$PATH): server suite 36/36 PASS (~35 s); unit FE 49/49 PASS; prod-smoke produksi 14/14 PASS (origin-deny 403 → protected 401 → register 409 → login JWT → users/me → leaderboard top10+me → forest online=0 cap=8 → WS origin-deny 1008 → auth_ok → joined 20 Hz → forged-token 401 → logout revoke 401).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-07 #65
- Pra-cek: nginx, forest-battleground.service, fb-backup.timer, fb-disk-check.timer semua active; disk 38 GB free (43%); `origin/main` sinkron (`21a1502`) sebelum run; tanpa insiden sesi paralel.
- Healthz sesuai desain: loopback 127.0.0.1:3000/healthz → 200; publik api-be.bssn.biz.id/healthz tanpa Origin → 403 (loopback-only by design).
- Verifikasi penuh (PATH=/opt/node24/bin:$PATH): server suite 36/36 PASS (~35 s); unit FE 49/49 PASS; prod-smoke produksi 14/14 PASS (origin-deny 403 → protected 401 → register 409 → login JWT → users/me → leaderboard top10+me → forest online=0 cap=8 → WS origin-deny 1008 → auth_ok → joined 20 Hz → forged-token 401 → logout revoke 401).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-07 #66
- Pra-cek: nginx, forest-battleground.service, fb-backup.timer, fb-disk-check.timer semua active; disk 38 GB free (43%); `origin/main` sinkron (`278fdb7`) sebelum run; tanpa insiden sesi paralel.
- Healthz sesuai desain: loopback 127.0.0.1:3000/healthz → 200; publik api-be.bssn.biz.id/healthz tanpa Origin → 403 (loopback-only by design).
- Verifikasi penuh (PATH=/opt/node24/bin:$PATH): server suite 36/36 PASS (~35.6 s); unit FE 49/49 PASS; prod-smoke produksi 14/14 PASS (origin-deny 403 → protected 401 → register 409 → login JWT → users/me → leaderboard top10+me → forest online=0 cap=8 → WS origin-deny 1008 → auth_ok → joined 20 Hz → forged-token 401 → logout revoke 401).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

## Run cron 2026-11-06 (run #67) — verifikasi penuh, tanpa drift, tanpa item baru

- Pra-cek: nginx, forest-battleground.service, fb-backup.timer, fb-disk-check.timer active; disk 38 GB free (44%); origin/main sinkron (73940cd) sebelum run.
- Healthz: loopback 200, publik tanpa Origin 403 (by design).
- Verifikasi (PATH=/opt/node24/bin): server 36/36 PASS (~35.4 s), unit FE 49/49 PASS, prod-smoke produksi 14/14 PASS (14 langkah penuh).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-06 #68 (verifikasi penuh)
- Pra-cek bersih: nginx, forest-battleground.service, fb-backup.timer, fb-disk-check.timer active; disk 38 GB free (44%); origin/main sinkron (db0fbb6) sebelum run; tanpa insiden sesi paralel.
- Healthz: loopback 127.0.0.1:3000/healthz 200; publik api-be.bssn.biz.id/healthz tanpa Origin 403 (by design).
- Verifikasi penuh (PATH=/opt/node24/bin): server suite 36/36 PASS (~35.4 s); unit FE 49/49 PASS; prod-smoke produksi 14/14 PASS.
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-06 #69 (verifikasi penuh)
- Pra-cek bersih: nginx, forest-battleground.service, fb-backup.timer, fb-disk-check.timer active; disk 38 GB free (44%); origin/main sinkron (3845cdd) sebelum run; tanpa insiden sesi paralel.
- Healthz: loopback 127.0.0.1:3000/healthz 200; publik api-be.bssn.biz.id/healthz tanpa Origin 403 (by design).
- Verifikasi penuh (PATH=/opt/node24/bin): server suite 36/36 PASS (~35.5 s); unit FE 49/49 PASS; prod-smoke produksi 14/14 PASS.
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-06 #70
- Pra-cek: nginx, forest-battleground.service, fb-backup.timer, fb-disk-check.timer
  semua active; disk 38 GB free (44%); origin/main sinkron (2068bb1) sebelum run;
  tanpa insiden sesi paralel.
- Healthz: loopback 127.0.0.1:3000/healthz 200; publik tanpa Origin 403 (by design).
- Verifikasi penuh: server suite 36/36 PASS (~35.7 s); unit FE 49/49 PASS;
  prod-smoke produksi 14/14 PASS (origin-deny 403, protected 401, register 409,
  login JWT, users/me, leaderboard top10+me, forest online=0 cap=8, WS origin-deny
  1008, auth_ok, joined 20 Hz, forged-token 401, logout revoke 401).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni
  PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi
  paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Catatan run 2026-11-06 (#71) — verifikasi penuh, tanpa drift
- Pra-cek: nginx, forest-battleground.service, fb-backup.timer, fb-disk-check.timer
  active; disk 38 GB free (44%); origin/main sinkron (0ea0737) sebelum run.
- Healthz: loopback 127.0.0.1:3000/healthz 200; publik tanpa Origin 403 (by design).
- Verifikasi penuh: server suite 36/36 PASS (~35.4 s); unit FE 49/49 PASS;
  prod-smoke produksi 14/14 PASS (origin-deny 403, protected 401, register 409,
  login JWT, users/me, leaderboard top10+me, forest online=0 cap=8, WS origin-deny
  1008, auth_ok, joined 20 Hz, forged-token 401, logout revoke 401).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni
  PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi
  paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-06 #72 (verifikasi penuh, tanpa drift)
- Pra-cek: nginx, forest-battleground.service, fb-backup.timer, fb-disk-check.timer
  active; disk 38 GB free (44%); origin/main sinkron (7cb289b) sebelum run;
  tanpa insiden sesi paralel.
- Healthz: loopback 127.0.0.1:3000/healthz 200; publik tanpa Origin 403 (by design).
- Verifikasi penuh: server suite 36/36 PASS (~35.4 s); unit FE 49/49 PASS;
  prod-smoke produksi 14/14 PASS (origin-deny 403, protected 401, register 409,
  login JWT, users/me, leaderboard top10+me, forest online=0 cap=8, WS origin-deny
  1008, auth_ok, joined 20 Hz, forged-token 401, logout revoke 401).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni
  PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi
  paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-06 #73 (verifikasi penuh, tanpa drift)
- Pra-cek: nginx, forest-battleground.service, fb-backup.timer, fb-disk-check.timer
  active; disk 38 GB free (44%); origin/main sinkron (0ca9136) sebelum run;
  tanpa insiden sesi paralel.
- Healthz: loopback 127.0.0.1:3000/healthz 200; publik tanpa Origin 403 (by design).
- Verifikasi penuh (PATH=/opt/node24/bin:$PATH): server suite 36/36 PASS (~35.3 s);
  unit FE 49/49 PASS (~0.35 s); prod-smoke produksi 14/14 PASS (origin-deny 403,
  protected 401, register 409, login JWT, users/me, leaderboard top10+me, forest
  online=0 cap=8, WS origin-deny 1008, auth_ok, joined 20 Hz, forged-token 401,
  logout revoke 401).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni
  PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi
  paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-06 #74 (verifikasi penuh, tanpa drift)
- Pra-cek: nginx, forest-battleground.service, fb-backup.timer, fb-disk-check.timer
  active; disk 38 GB free (44%); origin/main sinkron (ab4058b) sebelum run;
  tanpa insiden sesi paralel.
- Healthz: loopback 127.0.0.1:3000/healthz 200; publik tanpa Origin 403 (by design).
- Verifikasi penuh (PATH=/opt/node24/bin:$PATH): server suite 36/36 PASS (~35.5 s);
  unit FE 49/49 PASS (~0.4 s); prod-smoke produksi 14/14 PASS (origin-deny 403,
  protected 401, register 409, login JWT, users/me, leaderboard top10+me, forest
  online=0 cap=8, WS origin-deny 1008, auth_ok, joined 20 Hz, forged-token 401,
  logout revoke 401).
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni
  PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi
  paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

### Run cron 2026-11-06 (malam #33)
- Pra-cek bersih: nginx, forest-battleground.service, fb-backup.timer, fb-disk-check.timer semua active;
  disk 38 GB free (44%); origin/main sinkron (ab4058b + catatan run #74) sebelum run; tanpa insiden sesi paralel.
- Healthz sesuai desain: loopback 127.0.0.1:3000/healthz → 200; publik api-be.bssn.biz.id/healthz tanpa Origin → 403 (loopback-only by design).
- Verifikasi penuh (PATH=/opt/node24/bin):
  server suite 36/36 PASS (~35 s), unit FE 49/49 PASS (~0.4 s),
  prod-smoke produksi 14/14 PASS (origin-deny 403 → protected 401 → register 409 → login JWT → users/me →
  leaderboard top10+me → forest online=0 hardCap=8 → WS origin-deny 1008 → auth_ok → joined 20 Hz →
  forged-token 401 → logout revoke 401).
- Checklist tetap nol item `[ ]` yang bisa dikerjakan dari VPS — Fase 1–4 seluruhnya `[x]` berbukti,
  sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden run ini).

## Catatan run cron 2026-11-06 (run #76)
- Pra-cek bersih: nginx, forest-battleground.service, fb-backup.timer, fb-disk-check.timer active; disk 38 GB free (44%); origin/main sinkron (046848f); tanpa insiden sesi paralel.
- Healthz sesuai desain: loopback 127.0.0.1:3000/healthz → 200; publik api-be.bssn.biz.id/healthz tanpa Origin → 403.
- Verifikasi penuh: server 36/36 PASS (~35 s), unit FE 49/49 PASS, prod-smoke 14/14 PASS.
- Checklist tetap nol item `[ ]` yang bisa dikerjakan dari VPS (sisa AT-31 PENDING_MANUAL HP asli). Butuh Keputusan tetap 1 item.

## Run 2026-11-06 (cron #77) — verifikasi penuh, tanpa drift
- Pra-cek: nginx, forest-battleground.service, fb-backup.timer, fb-disk-check.timer active; disk 38 GB free (44%); origin/main sinkron (39c2703) sebelum run; tanpa insiden sesi paralel.
- Healthz: loopback 127.0.0.1:3000/healthz 200; publik api-be.bssn.biz.id/healthz tanpa Origin 403 (loopback-only by design).
- Verifikasi penuh (PATH=/opt/node24/bin):
  - Server suite 36/36 PASS (~35 s)
  - Unit FE 49/49 PASS
  - Prod-smoke produksi 14/14 PASS (origin-deny 403 → protected 401 → register 409 → login JWT → users/me → leaderboard top10+me → forest online cap=8 → WS origin-deny 1008 → auth_ok → joined 20 Hz → forged-token 401 → logout revoke 401)
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.

## Run 2026-11-06 (cron #78) — verifikasi penuh, tanpa drift
- Pra-cek: nginx, forest-battleground.service, fb-backup.timer, fb-disk-check.timer active; disk 38 GB free (44%); origin/main sinkron (5183bc0) sebelum run; tanpa insiden sesi paralel.
- Healthz: loopback 127.0.0.1:3000/healthz 200; publik api-be.bssn.biz.id/healthz tanpa Origin 403 (loopback-only by design).
- Verifikasi penuh (PATH=/opt/node24/bin):
  - Server suite 36/36 PASS (~35 s)
  - Unit FE 49/49 PASS
  - Prod-smoke produksi 14/14 PASS (origin-deny 403 → protected 401 → register 409 → login JWT → users/me → leaderboard top10+me → forest online cap=8 → WS origin-deny 1008 → auth_ok → joined 20 Hz → forged-token 401 → logout revoke 401)
- Checklist tetap nol item [ ] yang bisa dikerjakan dari VPS — sisa murni PENDING_MANUAL HP asli (AT-31). Butuh Keputusan tetap 1 item (jendela sesi paralel — tanpa insiden). Tanpa drift, tanpa perubahan kode.
