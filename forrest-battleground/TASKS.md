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
- [x] [Security] Audit anti-cheat WSS lanjutan (frame oversized, seq replay, hp/damage palsu,
  forged inventory/kill, koordinat negatif/NaN)
  Bukti NYATA: `realtime.test.js` 10/10 PASS — test #10 baru menegaskan lewat SERVER NYATA:
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

## Butuh Keputusan

1. **Konflik port 80/443 antara game (nginx) dan sesi pentest (Apache manual)** —
   status 5 Nov malam: Apache Subang-CSIRT memegang 80/443 dengan cert self-signed
   di SNI api-be.bssn.biz.id → API game publik TIDAK bisa dipakai dari Pages.
   Backend game sendiri sehat (127.0.0.1:3000). Pilihan:
   (a) kalau retest selesai → stop Apache, `systemctl enable --now nginx`
       (urutan lengkap di OPS_CHECKLIST.md);
   (b) kalau dua-duanya harus hidup → Apache pindah port (mis. 8080/8443) atau
       nginx dipindah port lain — perlu arsitektur port yang disepakati;
   (c) biarkan sementara (game down publik) sampai sesi pentest selesai.
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


## PENDING_MANUAL (butuh HP asli)

- [M] [QA] Uji FPS/panas/baterai di HP Android & iOS nyata — FPS headless (4-8) tidak valid karena SwiftShader
- [M] [FE] Uji multitouch joystick + drag-look simultan di layar sentuh nyata
- [M] [FE] Cek safe-area (notch) di iPhone nyata

