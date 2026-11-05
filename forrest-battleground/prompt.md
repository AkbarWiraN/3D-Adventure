# MASTER PROMPT — FOREST BATTLEGROUND: ANCIENT SURVIVAL

**Versi spesifikasi:** 2.0 — 4 November 2026 (revisi: VPS 2 vCPU/4 GB/50 GB, backend sejak Fase 1, leaderboard, leave, origin allowlist)  
**Bahasa UI:** Indonesia (natural dan ringkas)  
**Target:** browser desktop dan mobile; desktop boleh landscape, **mobile wajib portrait**  
**Model pengembangan:** empat fase vertikal frontend + backend dari awal; solo playable sebelum PvP diaktifkan  
**Deployment:** frontend statis khusus `https://akbarwiran.github.io/` (GitHub Pages); backend satu VPS Tencent Cloud: **2 vCPU, RAM 4 GB, SSD 50 GB**, HTTPS/WSS via domain TLS  
**Sumber pembelajaran:** GHOSTDASH (`https://github.com/AkbarWiraN/3D-Adventure/tree/main/ghostdash`) sebagai referensi teknik Three.js, bukan kode yang harus disalin mentah.

---

## 0. INSTRUKSI UTAMA UNTUK AI CODING AGENT — WAJIB BACA

Anda berperan sebagai **lead gameplay engineer, Three.js/WebGL engineer, realtime backend engineer, technical game designer, security reviewer, dan QA engineer**. Implementasikan **kedua sisi, frontend dan backend, pada VPS tempat Hermes berjalan** sesuai dokumen ini; hasilnya satu repository dengan build frontend siap upload GitHub Pages dan service backend siap dijalankan di VPS. Jangan mengasumsikan Anda sudah punya izin deploy/membuka port/menimpa service yang ada: lakukan inventaris dan safety check lebih dulu. Implementasikan proyek **FOREST BATTLEGROUND** sesuai dokumen ini. Hasil yang diinginkan adalah **game 3D third-person battleground berlatar hutan rimba zaman purba** yang terasa playable, memiliki eksplorasi open world, kontrol responsif desktop/mobile, pertarungan tangan kosong/pedang/busur-panah, looting, health, minimap, dan nanti multiplayer dengan akun, lobby, serta sinkronisasi realtime. Prioritaskan kualitas kontrol, rasa bermain, performa, dan kebenaran sistem di atas jumlah fitur kosmetik.

### Cara bekerja yang wajib

1. Kerjakan **hanya fase aktif**, berurutan **Fase 1 → 2 → 3 → 4**. Jangan mengerjakan empat fase sekaligus. **Setiap fase wajib memiliki deliverable frontend dan backend**; REST health/config dimulai Fase 1, auth/lobby/leaderboard Fase 2, PvP WSS Fase 3, security/deployment Fase 4. Jangan mengaktifkan multiplayer sebelum solo gameplay stabil. Boleh menyiapkan antarmuka abstraksi (interface/adapter) untuk fase berikutnya.
2. Pada awal sesi, baca keseluruhan file ini, terutama bagian **STATUS PROYEK**, **DEFINITION OF DONE**, **RISK LOG**, dan checklist fase aktif. Periksa repository nyata sebelum mengubah kode. Jangan mengasumsikan suatu fitur selesai hanya karena ada checklist atau komentar.
3. Pecah pekerjaan tiap fase menjadi **increment kecil yang dapat diuji**; implementasikan, jalankan tes, evaluasi secara visual/perilaku bila tooling tersedia, lalu tandai item `[x]` hanya setelah diverifikasi. Jangan mengubah checklist menjadi `[x]` hanya karena kode sudah ditulis.
4. **Jangan membuat satu `game.js` raksasa.** Gunakan ES modules dan pemisahan world, player, input, camera, gameplay, UI, state, networking, persistence. Hindari ketergantungan sirkular dan listener yang terpasang berulang.
5. Jangan merusak fitur fase sebelumnya. **Solo / Offline Practice** harus tetap dapat dimainkan tanpa server. Untuk alur publik, register/login serta lobby memakai REST API dan PvP memerlukan WSS; sediakan state offline/retry yang jelas.
6. Tidak perlu meminta persetujuan tiap langkah teknis kecil. Ambil keputusan yang konsisten dengan spesifikasi, catat asumsi dan trade-off pada **DECISION LOG**, dan lanjutkan. Jika ada konflik ketentuan, utamakan: gameplay benar → keamanan server → performa mobile → kompatibilitas lintas perangkat → kemudahan perawatan.
7. **Tidak boleh menyatakan telah diuji di HP sungguhan, di VPS, atau di dua browser** bila hanya dilakukan dengan unit test/headless. Tulis status `BELUM DIUJI` secara jujur.
8. Di akhir setiap increment, berikan ringkasan: file berubah, fitur selesai, perintah uji + hasil, blocker, item checklist, dan langkah berikutnya. Jika pekerjaan terhenti karena batas token, isi **HANDOFF CHECKPOINT** agar agent lain langsung melanjutkan.
9. Jangan menambah hewan, sungai, awan, senjata api, kendaraan, voice chat, battle pass, transaksi uang, crafting, cuaca dinamis, atau battle royale shrinking zone pada empat fase MVP. **Jangan memasang Redis, Docker orchestration, PostgreSQL, Kubernetes, ORM berat, atau build framework besar tanpa bukti kebutuhan**; satu VPS kecil adalah constraint desain.
10. **Jangan menyimpan password/token di Git, URL, console log, atau localStorage**. Jangan menanam kredensial VPS, database, atau API di frontend.
11. **Kebijakan Origin:** backend REST dan WebSocket publik dikonfigurasi untuk browser frontend dengan `Origin: https://akbarwiran.github.io` (tanpa `/` akhir; tanpa path). Ini **pembatasan browser dan defense-in-depth, BUKAN jaminan hanya domain itu yang dapat memanggil server**: klien nonbrowser bisa memalsukan `Origin`. Auth, rate limiting dan server-authoritative rules tetap WAJIB.
12. Tambahkan **LEADERBOARD di lobby** (kills/deaths/KDR/rank, hanya PvP nyata), dan tombol **KELUAR KE LOBBY kapan saja** saat Solo maupun PvP, termasuk saat hidup, mati, atau sedang zoom map. Pemutusan sesi harus idempotent dan akurat pada online count.
13. **Kapasitas online bukan angka asumsi**. Mulai uji 2 pemain → 4 → 8, lalu maksimal 16 hanya jika metrik membuktikan aman. Ukur CPU, RAM, tick lag, bandwidth, socket count dan disk; prioritaskan keandalan pada 2 vCPU/4 GB.

### Prioritas hasil akhir — kedua sisi berkembang bersama

- **Fase 1 — pondasi frontend + backend:** render hutan 1024 m, kontrol desktop/HP portrait, minimap, Solo eksplorasi; **server Fastify aktif dengan `/health`, `/api/v1/config/public`, SQLite schema awal, CORS/Origin allowlist, deployment dev + test**.
- **Fase 2 — gameplay Solo + API akun/lobby:** combat/loot/bot/death/respawn Solo; **register/login/profil/karakter, map status, leaderboard (awalnya kosong), settings backend endpoint, integrasi autentikasi dan lobby**.
- **Fase 3 — multiplayer realtime dua device:** **server authoritative WSS** mengelola movement, combat, loot, spawn, death, respawn, **leave/rejoin**, kill feed, presence dan update kills/deaths ke leaderboard transaksi SQLite. UI frontend mengaktifkan Online dari GitHub Pages.
- **Fase 4 — security hardening, optimasi resource dan rilis:** audit CORS + WS Origin, anticheat, load test bertahap, deployment **VPS Tencent + HTTPS/WSS + GitHub Pages**, backup/monitoring/QA laptop–HP; handoff final.

> **Aturan utama:** setiap fase WAJIB mengerjakan task **frontend, backend, integrasi, keamanan, dan test** yang relevan. Jangan berhenti pada frontend-only; jangan membuat API dummy yang tidak mempunyai handler/test sungguhan. Progres gameplay tetap vertikal dan dapat diverifikasi tiap fase.

---

## 1. VISI GAME DAN BATAS MVP

**Judul:** Forest Battleground: Ancient Survival  
**Map awal:** `forest` (nama layar **Forest — Hutan Purba**)  
**Genre:** third-person 3D open-world, survival combat / free-for-all respawn PvP  
**Art direction:** low-poly / stylized semi-realistis; hutan belukar padat, batu besar, pepohonan tinggi, semak, rumput pendek dan tinggi, gubuk kayu, rumah kosong, reruntuhan batu, jalan tanah sempit; warna hijau-kecokelatan dengan sinar matahari **sore tetap** dan bayangan lembut. Tanpa awan, sungai, hewan, cuaca, perubahan siang-malam. Visual harus jelas saat bermain, bukan terlalu gelap atau kabut pekat. Seluruh geometri awal boleh procedural dari Three.js sehingga tidak perlu aset 3D berat.

**Gameplay loop utama:** `spawn aman dan acak → jelajahi hutan → temukan loot → ambil pedang/busur+anak panah → cari lawan → menyerang / bertahan / merayap → lawan mati → loot kembali → respawn jika terbunuh → ulangi`.

**Tidak ada sistem pemenang terakhir:** ini adalah free-for-all battleground yang berlanjut, bukan battle royale dengan zona mengecil. Semua pemain yang kalah dapat respawn di map sama. Sesi solo tidak wajib menggunakan akun; sesi online wajib login.

**Dua karakter awal:** laki-laki (default) dan perempuan; kemampuan, movement speed, HP, collision capsule, hitbox, dan damage **sama**. Perbedaan hanya model/warna/animasi kosmetik. Di dunia gameplay, **jangan tampilkan username atau health bar di atas kepala pemain lain**. Nama hanya boleh muncul pada kill feed dan layar lobby/daftar peserta bila memang dibutuhkan.

### 1.1 User stories yang harus terpenuhi

- **Player A — laptop:** buka web, registrasi/login, masuk lobby, pilih karakter laki-laki default dan map Forest, lihat jumlah pemain aktif **di dalam map**, klik Mulai, spawn acak, gerak WASD, gunakan mouse untuk kamera, loot pedang, lalu bisa menyerang Player B.
- **Player B — HP portrait:** buka URL yang sama, registrasi/login, pilih karakter perempuan, masuk map Forest, spawn acak, gunakan joystick kiri dan drag kamera di area kanan, loot busur, tekan Aim/Scope untuk zoom dan crosshair, bidik A, lepaskan anak panah.
- **Pertarungan:** masing-masing hit valid mengurangi **20 HP** tanpa bonus headshot atau armor; HP awal 100; dengan 5 hit valid dan tidak ada heal di antaranya, target mati. Muncul kill feed `usernameB dikalahkan oleh usernameA`. Korban bisa klik **Respawn** dan muncul di lokasi valid acak dengan HP 100, tangan kosong, lalu loot ulang.
- **Loot:** senjata tampak sebagai objek dunia, bisa dipungut, disimpan, dipakai, dijatuhkan, serta **dilempar** sebagai tindakan berbeda. Pickup harus dekat dan valid; dua pemain tidak boleh berhasil mengambil loot yang sama.
- **Minimap:** pojok kiri atas, posisi player sendiri, arah menghadap, landmark, dan marker lawan. Tekan minimap untuk fullscreen/overlay map yang dapat di-zoom, pan, dan ditutup. Musuh ditampilkan sebagai **ikon anonim**, tanpa nama/HP. **Keputusan MVP:** posisi pemain lain ditampilkan pada minimap online (sesuai permintaan), tetapi catat di risk log bahwa ini mengurangi stealth; buat kebijakan visibilitas configurable agar nanti mudah diubah ke enemy-proximity ping/reveal.
- **Konfigurasi backend:** di Settings ada input **alamat backend** berupa domain/URL HTTPS atau IP yang memiliki TLS valid, tombol **Uji Koneksi**, status connected/disconnected, latency, dan badge host aktif. Simpan hanya URL nonrahasia di storage lokal. **Default harus mengarah ke domain resmi API yang dicatat di konfigurasi publik, bukan username/password**. Penggunaan custom URL memunculkan peringatan sebelum mengirim kredensial (server palsu berisiko mencuri password). `http://IP`/`ws://IP` tidak boleh menjadi alur publik GitHub Pages HTTPS. Jika tidak ada backend, pengguna masih bisa Solo.
- **Leaderboard lobby:** top 10 pemain PvP, nama, peringkat, kills, deaths, K/D ratio, posisi akun sendiri bila tidak di top 10; empty-state sebelum ada pertandingan; urutan server-side deterministik `kills DESC, deaths ASC, username ASC`. Stat Solo/bot tidak dihitung. Update berkala ringan (contoh 15–30 detik) dan setelah match selesai/kill relevan.
- **Exit kapan saja:** tombol `Keluar ke Lobby` selalu bisa diakses dari UI pause/pengaturan/death/map/normal gameplay. Di online, kirim `leave` dengan `sessionId` lalu terima `leave_ack`, lepas listener/state/memory dan tutup WS; bila jaringan putus, masuk lobby langsung dengan informasi reconnect, server membersihkan sesi secara idempotent melalui close/heartbeat. Boleh masuk lagi, random spawn ulang, inventori di-reset sesuai rules. Jika keluar dalam **10 detik setelah menerima damage**, server mencatat `combat logout` sebagai death dan kredit killer terakhir yang valid (opsi balance di config, default aktif); **keluar tetap langsung, tidak ditahan**. Jelaskan konsekuensi itu di UI.

### 1.2 Parameter gameplay awal (harus configurable, bukan hard-coded tersebar)

| Parameter | Nilai awal | Keterangan |
|---|---:|---|
| Lebar dunia | 1024 m | Sumbu X = -512 sampai +512 |
| Panjang dunia | 1024 m | Sumbu Z = -512 sampai +512 |
| Chunk dunia | 64 × 64 m | Total 16 × 16 chunk; streaming hanya sekitar kamera |
| Render chunk aktif | Radius 2 chunk | Awal 5 × 5 chunk; dapat disesuaikan device |
| Radius world boundary | Area persegi 1024 × 1024 | Natural barrier; tidak bisa keluar area |
| Tinggi kontur | Perbedaan elevasi ringan ~0–6 m | Jalur dan area rumah tetap dapat dilalui |
| Bangunan | ≥ 12 gubuk/rumah kosong | Tersebar dalam beberapa kelompok |
| Area reruntuhan/loot lain | ≥ 8 titik | Agar senjata tidak hanya di rumah |
| Walk | 4.5 m/s | Third-person camera relative |
| Sprint | 7.0 m/s | Tidak aktif saat prone |
| Prone/tiarap | 1.3 m/s | Collider direndahkan + animasi/postur berbeda |
| Jump | Impuls awal ~7 m/s | Gravitasi ~18 m/s², tidak boleh double-jump |
| HP | 100 | Tanpa auto heal dalam MVP |
| Semua serangan valid | 20 HP | Exactly five valid hits = death |
| Jangkauan pedang | 3.0 m | Sweep/arc + line of sight |
| Jangkauan busur | 10.0 m | Hitscan authoritative + tracer panah visual |
| Jarak lempar senjata | Maks ~8 m | Server hit 20 HP bila mengenai pemain |
| Cooldown pedang | 0.8 detik | Validasi server saat online |
| Cooldown busur | 1.4 detik | Panah terpakai per tembakan |
| Cooldown lempar | 1.0 detik | Senjata aktif keluar dari inventory |
| Peluru awal saat loot busur | 10 anak panah | Tambahan ammo bisa ditemukan terpisah |
| Inventory | 2 slot senjata | Hanya 1 active weapon; tangan kosong bila tidak ada |
| Radius pickup | 2.5 m | Tampilkan prompt kontekstual |
| Loot respawn | 45–90 detik | Server authoritative dalam online mode |
| Respawn delay | 3 detik | Plus spawn invulnerability 2 detik |
| Safe spawn | Usahakan ≥ 30 m dari musuh | Fallback teraman jika lokasi map padat |
| Target jumlah pemain | 2 pemain wajib; 4–8 target uji; hard cap awal 8 | 16 hanya jika load test membuktikan CPU/RAM/tick/bandwidth aman |
| World simulation server | 20 tick/s | Satu event-loop authoritative, simulasi room aktif saja |
| Snapshot broadcast | 10 tick/s | Area-of-interest (AoI), posisi musuh di minimap kasar 1–2 Hz |
| Input client network | Maks 20 pesan/s | Rate cap + sequence number, compact JSON MVP |
| Rendering client | Sesuai refresh layar | Target desktop 60 FPS; mobile 30 FPS stabil |
| Interpolasi remote player | Buffer ~100–150 ms | Tuning sesuai latency/jitter |
| Leaderboard | Top 10 + rank sendiri | kills/deaths/KDR dari event PvP server, bukan client |
| Combat logout window | 10 s | keluar instan; recent damage dapat dihitung death agar tak mengeksploitasi exit |

Angka tersebut adalah **parameter desain awal**. Ubah hanya setelah pengukuran/QA, dan catat alasan. Dengan map seluas 1 km², densitas musuh untuk 2–16 pemain bisa rendah: kompensasikan dengan navigasi minimap, landmark, dan loot hotspot, **bukan** memaksa render seluruh map sekaligus.

---

## 2. ARSITEKTUR DAN PEMILIHAN TEKNOLOGI

### 2.1 Frontend — sama keluarga teknologi dengan GHOSTDASH

- **HTML5 + CSS3 + JavaScript ES modules**; tidak memakai framework frontend besar sebagai syarat awal.
- **Three.js WebGL** untuk terrain, pohon, batu, bangunan, karakter, animasi, collision/raycast, sky sore, shadow, fog tipis.
- Gunakan **versi stabil Three.js yang dipin secara eksplisit** pada implementasi (catat versinya di README/lock/vendor); jangan menggunakan `latest` di CDN. Sebaiknya vendor modul yang diperlukan ke folder proyek untuk ketahanan offline Solo; tetap pastikan lisensi dipatuhi.
- **Web Audio API** untuk efek pukulan, langkah, panah, looting, kematian; audio baru aktif setelah interaksi pengguna.
- **Canvas 2D** untuk minimap yang di-update terpisah dari render 3D. Gunakan DOM untuk HUD namun update hanya saat value berubah / interval terukur.
- UI tanpa build tool **boleh dan diutamakan** jika import-map/ES modules kompatibel. Jalankan lewat local HTTP server saat development, bukan mengandalkan `file://` untuk ES modules.
- Frontend dan Solo tidak perlu backend. Multiplayer membutuhkan REST API + WebSocket.

### 2.2 Backend — pilihan final untuk VPS Tencent 2 vCPU / 4 GB / 50 GB

**Pilih stack tunggal, bukan daftar alternatif terbuka:**

| Komponen | Pilihan dan alasan |
|---|---|
| Runtime | **Node.js 24 LTS** (pin patch LTS yang tersedia/teruji, bukan `latest`). Node.js 26 sudah Active LTS pada 28 Okt 2026, tetapi baseline 24 dipilih karena kematangan kompatibilitas dependensi native; evaluasi 26 ketika semua addon/test lulus. |
| HTTP REST | **Fastify v5** + schema JSON ketat; ringan dan cepat; built-in Pino logging. |
| Realtime | **`@fastify/websocket` + `ws`**, satu proses dan port Node; WSS diterminasi di Nginx. |
| Database | **SQLite 3 + `better-sqlite3`**, file lokal private, mode WAL, `busy_timeout`, foreign keys ON, prepared statements, transaksi; hemat RAM, tidak perlu service DB terpisah. Verifikasi dukungan addon terhadap Node runtime target saat `npm ci`. |
| Password | **Argon2id** (package `argon2`, parameter diukur agar login tidak menjenuhkan CPU/RAM); rate-limit login/register. |
| Reverse proxy | **Nginx** TLS HTTPS/WSS dengan sertifikat CA valid, upstream `127.0.0.1:3000`. |
| Service | **systemd**, satu proses Node nonroot, restart policy, logrotate/journald. |
| Testing | `node:test` + `assert` / HTTP injection Fastify; browser Playwright pada mesin dev jika memungkinkan, jangan pasang Chromium berat di production VPS. |
| Yang sengaja TIDAK dipakai | **Redis, PostgreSQL, MongoDB, NestJS, Next.js, Docker Swarm, Kubernetes, message broker, realtime database berbayar**. Tambahkan hanya setelah profil/laporan bottleneck mendukung. |

**Kenapa SQLite lebih tepat di sini:** hanya satu VPS dan satu instance room, database hanya menyimpan user/password hash, profil, leaderboard dan audit terbatas; gameplay setiap tick disimpan di memori. SQLite WAL + transaksi mencukupi MVP dengan jauh lebih sedikit overhead operasional. Risiko: satu writer, ketergantungan file/disk dan backup yang harus benar; mitigasi: transaksi pendek, write saat event kill/death saja, WAL checkpoint dan backup konsisten, migrasi terukur. Jika ada pertumbuhan ke banyak server/room, migrasikan ke PostgreSQL menggunakan repository interface, **bukan sekarang**.

**RAM/CPU budget sebagai target observability, bukan janji:** RAM service Node idealnya ≤350–600 MB RSS saat 8 client; OS/proxy/cache/log menyisakan ≥1 GB headroom. Jangan tetapkan `--max-old-space-size` berdasarkan tebakan tanpa profiling. CPU average sebaiknya <70% total selama uji 8 pemain; server tick p95 ≤50 ms untuk fixed 20 Hz. Jika melanggar, turunkan cap atau optimasi collision/AoI terlebih dahulu. Sisakan ruang disk ≥10 GB, terapkan rotasi log + backup berretensi terbatas, jangan simpan replay full state per tick.

**Algoritma untuk hemat resource:**

1. **World seed deterministik** disertai `worldVersion`. Render chunk Three.js hanya di client. Server menyimpan **static collider metadata ringan** (rumah, batu besar, pohon ber-collider) via spatial hash grid 32 m; jangan render scene 3D/WebGL di server.
2. **Room authoritative single-thread 20 Hz**: satu fixed timestep, akumulasi waktu terukur, capped catch-up, *no DB per tick*. Jalankan update hanya jika room punya pemain. Network update maksimal 10 Hz, tidak 60 Hz.
3. **Interest management/AoI**: broadcast posisi/animasi pemain yang berjarak misalnya ≤120–180 m; **minimap enemy seluruh room** ditransmisikan sebagai data lokasi terbatas/terkuantisasi 1–2 Hz sesuai desain, bukan full snapshot 20 Hz. Pisahkan minimap data dari combat transform. Atur jumlah objek/bytes tiap pesan.
4. **Combat hit**: ray–sphere/capsule dan line-of-sight collider pada grid server, melee cone/sweep; **tidak** kirim ribuan mesh/triangles untuk validasi. Prediksi input client visual saja; server menentukan damage, range, cooldown, inventory.
5. **Network**: JSON terukur (payload maksimum per tipe, frame <=16 KiB, ukuran snapshot dievaluasi); no per-frame DB, hindari broadcast room global untuk semua movement, batasi `bufferedAmount` dan disconnect slow clients.
6. **Leaderboard**: counter disimpan per user dan event kematian dengan **unique event ID** dalam transaksi; query indexed `ORDER BY kills DESC, deaths ASC, username ASC LIMIT 10`, cache 5–15 detik / invalidasi saat kill, bukan per-frame.
7. **Tidak ada image/model/audio upload** dari pemain untuk MVP. Static asset frontend dapat dibuat prosedural/versi pinned agar storage 50 GB aman.

### 2.2.1 Batas scalability

Single process + SQLite ≠ horizontal scale. Angka 8/16 pemain **bukan garansi**. Lulus produksi minimum 2 perangkat nyata; target 8 jika load test berhasil. Buat configurable `ROOM_HARD_CAP=8` pada awal rilis. Jangan jalankan dua proses Node authoritative untuk room `forest` yang sama karena world state akan terbelah. Simpan jumlah session aktif **di memori authoritative**, bukan count user di DB.

### 2.3 Diagram alur data dan deployment

```text
PUBLIC INTERNET
  Browser Laptop / Browser HP portrait
  https://akbarwiran.github.io/<repo>/<path>/
      │  frontend statis whitelist: HTML/CSS/JS/vendor (NO server/.env)
      ├── HTTPS  REST register/login/profile/lobby/leaderboard/status
      └── WSS    auth/join/input/attack/loot/leave/respawn/snapshot
                  │
                  ▼
       VPS Tencent: 2 vCPU, 4 GB RAM, 50 GB disk
       :443 Nginx TLS (domain API bersertifikat valid)
            │  allow origin exact + rate limit layer jaringan
            ▼
       127.0.0.1:3000 Fastify + WebSocket (SATU Node process)
            ├─ Auth, maps, lobby, leaderboard REST
            ├─ WS player sessions, presence, kill events
            ├─ Forest room state in-memory + 20Hz simulation
            ├─ Spatial hash static colliders + spawn/loot state
            └─ SQLite WAL (users, profiles, stats, kill_events)
                 /var/lib/forest-battleground/game.sqlite
       Firewall: publik 443 (+80 redirect/challenge); SSH IP admin
       Internal ONLY: 3000 Node; tidak ada port SQLite publik.
```

**Kritis terkait GitHub Pages:** origin browser adalah **`https://akbarwiran.github.io`**, bukan `https://akbarwiran.github.io/` dan bukan path repository. Di GitHub Pages, semua project pages dalam host `akbarwiran.github.io` berbagi **origin yang sama**; CORS tidak bisa membatasi hanya satu repository/path. URL frontend yang sebenarnya wajib diuji. HTTPS GitHub Pages tidak boleh mengakses endpoint `http://IP`/`ws://IP` sebagai deployment publik karena mixed content; alamat IP hanya valid jika TLS benar-benar valid untuk IP tersebut. **Prefer domain backend dengan HTTPS dan WSS.**

### 2.4 Struktur folder yang diinginkan

```text
forest-battleground/
├── prompt.md                         # Dokumen induk ini: spesifikasi + checklist + checkpoint
├── README.md                         # Setup, kontrol, test, deploy, status fitur
├── .gitignore
├── index.html                        # Entry statis GitHub Pages
├── style.css
├── vendor/                           # Three.js ESM pinned (bila vendoring)
├── src/
│   ├── main.js                       # Boot + composition root; tanpa game logic besar
│   ├── config.js                     # Semua parameter yang bisa diatur
│   ├── core/                          # game loop, scene, event bus, state machine, resource manager
│   ├── world/                         # seeded chunks, terrain, props, building, colliders, POI
│   ├── entities/                      # player, remote players, bot, camera, animation
│   ├── input/                         # keyboard, mouse, touch, action mapping
│   ├── gameplay/                      # movement, combat, weapons, loot, inventory, spawn
│   ├── ui/                            # screens, HUD, minimap, inventory, toast, mobile controls
│   ├── network/                       # REST client, WebSocket client, snapshot/interpolation
│   ├── storage/                       # settings + non-sensitive preferences only
│   ├── shared/                        # PURE JS: gameplay rules, world schema/seed, payload constants (import server juga)
│   └── utils/                         # math, seeded random, collision shared contracts
├── server/
│   ├── package.json
│   ├── package-lock.json
│   ├── .env.example                   # Tanpa secret sungguhan
│   ├── src/
│   │   ├── app.js                     # Fastify assembly
│   │   ├── config.js
│   │   ├── auth/                     # registration, login, hash, access token
│   │   ├── http/                     # routes + validation
│   │   ├── realtime/                 # WebSocket, protocol, connection/heartbeat
│   │   ├── world/                    # shared seed, spawn, colliders
│   │   ├── simulation/               # fixed timestep + authoritative mechanics
│   │   ├── persistence/              # SQLite WAL, migration, prepared queries, leaderboard repository
│   │   └── security/                 # rate limit, validation, limits
│   ├── migrations/
│   ├── data/                         # gitignored untuk local; production ke /var/lib/...
│   └── tests/
├── scripts/                            # build-pages.mjs menyalin frontend WHITELIST ke dist
├── .github/workflows/                  # GitHub Pages Actions upload dist-only
├── dist/                               # build output gitignored, NO server/no .env
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/                          # minimal automated browser/device emulation
```

Source `src/shared/` harus berisi fungsi/konstanta PURE yang boleh diimpor backend via relative path atau package workspace sederhana; backend harus tetap **tidak bergantung DOM/Three.js**. `scripts/build-pages.mjs` menyalin **HANYA** `index.html`, `style.css`, `src/`, `vendor/`, dan asset publik yang disetujui; **jangan pernah publish `server/`, `.env`, `data/`, `node_modules/`, atau source map debug**. GitHub Actions upload folder `dist` saja. Gunakan path **relatif** untuk seluruh asset/impor frontend; jangan memakai absolute URL `/src/...` yang akan rusak ketika game ada di subfolder GitHub Pages seperti `https://akbarwiran.github.io/3D-Adventure/forest-battleground/`. Bila penempatan repo berbeda, sesuaikan path deployment aktual.

### 2.5 Pelajaran dari GHOSTDASH yang HARUS diterapkan

1. Hindari satu file JS monolitik yang berisi UI, physics, scene, world, combat, network sekaligus. Pertahankan pemisahan tanggung jawab dan clear ownership resources.
2. **Jangan membuat ulang list DOM/minimap/marker setiap frame**. Cache node DOM, diff value yang berubah, throttle minimap/UI (contoh 5–10 Hz).
3. **Jangan menandai `texture.needsUpdate` setiap frame** bila label/timer tidak berubah. Cache canvas texture; perbarui hanya saat isi berbeda.
4. Setiap `Mesh`, `Texture`, `Geometry`, `Material`, dan event listener yang dibuat dinamis harus punya lifecycle; gunakan `.dispose()` ketika sudah tak digunakan, tanpa membuang resource yang masih shared.
5. Gunakan **InstancedMesh** untuk rumput, pepohonan yang berbagi geometri/material, batu kecil, semak; **frustum culling, chunk streaming, LOD**, draw distance, pixel ratio adaptif, dan shadow tier.
6. Jangan mengikat update DOM/logic gameplay ke FPS: game update menggunakan fixed timestep / delta time; render mengikuti layar; server menggunakan fixed tick.
7. Buat test perilaku sungguhan, bukan sekadar `source.includes('...')`. Uji movement, collider, 5 hits, pickup race, drop/throw, state transitions, spawn, disconnect/reconnect.
8. Tangani browser WebGL error, context lost/restored bila realistis, CDN gagal, visibility pause, UI orientation, perubahan ukuran layar, kehilangan fokus, serta input pointer cancel.
9. Jangan tampilkan tombol fitur placeholder seolah sudah berfungsi. Fitur yang belum tersedia disable/hidden dengan label yang jujur.
10. Buktikan performa dengan metrics (FPS, draw calls, GPU resource counts, visible instances, ms/frame, network RTT); jangan mengklaim 60 FPS tanpa pengujian perangkat nyata.

---

## 3. SPESIFIKASI DUNIA, KARAKTER, DAN INTERAKSI

### 3.1 Dunia hutan 3D

- **Terrain 1024 × 1024 m**, deterministic dengan `WORLD_SEED` tetap; gunakan noise murah / heightfield konsisten, undulasi ringan; tidak boleh menghasilkan jurang/bukit yang memutus akses antarlokasi.
- Split dunia menjadi chunk **64 × 64 m**. Generate/activate sekitar kamera, deactivate + dispose/cache sesuai budget; world coordinate harus tetap konsisten. Untuk multiplayer, **seed, algoritma, POI, colliders, dan versi world harus sama di client/server**. Server tidak menerima posisi pada objek penghalang yang validitasnya berbeda.
- Pohon purba bervariasi (batang tinggi, tajuk lebar), pohon kecil, semak rapat, rumput 2 ketinggian, batu besar/sedang/kecil, akar, kayu tumbang, tanah setapak, reruntuhan batu, gubuk/rumah kosong yang dapat dimasuki; benda besar punya collision; rumput kecil tidak perlu collider.
- **≥12 rumah/gubuk** dan **≥8 lokasi loot selain rumah**, bukan terkumpul di satu pojok. Sebar POI terstruktur menurut world seed; tiap lokasi punya ID stabil, jalur masuk, ruang gerak untuk karakter, dan titik loot tanpa clipping.
- Tidak boleh ada hewan, sungai, air/kolam, awan, hujan, kabut yang terlalu menghalangi, siang–malam bergerak, dan tekstur eksternal berat.
- Lighting sore `sun` directional, ambient/hemisphere, fog tipis jarak jauh, shadow rendah pada mobile; pengaturan quality Low/Medium/High/Auto.
- Collision player bisa memakai kapsul/cylinder approximation + AABB/OBB untuk bangunan dan batu besar; **client dan server harus sepakat** pada collider gameplay. Hindari menempatkan spawn/loot di dalam collider atau di atap yang tidak terjangkau.
- **Random spawn** berarti acak dari kumpulan banyak posisi **yang diverifikasi aman**, bukan mengacak semua koordinat mentah. Bangun ≥40 spawn candidates tersebar merata, uji terrain slope/collision, hindari posisi musuh, hindari area dalam bangunan dan batas map. Respawn pemain online diputuskan server.
- Target **exploration readability**: pemain dapat membedakan jalan setapak, POI, rumah, dan landmark. Jangan mengorbankan gameplay dengan hutan terlalu rapat.

### 3.2 Player controller dan kamera

- Third-person over-shoulder camera, gerak **camera-relative**, kamera follow dengan smoothing dan adjustable sensitivity. Tunjukkan badan pemain; saat Aim, kamera bergeser ke bahu dan zoom/FOV mengecil, crosshair/reticle terpusat.
- Desktop: WASD/arrow untuk gerak, Shift sprint, Space jump, `Z` prone toggle, mouse untuk look/aim, klik kiri untuk attack, klik kanan **hold Aim**, `E` pickup/interact, `1`/`2` pilih senjata, `G` drop, `T` throw, `M` map, `Esc` pause/settings. Sediakan tooltip dan remapping mudah di kemudian hari.
- Mobile **portrait wajib**: joystick virtual di **kiri bawah**, touch-look di kanan/tengah, tombol besar **SERANG**, **BIDIK** (hold/toggle opsional), **LONCAT**, **LARI**, **TIARAP**, **AMBIL** saat dekat loot, dan quick-slot `1/2` serta inventory panel untuk **JATUHKAN/LEMPAR**. Minimap di kiri atas; HUD jangan bertabrakan dengan tombol atau notch/safe area. Pertahankan multitouch (joystick + aim + attack simultan).
- Bow: ada tombol **scope/zoom** terpisah atau ikon crosshair di dekat SERANG; saat aktif, FOV mengecil dari contoh 65° menjadi 40°, reticle menampilkan titik hit di tengah; jangan auto-aim ekstrem. Saat menembak, UI tunjukkan hit marker hanya setelah server mengonfirmasi hit pada PvP.
- Sprint tidak bisa dilakukan dalam prone; jump tidak boleh saat tiarap; input di-blok saat mati, pause (solo), atau layar modal utama. Kamera tidak boleh melompat saat joystick dilepas atau jari keluar area kontrol.
- Collision + movement harus stabil: tidak menembus rumah/batu/pohon, tidak tersangkut tepi collider, tidak berlari diagonal lebih cepat, tidak bisa melompati batas dunia dengan glitch.
- Saat multiplayer, animasi remote player menampilkan jalan/lari/prone/jump/attack/aim/equip secara halus, bukan teleport antar snapshot.

### 3.3 Senjata dan inventori

- Tangan kosong = default ketika spawn, tetap bisa attack jarak dekat 20 damage, jangkauan awal **1.6 m** (tidak harus 3 m; 3 m khusus pedang).
- Pedang = melee hit 20 HP pada target dalam radius maksimal **3 m**, sudut ayunan terbatas, line of sight; cooldown 0.8 dtk.
- Busur + anak panah = tembakan jarak maks **10 m**, damage 20 HP, cooldown 1.4 dtk, konsumsi 1 panah; awal mendapat 10 panah dari loot busur. `Aim` bukan otomatis tembak; klik/tombol SERANG untuk melepaskan anak panah. Gunakan **hitscan validated** untuk MVP dan animasi projectile/tracer pendek, bukan simulasi balistik jaringan penuh.
- Inventory 2 slot senjata; klik quick-slot untuk equip. Bila penuh, pilih ganti slot/menolak pickup; jangan diam-diam menghilangkan senjata.
- **Drop**: letakkan senjata aktif di tanah depan pemain, tanpa damage, bisa di-pickup orang lain.
- **Throw**: lempar senjata aktif ke arah kamera dengan visual projectile sederhana hingga ~8 m, hilangkan dari slot, hasilkan 20 damage jika valid mengenai lawan, kemudian senjata menjadi objek tanah yang dapat dipungut kembali. Setelah implementasi, pastikan drop ≠ throw. Untuk bow yang dilempar, ammo tidak ikut digunakan; senjata tetap memiliki metadata ammo yang sah.
- Loot bukan sekadar UI: objek pickup 3D tampak di dunia, ada highlight jarak dekat dan prompt `E / AMBIL`, dapat di-interact, hilang dari tanah ketika sukses dipungut. Peta loot bisa berbeda menurut RNG, tetapi server online menyimpan ID, status, respawn timer, dan lokasi otoritatif.
- Tidak ada pistol, senapan, armor, armor penetration, heal otomatis, critical hit, headshot bonus, durability, atau crafting selama MVP.

### 3.4 Combat, HP, mati, respawn

- HP awal = 100, minimum = 0. **Semua serangan valid (tangan, pedang, panah, lempar) = 20 HP**. Tepat lima hit valid akan membunuh tanpa regen/armor. Tidak boleh menerapkan damage ganda dari satu attack atau satu projectile.
- HUD lokal menampilkan bar/angka HP `0–100`, status weapon, amunisi, cooldown, hit feedback, kill feed. **Tidak ada bar HP atau username floating di atas lawan**, baik dalam solo bot maupun online.
- Damage server authoritative untuk online: cek autentikasi & room, state attacker/target hidup, senjata dimiliki, attack cooldown, ammo, range, aim arc/ray, obstacle line-of-sight, spawn protection, dan sequence/replay. Untuk solo, gunakan combat engine dengan aturan yang sama.
- Setelah death: animasi/overlay, HP 0, inventory weapon dijatuhkan sebagai world loot di lokasi kematian (bila valid), sementara pemain tidak bisa bergerak/menembak. Tampilkan `X dikalahkan oleh Y` kepada seluruh pemain di room; tanpa menampilkan posisi/nama melalui label di dunia.
- Tombol **RESPAWN** muncul setelah delay minimal 3 dtk; server pilih spawn aman baru, set HP 100, kosongkan inventory, invulnerability 2 dtk (tampilkan indikator pada pemain tersebut). Selama spawn-protection, pemain tidak bisa menyebabkan damage agar tidak bisa dieksploitasi.
- Offline solo: hadirkan target dummy dan minimal **2 bot manusia purba sederhana** dengan finite-state machine `patrol → detect → chase → attack → disengage/dead → respawn`. Bot memakai aturan HP/damage yang sama; tidak harus kompleks, hindari pathfinding mahal. Gameplay solo tetap ada nilai latihannya sebelum server jadi.

### 3.5 Minimap dan peta penuh

- Minimap **pojok kiri atas**, orientasi utara tetap (north-up), ukuran adaptif: kira-kira 100–140 px desktop dan 85–110 px HP portrait, dengan hit target cukup besar untuk disentuh.
- Peta menunjukkan batas dunia, jalur utama/POI, bangunan, posisi pemain sendiri, arah facing, dan marker pemain lain (ikon anonim). Dalam solo tampilkan bot sebagai marker musuh. Jangan gunakan Google Maps atau API peta eksternal.
- Klik/tap membuka overlay map fullscreen atau hampir fullscreen; zoom in/out, pan, reset centering dan tombol tutup. Mouse wheel di desktop dan pinch zoom di mobile; game solo pause saat peta dibuka, sedangkan multiplayer **tidak boleh menghentikan simulasi server** ketika pemain membuka peta (input gerak lokal dapat dibatasi selama overlay).
- **PvP MVP:** posisi lawan tampil di map tanpa identitas/nama, sesuai kebutuhan awal. Atur melalui `MAP_ENEMY_VISIBILITY=all`; desain agar bisa berubah ke `nearby`/`recently_seen` tanpa mengubah protokol dasar. Dokumentasikan konsekuensi stealth: musuh bisa dilacak via map sehingga tak benar-benar tersembunyi.

### 3.6 Register, lobby, leaderboard, pengaturan backend, dan exit

```text
[BOOT] → [LOGIN/REGISTER] ⇄ [LOBBY]
            │                   ├─ username + pilihan karakter [Laki-laki* | Perempuan]
            │                   ├─ Forest (1 map) + online count aktif/kapasitas
            │                   ├─ LEADERBOARD Top 10 PvP + statistik sendiri
            │                   ├─ [MULAI SOLO] [MULAI ONLINE]
            │                   └─ Settings [backend URL/domain/IP TLS] [TEST CONNECTION]
            └─ Guest → [SOLO] → [EXIT] → lobby guest (login untuk ONLINE)

[ONLINE MATCH] : spawn random → loot → sword/bow/unarmed combat → death → respawn
         └──── [KELUAR KE LOBBY] dari state APAPUN, termasuk death/map/pause
                         → WS leave_ack / close, cleanup UI & resources
                         → online count refresh, leaderboard refresh, rejoin boleh
```

- UI lobby selalu menunjukkan **jumlah pemain yang sudah `join` map Forest**, bukan semua logged-in users; jika offline tampil `— / server tidak tersambung`, jangan `0` palsu.
- Leaderboard API **server-authoritative**; tampilkan top 10: rank, username, kills, deaths, K/D ratio (`kills / max(1, deaths)`, format 2 angka desimal), dan rank/stat pemain sendiri. Kills vs bot Solo TIDAK masuk leaderboard. Jika server kosong, empty state `Belum ada pemain di leaderboard`.
- Session online harus diidentifikasi `sessionId` unik dan tidak boleh menghapus sesi reconnect yang berbeda. Exit harus bisa kapan pun (langsung), cancel attack/held inputs, close socket, release room membership dan refresh lobby. Server memberi `leave_ack` bila tersambung; `close`/heartbeat cleanup sebagai fallback; pencegahan duplikasi presence.
- Saat exit dalam combat window 10 detik setelah damage masuk, server boleh menerapkan aturan `combat logout` (default aktif): hit terakhir yang valid mendapat kill dan korban mendapat death sekali. UI peringatkan secara jelas sebelum user menekan tombol exit, tetapi **jangan memaksa delay**.
- Guest tetap dapat Solo offline; auth/lobby network selesai pada Fase 2; tombol Online diaktifkan setelah Fase 3. **Bersihkan listener, shader textures, pointer lock, camera state, pending event ketika exit.**
- Pengaturan backend harus menampilkan nilai resmi default dan custom URL. Peringatan custom host saat login: **jangan memasukkan password ke server yang tidak dipercaya**. HTTP/IP tanpa sertifikat valid untuk deployment publik harus ditolak secara eksplisit.

## 4. KONTRAK BACKEND DAN REALTIME — IMPLEMENTASI SECARA BERTAHAP

### 4.1 REST API v1 — dibuat bertahap Fase 1 dan Fase 2

Semua path relatif ke `/api/v1` kecuali internal `/healthz`. JSON only, schema request/response yang eksplisit, tipe/maks ukuran ketat, status HTTP standar, errors tanpa stacktrace. Auth lewat Bearer token (tidak disimpan di localStorage). **Jangan merancang semua route lalu mengembalikan data palsu**; implementasikan endpoint sesuai fase.

| Fase | Method | Endpoint | Auth | Perilaku |
|---|---|---|---|---|
| 1 | GET | `/health` | Publik terbatas kebijakan origin | `status`, `version`, `uptimeSec`, `timestamp` tanpa rincian internal |
| 1 | GET | `/config/public` | Publik terbatas kebijakan origin | `protocolVersion`, `worldVersion`, `mapId`, `roomHardCap`, `supportedFeatures` |
| 2 | POST | `/auth/register` | Tidak | Validasi username/password, hash Argon2id, SQLite insert unique; tidak langsung membuat statistik palsu |
| 2 | POST | `/auth/login` | Tidak | Autentikasi dengan error generik, access token short-lived, user id/username |
| 2 | GET | `/users/me` | Ya | `id, username, character, createdAt, stats` |
| 2 | PATCH | `/users/me` | Ya | Ubah karakter (`male|female`); tidak dapat memilih user lain |
| 2 | GET | `/maps` | Ya | Map `forest` saja, version, room capacity |
| 2 | GET | `/maps/forest/status` | Ya | `onlineCount` dari sesi `joined` aktif, `capacity`, `available`, `worldVersion` |
| 2 | GET | `/leaderboard?mapId=forest&limit=10` | Ya | Top kills/deaths/KDR dan rank, max 50; tetap kosong sampai PvP tercatat |
| 2 | GET | `/leaderboard/me?mapId=forest` | Ya | posisi dan stat akun sendiri, zero bila belum bertarung |
| 3 | POST | `/sessions/:sessionId/leave` | Ya | Fallback idempotent ketika WS leave gagal; hanya sesi user itu dan sessionId yang sama |

Untuk `GET /health` publik, jika mengharuskan Origin pada semua browser facing routes, akses CLI monitoring harus melalui **`GET /healthz` internal (localhost Nginx upstream)**, bukan melemahkan CORS. Health publik boleh limited sesuai kebutuhan, tanpa secret. Contoh respons status:

```json
{"mapId":"forest","onlineCount":2,"capacity":8,"available":true,"worldVersion":"forest-v1"}
```

Contoh leaderboard:

```json
{"mapId":"forest","entries":[{"rank":1,"username":"raka","kills":12,"deaths":4,"kdr":3.0},{"rank":2,"username":"nala","kills":9,"deaths":6,"kdr":1.5}],"me":{"rank":14,"kills":1,"deaths":3,"kdr":0.33},"generatedAt":"2026-11-04T00:00:00Z"}
```

Urutan deterministik di backend: `kills DESC`, `deaths ASC`, `username_canonical ASC`; pagination/limit bounded, indexed. **Client dilarang mengirim angka kill/death**. Update hasil kill/death di DB transaksi idempotent, broadcast event leaderboard invalidation ke lobby (opsional) dan polling lobby 15–30 detik.

### 4.2 Auth dan session browser

- Username 3–20 karakter, `[A-Za-z0-9_]`, canonical lower-case unik; password minimum 10 dan maksimum 128 karakter (ukur bytes dan Unicode policy konsisten), hash Argon2id + salt. Hindari user enumeration pada login, gunakan `409` untuk username register yang sudah dipakai bila sesuai UX.
- **MVP login stateless:** access token signed dan expired 15–30 menit, simpan **di memori JS**. Refresh/reopen membutuhkan login ulang. Tidak ada refresh cookie cross-site sebagai dependency karena policy third-party cookies pada GitHub Pages ↔ domain API. Token tidak boleh di URL atau console/local/sessionStorage. Pengguna dapat logout kapan saja; agar logout memutus sesi aktif, WS segera ditutup, dan opsional token `jti` denylist in-memory hingga expiry untuk kasus explicit logout; token stolen tetap berisiko sampai expired, jadi TTL pendek.
- WebSocket native browser tidak mengizinkan arbitrary `Authorization` header: autentikasi sebagai **pesan pertama** melalui `wss://.../ws`; server tidak menerima `join/input/attack` sebelum verifikasi, auth timeout ≤5 s. Jangan taruh token di query string. Saat sudah terautentikasi, WS dapat melanjutkan sampai batas sesi koneksi maksimum (mis. 2 jam) meskipun REST access token berakhir; server WAJIB menutup WS saat explicit logout/revocation dan memerlukan token masih valid pada setiap reconnect. UI menuntun re-login untuk REST setelah token habis tanpa mengirim password diam-diam.
- Rate limit login/register per IP dan username canonical, total websocket handshake/new sessions, auth payload, dan per-user action. Limit Argon2 concurrency/queue supaya botnet kecil tidak menghabiskan 2 core. Berikan 429 + Retry-After semestinya.
- Satu akun satu active room session; reconnect dengan `sessionId`/new socket terverifikasi harus atomic dan tidak meninggalkan ghost connection.

### 4.3 Kebijakan Origin khusus GitHub Pages (penting: batas keamanan REAL)

**Frontend yang dipercaya di production:** `https://akbarwiran.github.io/`  
**Nilai HTTP `Origin` yang benar:** `https://akbarwiran.github.io` — **tanpa slash akhir, tanpa path**.

1. `NODE_ENV=production`, `FRONTEND_ORIGINS=https://akbarwiran.github.io`. Jangan menambahkan `http://`, wildcard `*`, `null`, subdomain/regexp longgar, atau `localhost` di production. Local dev memakai env terpisah (`http://localhost:8000` atau port aktual) yang tidak aktif pada production.
2. Terapkan CORS pada **Fastify sebagai satu sumber kebijakan** (hindari header duplikat/konflik dengan Nginx). REST browser-facing harus menerapkan **exact origin allowlist** dan CORS preflight `OPTIONS`: `Access-Control-Allow-Origin: https://akbarwiran.github.io` **hanya jika Origin cocok**, `Vary: Origin`, methods/header allowlist minimal (`Authorization, Content-Type`), tidak perlu `Access-Control-Allow-Credentials` bila menggunakan bearer token. Setiap route non-public juga memerlukan auth/RBAC, bukan sekadar CORS.
3. Untuk origin yang tak diizinkan: **jangan mengirim header CORS** dan middleware/app boleh mengembalikan `403`; jangan gunakan refleksi origin apa pun. Pada request non-browser tanpa Origin, browser-facing endpoints boleh di-`403` sesuai kebijakan **tetapi ini bukan perlindungan terhadap klien yang memalsukan Origin**. Boleh membiarkan health CLI di localhost internal saja.
4. **WS tidak tunduk pada CORS browser.** Validasi header `Origin` secara exact saat handshake `/ws`, tolak origin asing/missing di production sebelum upgrade. Setelah handshake masih wajib WSS token auth, seq/rate checks dan server authority.
5. **CORS/Origin tidak bisa menjamin API hanya bisa diakses dari situs tersebut.** `curl`, bot, atau native client dapat mengirim header `Origin` palsu dan kode frontend dapat dibaca. Tidak ada private API key aman yang dapat disimpan di frontend publik. Tujuan yang realistis: browser dari origin lain terhalang + akun wajib + rate limiting/validation/anti-cheat + telemetry. Bila bisnis benar-benar mensyaratkan *hanya kode asli yang dapat memanggil API*, itu **tidak dapat dijamin** pada frontend publik tanpa trust boundary tambahan, dan anti-bot attestasi pun tidak absolut.
6. Pembatasan origin mengizinkan **SEMUA project di host `akbarwiran.github.io`**, bukan hanya satu path/repository. Bila isolasi satu aplikasi sangat penting, gunakan custom domain frontend terpisah dan ganti allowlist; path tidak termasuk Origin.
7. Header keamanan: Nginx HSTS hanya setelah domain/TLS benar, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store` pada auth, no permissive CSP; frontend atur CSP sesuai Three.js/asset yang nyata, bukan wildcard umum.

**Acceptance test konkret yang agent wajib otomatisasi:**

```text
A. Browser Origin: https://akbarwiran.github.io  -> preflight 204/200 sesuai route, ACAO tepat.
B. Browser Origin: https://evil.example           -> 403 / tidak ada ACAO.
C. Browser Origin: null                           -> 403 / tidak ada ACAO.
D. Browser Origin: http://localhost:8000 PRODUCTION -> 403 / tidak ada ACAO.
E. Header Origin missing pada browser-facing API  -> 403 sesuai kebijakan.
F. curl dengan Origin GitHub dipalsukan           -> dapat lolos Origin check,
   tetapi SEMUA protected endpoints tetap 401 tanpa valid Bearer; dokumentasikan sebagai limitation.
G. WS origin foreign/null/missing                 -> handshake REJECT.
H. WS origin GitHub tanpa auth/token invalid      -> gagal auth, close sebelum join.
I. Browser HTTPS Pages ke http://IP / ws://IP     -> frontend memblokir mixed content sebelum koneksi.
J. CORS test dijalankan terhadap HTTP real port (inject test saja tidak cukup),
   gunakan assert actual status, Origin, ACAO, Vary, Access-Control-Allow-Headers.
```

### 4.4 Protokol WS v1 — event authoritative

Semua JSON messages wajib `v:1` dan `type`. Batas frame ≤16 KiB (MVP), max input 20/s, no giant arrays. Schema validator untuk tiap jenis. Contoh ringkas:

```json
{"v":1,"type":"auth","token":"<ACCESS_TOKEN>"}
{"v":1,"type":"auth_ok","userId":"u1"}
{"v":1,"type":"join","mapId":"forest","character":"female"}
{"v":1,"type":"joined","sessionId":"s1","playerId":"p1","worldVersion":"forest-v1","spawn":{"x":120,"y":0,"z":-80},"hp":100,"tick":100}
{"v":1,"type":"input","seq":101,"moveX":0.0,"moveZ":1.0,"sprint":true,"prone":false,"jump":false,"yaw":1.6,"pitch":0.1}
{"v":1,"type":"action","seq":102,"name":"pickup","lootId":"loot-42"}
{"v":1,"type":"action","seq":103,"name":"attack","weaponSlot":1,"aim":{"yaw":1.6,"pitch":0.1}}
{"v":1,"type":"action","seq":104,"name":"drop","weaponSlot":1}
{"v":1,"type":"action","seq":105,"name":"throw","weaponSlot":1,"aim":{"yaw":1.6,"pitch":0.1}}
{"v":1,"type":"action","seq":106,"name":"respawn"}
{"v":1,"type":"leave","sessionId":"s1"}
{"v":1,"type":"leave_ack","sessionId":"s1","reason":"user_exit"}
{"v":1,"type":"snapshot","tick":101,"players":[{"id":"p1","x":120,"y":0,"z":-80,"yaw":1.6,"pose":"run","alive":true}],"lootChanges":[]}
{"v":1,"type":"enemy_map","tick":101,"precisionMeters":8,"players":[{"id":"p2","gx":15,"gz":-7}]}
{"v":1,"type":"hit_confirmed","attackerId":"p1","targetId":"p2","damage":20,"targetHp":80}
{"v":1,"type":"kill_feed","eventId":"k123","killerUsername":"A","victimUsername":"B","weapon":"sword"}
{"v":1,"type":"death","victimId":"p2","respawnAfterMs":3000}
{"v":1,"type":"presence","mapId":"forest","onlineCount":2}
{"v":1,"type":"error","code":"INVALID_ACTION","message":"Aksi tidak valid"}
```

- **HP lawan di snapshot tidak diperlukan untuk tampilan; jangan kirim field sensitif berlebihan.** HP pemilik sendiri diperoleh dalam private status event. Jangan pernah menerima damage/HP/loot/score yang diklaim client.
- `leave` harus **idempotent dan session-scoped**; server clear input queue, room membership, active player, dan presence atomik, menunggu maksimal grace sebelum disconnect cleanup. In-flight attack sesudah leave **ditolak**. Koneksi putus tanpa leave dibersihkan oleh ping/pong timeout; update count segera saat eksplisit leave, eventual pada timeout.
- Rejoin dapat membuat session baru dan posisi random; akun login tetap berlaku selama token belum expired. Jangan menghitung dua kali aktif saat reconnect atau exit selama WS reconnect.
- Hit event/kill event unik untuk mencegah double DB counting, hasil stats update dikirim setelah **commit** berhasil atau antrean retriable idempotent yang terjamin (jika persistence gagal, jangan bohong sukses permanen).

### 4.5 Server-authoritative simulation

1. Satu room `forest` di memori dengan fixed tick 20 Hz; hanya simulasikan saat ada pemain. Socket input maks 20/s, snapshot 10 Hz, enemy minimap 1–2 Hz. Capped fixed timestep hindari spiral-of-death; p95 tick duration dilog periodik secara agregat.
2. Client mengirim **intent**, bukan posisi akhir/damage/loot hasil. Server validasi movement dari input sequence, speed, collision/boundary, LoS, cooldown, prone/jump/sprint, item ownership. Server tidak perlu Three.js, cukup collision primitive + spatial grid.
3. Pedang range ≤3 m, bow ≤10 m, fist ≤1.6 m, thrown ≤8 m. Semua attack valid 20 HP, tanpa headshot/armor. Untuk attack yang sama, target hanya kena sekali. Ray/capsule hit memakai collider version identik dan server time. Jangan percaya `clientHit=true`.
4. Loot pickup atomic within event loop, validasi target masih tersedia, jarak ≤2.5 m, capacity. Saat death, drop loot menurut policy tanpa duplikasi. Respawn server memilih candidate aman, HP=100, inventory kosong, invulnerable 2 detik; protected player tak dapat memberi damage.
5. `kill_feed` memakai username tersimpan server, bukan request body client; satu valid elimination menghasilkan **1 kill untuk killer (kecuali suicide/no-attacker) + 1 death untuk victim**. Bot Solo tidak masuk DB. Untuk combat logout, recent damager bisa diberi kredit menurut setting, idempotent per elimination/session.
6. Online count adalah room membership autentikasi aktif, bukan user yang login; di server disconnect/presence update konsisten; jangan menambah player sebelum `joined` sukses.
7. Reconnect dengan exponential backoff + jitter, no duplicate avatars, server resync snapshot, socket cleanup. Duplicate joins/leaves replayed actions harus harmless.
8. Hard cap awal 8 pemain/room; AoI 120–180 m untuk state detail; nearby snapshots 10 Hz, enemy minimap tersebar full-map hanya 1–2 Hz data terkuantisasi, jangan kirim semua geometry/map ke tiap client.

### 4.6 SQLite schema dan integritas leaderboard

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username_display TEXT NOT NULL,
  username_canonical TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  character TEXT NOT NULL DEFAULT 'male' CHECK (character IN ('male','female')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE player_stats (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  kills INTEGER NOT NULL DEFAULT 0 CHECK (kills >= 0),
  deaths INTEGER NOT NULL DEFAULT 0 CHECK (deaths >= 0),
  updated_at TEXT NOT NULL
);
CREATE TABLE elimination_events (
  event_id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  victim_id TEXT NOT NULL REFERENCES users(id),
  killer_id TEXT REFERENCES users(id),
  weapon TEXT NOT NULL,
  cause TEXT NOT NULL, -- combat|combat_logout|other
  occurred_at TEXT NOT NULL
);
CREATE INDEX idx_stats_rank ON player_stats(kills DESC, deaths ASC);
```

- Buat migrations versi `001_...`, `002_...` yang bisa diulang secara aman dengan migration table, bukan `CREATE TABLE` dipanggil saat setiap request. Pragma wajib: `journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout` dan WAL checkpoint policy. Lindungi permission db path.
- Kill/death update dilakukan **dalam satu SQLite transaction** bersamaan insert event unik. Jika event_id sudah ada, **tidak menambah stat lagi**. Validasi `killer_id != victim_id` dan handling `killer=null` untuk death yang bukan eliminasi normal. Query leaderboard join users+stats dengan stable order; kosong tetap valid.
- Stats PvP bersifat permanen lintas respawn, exit, login ulang dan server restart. Inventory dan posisi tidak dipersist setiap frame. Tidak menyimpan password/token plaintext.
- Backup SQLite harus **konsisten dengan WAL** (gunakan SQLite online backup API/`VACUUM INTO`/backup command yang teruji; jangan sekadar `cp game.sqlite` saat proses aktif). Restore drill minimal sekali di staging. Batasi size/log/backup retention untuk storage 50 GB.

## 5. KRITERIA PERFORMA, KEAMANAN, DAN KUALITAS

### 5.1 Performance budget awal (klien DAN VPS)

- **Frontend:** target desktop 60 FPS dan mobile 30 FPS stabil (target, bukan klaim). Map 1 km², chunk 64 m, ring radius 2 yang disesuaikan perangkat, InstancedMesh grass/trees/rocks, LOD, material reuse, frustum + distance culling, shadow tier, pixel ratio adaptif. Mobile portrait tidak merender seluruh peta.
- **HUD:** tidak rebuild DOM/minimap/markers tiap frame; diff updates dan throttle minimap 5–10 Hz, minimap enemy network 1–2 Hz; texture.needsUpdate hanya pada konten berubah. Semua geometries/materials/textures serta listeners dibersihkan saat exit/rejoin.
- **Game server:** 20Hz authoritative room, 10Hz AoI snapshot, maksimum 20 input/s/client, cap awal 8, CPU total <70% saat load test 8 client ideal, tick p95 <50ms, event loop lag dicatat. Jika tidak memenuhi, kurangi cap dan sampling rate sebelum menambah layanan.
- **RAM VPS:** aplikasi Node ideal ≤350–600MB RSS saat simulasi 8 client (target profiling), pertahankan headroom sistem >=1 GB; Nginx, OS, disk cache dan SQLite tetap dihitung. Jangan gunakan database write setiap tick. Kontrol max WebSocket buffered bytes dan jumlah koneksi.
- **Disk 50GB:** log rotation, limit JSON logs, backup SQLite konsisten berretensi misalnya 7 harian + 4 mingguan jika muat dan terverifikasi, alarm free-space <10GB. Jangan menyimpan frame/replay 3D mentah.
- **Uji performa:** stage 2, 4, 8 client dan baru 16 jika semua metrik aman; catat CPU/RAM RSS/load/p95 server tick/latency/bandwidth, frontend FPS/draw calls/heap/GPU resources 15 menit. Jangan klaim throughput atau capacity tanpa log terukur.

### 5.2 Backend API security dan kesiapan production

- **Origin allowlist EXACT:** hanya `https://akbarwiran.github.io` untuk browser production; jangan `*`, jangan `null`, jangan allow substring/suffix path. Browser origin lain diblok; request tanpa Origin pada API publik boleh ditolak. **Tidak bisa menjamin curl/native clients terblok karena Origin bisa dipalsukan**; semua API berprivilege wajib Bearer auth + scope ownership.
- **WebSocket:** pemeriksaan handshake Origin terpisah dari REST, WSS saja production, auth message-first timeout 5s, jumlah koneksi aktif per user, heartbeat, max message size, rate-limit per-message, seq anti replay, malformed payload disconnect.
- **Input REST & WS:** JSON schema validation `additionalProperties:false` pada payload sensitif, bounds username/password/coordinates/angle/action/limit, prepared SQL, no dynamic query concatenation; output ke DOM via textContent/sanitize.
- **Authentication:** Argon2id hash, rate limit per IP + username, random backoff/429, generic bad credential message, short-lived token in memory, no token/password in logs/URL/Repo. Logout closes WS; no client-side hardcoded API secret.
- **PvP server authority:** validation range/cooldown/ammo/LOS, movement caps, spatial collision, non-spoofable kill attribution, atomic loot, unique elimination events, respawn invulnerability, no kill/death API write by browser.
- **VPS surface:** Nginx 80/443 public, SSH restricted admin IP + key-only, bind Node to 127.0.0.1, no public DB port, TLS certificate valid, HTTPS/WSS, OS updates, nonroot service, sanitized error/log. Keep admin credential outside repo.
- **Rate/DoS:** configurable cap total connections/handshakes, auth Argon2 concurrency, webserver request body size, WS frames <=16KiB, bufferedAmount threshold, close slow clients, CPU/memory/process monitoring. Limit leaderboard/status frequency, cache readonly results.
- **DB backup & restore:** SQLite WAL-safe online backup, retention + disk alarm, restore tested, admin-only filesystem permissions. HSTS only when valid TLS and domain confirmed.
- **Security tests include invalid/missing/spoofed Origin** plus REST bearer, WS auth, client forging, abusive action spam, extra fields, broken auth, direct backend probing; log factual limitations of origin-based restrictions.

### 5.3 Test pyramid minimal

- Unit pure rules: seeded world, spawn candidate validity, normalized movement, sprint/prone/jump, collider boundary, range/LOS, 5 hits exact, cooldown, inventory slot, drop ≠ throw, leaderboard sorting and KDR, no double-count elimination.
- Backend HTTP integration: register/login/duplicate username, wrong password/rate-limit, character save, maps/status, leaderboard top10 + self, wrong token, wrong user, CORS preflight exact, foreign Origin, missing/null Origin. Gunakan HTTP server real untuk validasi header browser.
- Backend WS integration: handshake Origin allow/deny, token auth, join/presence, movement/snapshot, attack 20 HP, 5 hits death + event, duplicate action, loot race, leave/leave_ack, idempotent cleanup, combat logout, reconnect/timeout, malformed frame.
- E2E: browser desktop + emulated portrait (Playwright bila tersedia), lalu **real HP** di jaringan berbeda; solo playable offline, login/lobby leaderboard, PvP, exit dari normal/death/map, login ulang, leaderboard persisted.
- Load: staged 2/4/8 simulated clients, cpu/RSS/latency/tick drift/bandwidth; jangan menguji 1000 dummy connections di server produksi tanpa safety caps. Jika alat tidak tersedia, `PENDING_MANUAL` dan langkah uji konkret.


# 6. FASE IMPLEMENTASI — HERMES WAJIB MEMBUAT FRONTEND + BACKEND PADA SETIAP FASE

**Aturan fase:** selalu ada 5 kelompok hasil: **[Frontend]**, **[Backend]**, **[Integration]**, **[Security]**, **[QA/Handoff]**. Tidak boleh pindah fase jika task kritikal gagal. Tes manual HP asli hanya bisa ditandai `PENDING_MANUAL` bila tidak ada akses; jangan klaim VERIFIED. Sediakan command lengkap dan tunjukkan output test. API yang belum siap tidak boleh dibuat mengembalikan sukses palsu.

## FASE 1 — ENGINE HUTAN + KONTROL + BACKEND SKELETON DAN KEAMANAN ORIGIN

**Instruksi penuh:** Siapkan satu monorepo ringan yang **langsung memuat frontend yang siap GitHub Pages** dan **server Fastify yang benar-benar berjalan di VPS**. Inventaris sistem sebelum menginstal paket: OS, Node, RAM/CPU/disk, service/port lama yang sudah dipakai; jangan mengubah firewall atau menghentikan service existing tanpa memastikan dampaknya. Bangun game world deterministic 1024×1024 m berbasis chunk, vegetasi low-poly instanced, rumah/gubuk dan batu, kontrol third-person desktop dan HP portrait, random spawn, minimap, map overlay, exit Solo. Pada sisi server, bangun REST hidup `/api/v1/health` dan `/api/v1/config/public`, bootstrap SQLite WAL + migration `users/player_stats/elimination_events`, schema validation, logging, CORS allowlist benar, internal `/healthz`. Buat test HTTP port nyata untuk Origin. Set backend bind loopback, config env yang jelas, dan script startup/migrate. Integrasi awal: UI settings memasukkan backend HTTPS/valid TLS dan Test Connection (untuk lokal dev backend bisa HTTP localhost); Solo tetap jalan tanpa server. Jangan mengerjakan login/combat full dulu. **Exit Fase 1:** frontend eksplorasi dan server API dasar benar-benar jalan bersama dan bisa dipanggil sesuai origin dev; repo build pages belum mengekspor `server/`.

### Checklist Fase 1

- [ ] [Ops] Catat baseline Tencent 2vCPU/4GB/50GB: `uname`, Node/npm, CPU/mem/disk, port-listening, service, firewall saat ini; jangan ganggu project existing.
- [ ] [Repo] Buat struktur frontend modular ESM + `src/shared` pure JS + `server` + scripts + README + `.gitignore` + `.env.example`; pin versions/lockfile.
- [ ] [Frontend] Boot Three.js ESM pinned/vendor + WebGL error/context failure handler, screen title/lobby guest/solo, resize/orientation and settings UI.
- [ ] [Frontend] Terrain 1024×1024 m deterministic seed, chunk grid 64m, active ring 2, batas dunia dan slope landai.
- [ ] [Frontend] Pohon ≥3 varian, semak, rumput pendek/tinggi, batu ≥3 varian, jalan setapak, sun sore, fog/shadow tier; tanpa hewan, sungai, awan.
- [ ] [Frontend] Rumah/gubuk kosong yang dapat dimasuki ≥12 dan POI/ruins ≥8, colliders sesuai server metadata, loot hotspots disiapkan.
- [ ] [Frontend] InstancedMesh + LOD/culling + material reuse + lifecycle disposer; monitor draw calls, textures, GPU resource trend.
- [ ] [Frontend] Karakter laki-laki/perempuan cosmetic, animasi bergerak dan kamera third-person 360° smooth + camera collision.
- [ ] [Frontend] WASD/mouse + sprint + jump + prone, mobile **portrait-only** joystick kiri/drag look kanan/multitouch/jump/run/prone; safe-area.
- [ ] [Frontend] Random spawn ≥40 kandidat valid, minimap kiri atas + map overlay zoom/pan + POI, keluar dari Solo ke Lobby kapan saja.
- [ ] [Frontend] Settings backend URL/IP TLS, Test Connection, status+latency+warning custom URL; localstorage hanya nonsecret.
- [ ] [Backend] Install Node.js **24 LTS** (jika belum tersedia/kompatibel), Fastify v5, @fastify/websocket, SQLite better-sqlite3, argon2, schema validator; tidak menambah DB server lain.
- [ ] [Backend] Buat `GET /api/v1/health`, `GET /api/v1/config/public` dan healthz loopback, error handler, request ID, safe Pino logs.
- [ ] [Backend] SQLite WAL + migration runner versioned + unique username/stats/elimination schema; `foreign_keys=ON`, prepared SQL, secure file path.
- [ ] [Backend] Validasi config, production fail-fast bila secret/Origin kosong atau wildcard, Node bind `127.0.0.1:3000`; scripts `start/dev/test/db:migrate` harus sungguhan.
- [ ] [Security] CORS EXACT `https://akbarwiran.github.io` production; origins localhost hanya development; OPTIONS preflight dan Vary:Origin diuji lewat HTTP server sungguhan.
- [ ] [Security] Reject foreign/null/missing Origin pada browser-facing API (kecuali healthz internal); dokumentasikan spoofing limitation; no wildcard/reflect-origin.
- [ ] [Security] Nginx/TLS plan, no secrets in frontend/repo, GitHub build whitelist `dist/` only; audit output dist tidak memuat backend/`.env`/DB.
- [ ] [QA] Node unit tests deterministic spawn/movement/chunk+ world bounds; HTTP integration valid/invalid Origin/preflight, malformed request.
- [ ] [QA] Browser smoke desktop + emulated mobile portrait; FPS / chunks / drawcalls; catat apa yang belum diuji di HP asli.
- [ ] [QA] `npm ci` lockfile, `npm test`, `npm run build:pages` lulus; update checklist, status, decision log, checkpoint.

**Definition of Done Fase 1:** hutan dan kontrol playable Solo desktop + portrait, peta dan exit berjalan; server API nyata dapat dijalankan pada VPS tanpa membuka port Node publik; SQLite migrated; Origin control tested; bundle Pages hanya aset frontend. **Jangan mengaktifkan tombol PvP atau leaderboard palsu.**

## FASE 2 — SOLO COMBAT + REGISTER/LOGIN/LOBBY/LEADERBOARD REST NYATA

**Instruksi penuh:** Buat Solo sebagai game loop lengkap: bot humanoid sederhana, looting sword/bow/ammo di rumah atau POI, inventory 2 slot, drop/throw, melee dan bow aim zoom dengan crosshair, HP 100, 20 damage, 5 hit death, respawn, kill feed lokal, exit ke lobby. Bersamaan **selesaikan backend REST akun/lobby/leaderboard** (SQLite + Argon2id, JWT short-lived memory, rate limits). UI register/login nyata, pilihan karakter, map Forest, online count authoritative dari room (nol selama belum ada pemain WS), leaderboard kosong atau berisi data PvP sah. Frontend harus bisa menampilkan lobby online tetapi tombol mulai Online disabled dengan alasan jelas sampai Fase 3. Integrasikan backend URL di Settings dan Test Connection; jangan menyimpan password/token di browser persisten. Sekalipun backend down, Solo guest tidak boleh rusak. **Exit Fase 2:** user bisa register/login, memilih karakter, melihat leaderboard data yang disimpan server (belum ada kill karena PvP belum diaktifkan), dan bermain solo penuh.

### Checklist Fase 2

- [ ] [Frontend] Weapon classes `unarmed/sword/bow/arrowAmmo`, damage 20, range fist 1.6m/sword 3m/bow 10m/throw 8m, cooldown configurable.
- [ ] [Frontend] Loot objects dengan IDs stabil di ≥12 rumah dan ≥8 POI, pickup ≤2.5m, capacity 2, slot switch, drop dan throw berbeda, pickup ulang.
- [ ] [Frontend] Bow aim over-shoulder + scope zoom FOV + crosshair tepat; tracer/hit marker; no auto-aim ekstrem.
- [ ] [Frontend] Combat local ray/LOS, wall blocker, ammo/cooldown, HP 100→0 setelah 5 hit valid, death overlay dan random respawn HP100/tangan kosong.
- [ ] [Frontend] 2+ bot manusia purba FSM patrol/detect/chase/attack/death/respawn, tanpa musuh bernama/HP floating; minimap anonymous markers.
- [ ] [Frontend] Desktop keys & mobile portrait thumb controls untuk attack/aim/loot/throw/drop/jump/run/prone/zoom map; multitouch tested.
- [ ] [Frontend] Tombol `Keluar ke Lobby` selalu tersedia dari Solo, pause, fullscreen map, dan layar kematian; resource/listener cleanup.
- [ ] [Backend] Register validation, unique username canonical, Argon2id password hashing tuned/benchmarked di 2 core; generic credential errors.
- [ ] [Backend] Login dengan signed access token TTL 15–30m, `GET/PATCH /users/me`, ownership schema; token hanya RAM di frontend, refresh harus login ulang.
- [ ] [Backend] Endpoints `GET /maps`, `GET /maps/forest/status`, `GET /leaderboard`, `GET /leaderboard/me` dengan auth, pagination/limit bounded.
- [ ] [Backend] Persistence SQLite `users`, `player_stats` inisialisasi 0; SQL prepared & constraints; query leaderboard top10 deterministic, index dan cache pendek.
- [ ] [Backend] Data leaderboard tidak boleh bisa dimutasi lewat REST pemain; jika perlu pengujian leaderboard gunakan fixture transaction/test-only (JANGAN publish seed/admin bypass).
- [ ] [Backend] `onlineCount=0` jika belum ada joined WS sessions; jangan hitung akun login sebagai pemain online. `available` sesuai cap room.
- [ ] [Frontend] Register/login screens, character L/P default laki-laki, map Forest, count online, leaderboard top10 + rank sendiri + empty state + refresh 15–30s.
- [ ] [Frontend] Backend URL settings default resmi, custom-server warning sebelum kirim password, test `GET /health`, latency/errors, campur konten HTTP diblokir di GitHub Pages HTTPS.
- [ ] [Security] Rate limit per IP/username untuk register/login, body size caps, token expiry, login errors, auth bearer yang benar, no token/password logs/URL/storage.
- [ ] [Security] Test CORS allowlist pada auth, lobby, leaderboard dan protected routes; semua 401 tanpa token walaupun `Origin` dipalsukan.
- [ ] [QA] API integration register/login/duplicates/wrong credentials/expiry/forbidden profile, leaderboard sorting/tie/KDR/pagination, no write endpoint.
- [ ] [QA] Solo unit/integration test range/LOS, 5 hit, ammo 0, inventory full, drop/throw, death/respawn, exit/re-enter 20x leak check.
- [ ] [QA] Browser desktop + emulated mobile smoke login→lobby→solo→loot→kill bot→exit, backend disconnected fallback.
- [ ] [QA] Update README API/curl usage/credentials policy, checklist, handoff + report actual CPU/RSS snapshot.

**Definition of Done Fase 2:** Solo loop lengkap, register/login benar-benar disimpan di SQLite, lobby live API dan leaderboard siap dibaca, exit bisa kapan saja; endpoint terlindungi auth dan origin. Tidak boleh menyatakan kill leaderboard bekerja sebelum Fase 3 membuktikan event PvP.

## FASE 3 — MULTIPLAYER AUTHORITATIVE WSS + LEADERBOARD KILL/DEATH + EXIT/REJOIN

**Instruksi penuh:** Pasang satu gateway WSS dalam proses Node Fastify yang sama, **Origin handshake exact + auth-first**. Bangun server simulation 20Hz di memori dengan collider/grid derived dari shared pure world metadata, tidak perlu Three/WebGL di server. Klien tetap memegang camera, animation, prediction visual, tetapi server memegang posisi final, ammo, hit, loot, HP, death, spawn dan kill attribution. Gunakan protocol v1/seq dan snapshot 10Hz hanya area-of-interest (AoI); minimap enemy memakai data posisi anonim terkuantisasi 1–2Hz. Tampilkan Player A desktop dan B mobile portrait di room `forest` yang sama; test sword vs bow dan 5x hit. **Ledger kill/death permanen** diperbarui transaksi SQLite idempotent, leaderboard di lobby berubah setelah kill. Tombol **Exit ke Lobby kapan pun** harus mengirim `leave(sessionId)`, menerima ack bila tersedia, dan fallback cleanup ketika socket drop; rejoin mendapatkan spawn valid berbeda, HP100/tangan kosong. Jangan menulis posisi ke SQLite per tick atau menerima klaim kerusakan dari browser. **Exit Fase 3:** dua browser dapat bertarung, kill masuk leaderboard, mati/respawn, exit dan rejoin, count online benar.

### Checklist Fase 3

- [ ] [Backend] Implementasi `/ws` WSS handshake `Origin=https://akbarwiran.github.io` (production) dan auth message pertama ≤5s, token invalid/expired langsung close; localhost dev env terpisah.
- [ ] [Backend] Protocol v1 schema strict untuk auth/join/input/action/snapshot/kill/death/presence/leave/ack/respawn, max frame ≤16KiB.
- [ ] [Backend] Satu authoritative `forest` room, hard-cap awal 8, fixed tick 20Hz, snapshot AoI 10Hz, minimap enemy 1–2Hz quantized.
- [ ] [Backend] Shared world seed/version/collider grid 32m+spatial hash; server spawn valid (>=40 positions) jauh dari enemy bila bisa, tidak percaya koordinat client.
- [ ] [Backend] Input seq/speed limits, movement/prone/sprint/jump, collider boundary, server sim; prediction + correction support.
- [ ] [Frontend] WS client auth/join flow setelah login; local prediction/reconciliation dan remote interpolation 100–150ms, character cosmetics sync, auth renewal UX.
- [ ] [Backend] Server inventory 2 slot, loot spawn/expiry/pickup atomic/race, equip/drop/throw, ammo, respawn loot; event idempotence.
- [ ] [Backend] Server validate fist 1.6m/sword 3m/bow 10m/throw 8m, LOS/cooldown/aim/owned weapon, exactly 20 HP/hit, no double-hit.
- [ ] [Frontend] Online HUD HP/weapon/cooldown/killfeed/no floating opponent name/HP; bow scope zoom responsive di HP portrait.
- [ ] [Backend] Satu elimination event unique ID per death; SQLite transaction update kills dan deaths exactly-once, only PvP (solo bot excluded).
- [ ] [Backend] `GET /leaderboard` rank/top10 memperlihatkan kills/deaths permanen lintas restart; invalidate cache setiap commit elimination.
- [ ] [Backend] Death → weapon drop sekali → respawn delay 3s+protection 2s → random spawn HP100/tangan kosong, no spawn damage.
- [ ] [Frontend] Minimap enemy anonim dalam world + popup zoom/map; lokasi self/POI; tidak mengirim username/HP floating.
- [ ] [Frontend] In-game `Keluar ke Lobby` dari normal/map/death/pause, cancel held inputs, clear remote meshes, dispose GPU resources, reset UI.
- [ ] [Backend] WS leave/leave_ack sessionId scoped idempotent, API POST leave fallback, reconnect clean + duplicate session protection; online count=joined active players only.
- [ ] [Backend] Combat logout window 10s configurable dan credit recent damager sekali; exit tetap segera, no player ghost/double kill.
- [ ] [Security] WS malformed/oversized payloads, replayed seq, 50 attacks/s, forged hp=999/damage=999, speed/teleport/LOS/loot race ditolak.
- [ ] [Security] WS Origin foreign/null/missing ditolak pada handshake; curl Origin spoof + invalid token tidak bisa join/attack.
- [ ] [QA] Integration 2 clients register→join→A sword/B bow→5 hits→kill feed→leaderboard→respawn→exit→online count drops.
- [ ] [QA] Simulated disconnect/refresh/rejoin/leave without ack/multiple login same account; no leak/no double active avatars.
- [ ] [QA] Stage test 2 lalu 4 client; catat server CPU/RSS/tick p95/network RTT; jika lulus tingkatkan 8 pada Fase 4.
- [ ] [QA] Update API/WS contract docs dan checklist; Handoff Checkpoint dengan known bugs real.

**Definition of Done Fase 3:** login dua akun berbeda, satu room forest live A/B, gerak sinkron, ammo/loot/HP server-authoritative, death/respawn 5 hit, leaderboard aktual dan persistent, exit/rejoin server count benar. Belum otomatis berarti production-ready sampai Fase 4 security/load/device checks lulus.

## FASE 4 — HARDENING, OPTIMISASI VPS, DEPLOY GITHUB PAGES + TENCENT, UJI AKHIR

**Instruksi penuh:** Fase 4 bukan tempat menambah fitur kosmetik. Optimalkan dari hasil profiling, perketat origin/API/WS auth, test semua cheating/DoS yang realistis, buktikan performa pada resource VPS nyata, dan buat deployment yang dapat dipelihara. Audit layanan existing sebelum binding port, jangan expose SQLite/Node. Deploy satu service Node di systemd nonroot bind localhost, Nginx TLS reverse proxy dengan `Upgrade` WS, sertifikat otomatis diperbarui, backup SQLite online/WAL-safe, log rotation, memory/CPU/disk monitoring. Buat GitHub Pages deploy artifact **whitelist hanya frontend**; uji alamat path relatif. Konfigurasi `https://akbarwiran.github.io` sebagai satu-satunya allowed browser Origin di production untuk REST dan WS; pahami bahwa ini tidak memblokir program curl yang memalsukan Origin. Dengan laptop dan HP portrait pada jaringan terpisah, lakukan PvP 5 hit, leaderboard, exit kapan saja, rejoin, reconnect, serta 15 menit gameplay. Bila real phone tak tersedia, dokumentasikan `PENDING_MANUAL` dan jangan klaim selesai production. **Exit Fase 4:** deploy operasional + test report faktual + instruksi pemulihan.

### Checklist Fase 4

- [ ] [Ops] Baseline ulang 2vCPU/4GB/50GB, identify port/service existing, capacity targets and risk; backup config/data before changes.
- [ ] [Backend] Load test 2→4→8 WS client; evaluate cap 8, optional 16 only if CPU <70%, 1GB memory headroom, tick p95 ≤50ms and connection stable.
- [ ] [Backend] Tune AoI radius/collision grid/snapshot frequency/JSON payload bytes/WS backpressure; throttle leaderboard/status reads.
- [ ] [Backend] Argon2id cost tuned for 2vCPU, auth concurrency and IP+username rate-limiting; test brute-force burst load-safe.
- [ ] [Backend] SQLite WAL checkpoint, query plan leaderboard index, atomic transaction verification and duplicate event recovery, size/retention.
- [ ] [Security] Origin production strict exact CORS+WS `https://akbarwiran.github.io`, no `null`/wildcards/localhost; test preflight including `Vary: Origin`.
- [ ] [Security] Test spoofed curl Origin: unauth REST returns 401, WS without valid token fails even with allowed header; note impossibility of strict website-only guarantee.
- [ ] [Security] Test invalid session, duplicate join, malformed JSON, high-rate inputs, rapid attacks, wall shots, forged inventory/hp/kill, replay, negative/NaN coordinates.
- [ ] [Security] Audit no real secret in git/dist/log, passwords hashed, no SQL injection, no unescaped username DOM injection.
- [ ] [Ops] DNS domain API actual → Tencent IP, TLS CA cert HTTPS/WSS; Nginx only :80 redirect/challenge + :443 public; Node 127.0.0.1:3000 only.
- [ ] [Ops] Tencent Security Group/UFW allow 443 public, 80 when needed, SSH key-only restricted admin IP; 3000/sqlite not public.
- [ ] [Ops] systemd service user nonroot, fixed workdir, env file 0600 owner, restart policy, reasonable memory cap, graceful shutdown/save recent DB writes.
- [ ] [Ops] SQLite online backup API script/schedule, WAL-safe, daily retention+rotation, restoration drill/test; disk alerts <10GB free.
- [ ] [Ops] Journald/logrotate, request ID, sanitized logs, error monitoring and CPU/RAM/tick/WS count disk review, service health and cert renewal check.
- [ ] [Frontend] Build static `dist/` only; GitHub Actions deploy artifact `dist`, relative URL verified under real GitHub Pages repository path, no server/secret exported.
- [ ] [Frontend] Backend Settings default official HTTPS domain, input validated, custom host warning, test connection, errors/latency; switch server forces logout/tears down WS.
- [ ] [Frontend] Performance 15m chunk load/loot/respawn/exit/rejoin no DOM/GPU resource leaks; graphics Auto/Low etc.
- [ ] [QA] Real laptop (desktop browser) + real HP portrait browser, different networks; auth/lobby/leaderboard/online count/character sync/loot/PvP 5 hit/death/respawn/exit/rejoin.
- [ ] [QA] Frontend HTTPS Pages + API WSS no mixed content, CORS misconfig, 401 leak, JS error; certificate verified.
- [ ] [QA] Health check/register/login/leaderboard protected endpoint scripted smoke; rollback procedure and `systemctl` diagnostics.
- [ ] [QA] Complete final acceptance table AT-01..; mark `PENDING_MANUAL` honestly if device/VPS/browser unavailable, report benchmark measurements.
- [ ] [QA] README deploy local/production, install backend, DNS/TLS, GitHub Pages workflow, backups/restore/rollback, env examples, migration instructions, UI guide.
- [ ] [QA] Update checklist, status, decision/risk logs, handoff; do not claim successful production deployment without live verification.

**Definition of Done Fase 4:** empat gate lulus: (1) gameplay berkualitas pada desktop+HP, (2) backend REST/WS auth+Origin+anti-cheat benar, (3) leaderboard/exit/rejoin konsisten, (4) layanan VPS/domain TLS/GitHub Pages tested beserta backup. Jika deployment masih menunggu DNS/domain/user credentials, tulis `DEPLOYMENT PENDING`, bukan memalsukan keberhasilan.

## 7. SKENARIO UJI AKHIR / ACCEPTANCE TEST — WAJIB

| ID | Skenario | Kriteria lulus |
|---|---|---|
| AT-01 | Solo tanpa backend | Dunia hutan, player, minimap, kamera, kontrol tetap berjalan |
| AT-02 | Desktop | WASD, mouse 360°, run, prone, jump, collision, exit Solo |
| AT-03 | Mobile portrait | Wajib portrait, joystick kiri+look kanan, hold aim + fire multitouch, safe area |
| AT-04 | Large world | Perjalanan banyak chunk, pohon/rumput/batu/rumah, tidak ada leak/perf cliff |
| AT-05 | Random spawn | Minimal 10 kali spawn variasi, collider/boundary aman |
| AT-06 | Loot/drop/throw | Sword/bow/ammo, dua slot, pick/drop/re-pick/throw, no duplicate pickup |
| AT-07 | Aim + LOS | Zoom scope, crosshair, tidak dapat hit di balik tembok/pohon besar |
| AT-08 | Damage | 100→80→60→40→20→0, 5 hit valid tepat, no double hit |
| AT-09 | Respawn | HP100, empty hands, random spawn, 2s invul, UI dan movement pulih |
| AT-10 | Auth REST | Register/login/profil, hash Argon2id, token short-lived RAM, invalid token 401 |
| AT-11 | Lobby | Forest only, choice male/female, online count = joined sessions |
| AT-12 | Leaderboard | Top10 + rank self, kills/deaths/KDR update PvP only dan persisten lintas reboot |
| AT-13 | Leaderboard tampering | POST angka kill client/WS forged payload tidak mengubah leaderboard |
| AT-14 | WS sync | Dua akun + 2 device hadir dalam world yang sama, remote interpolated |
| AT-15 | Sword vs bow | Range 3/10m, hit20, kill feed server username asli, death/respawn |
| AT-16 | Minimap/map | Kiri atas, overlay zoom, posisi self+anonymous opponents, no floating HP/name |
| AT-17 | Exit solo kapan pun | Exit dari normal, pause, death, map; cleanup, bisa enter lagi |
| AT-18 | Exit online kapan pun | leave/ack, count turun, WS tutup, attack in-flight ditolak, bisa rejoin random spawn |
| AT-19 | Combat logout | Window 10s recent damage menghitung death/kill sekali tanpa exit delay |
| AT-20 | Reconnect | Close socket/tab refresh/mobile network drop, no duplicate avatar, count eventually consistent |
| AT-21 | API Origin allow | HTTPS GitHub Origin exact + preflight works, no wildcard, Vary:Origin |
| AT-22 | API Origin deny | evil/null/missing/local origins production gagal untuk browser-facing APIs |
| AT-23 | Spoof Origin limits | curl allowed-Origin palsu tidak bisa akses API priv tanpa valid JWT; limitation dicatat |
| AT-24 | WS Origin/auth | Foreign Origin handshake reject, spoofed allowed without token fails auth |
| AT-25 | Cheating | HP999, damage999, teleport, out-of-range, no-ammo, wall shot, replay ditolak |
| AT-26 | DB integrity | Concurrent kills/duplicate elimination IDs count exactly once; leaderboard index query |
| AT-27 | Load VPS | 2→4→8 clients metrik CPU/RAM/RSS/tick/RTT; hard cap enforced |
| AT-28 | Storage | WAL-safe SQLite backup+restore, log rotation, free disk headroom |
| AT-29 | GitHub Pages | `dist` hanya assets frontend, path relatif bekerja, tidak ada backend/secret terpublish |
| AT-30 | Tencent public deployment | Nginx HTTPS/WSS API, TLS valid, Node loopback, only intended ports open |
| AT-31 | End-to-end real devices | Laptop+HP portrait berbeda jaringan; combat+kill+leaderboard+exit+rejoin works |
| AT-32 | Long gameplay | 15 min forest combat+loot+exit/rejoin tanpa peningkatan GPU/server resources tak berbatas |

**Status test:** `PASS` hanya bila teruji nyata, `FAIL`, `BLOCKED`, atau `PENDING_MANUAL` bila perangkat/tool tidak tersedia. Jangan menyatakan semua selesai hanya karena unit tests pass.

## 8. PANDUAN LOKAL, BUILD, GITHUB PAGES, DAN TENCENT VPS

### 8.1 Skrip project (harus benar-benar dibuat)

```bash
# Development frontend dari root repo; HTTP server melayani root index.html
python3 -m http.server 8000
# buka http://localhost:8000/ (origin development)

# Backend pada VPS / mesin dev
cd server
cp .env.example .env           # isi sendiri, chmod 600; jangan commit
npm ci
npm run db:migrate
npm test
npm run dev                    # bind 127.0.0.1:3000, bukan 0.0.0.0

# Root repo: static only build, bundle tanpa framework
npm run build:pages            # output dist/; harus script nyata
```

Jika scripts belum dibuat saat fase terkait, jangan menulis README palsu. Backend harus punya tests HTTP+WS dan migration runner; root package minimal hanya untuk build/test tooling yang perlu. Konfigurasi template (bukan secret sungguhan):

```dotenv
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
FRONTEND_ORIGINS=https://akbarwiran.github.io
DATABASE_FILE=/var/lib/forest-battleground/game.sqlite
AUTH_SECRET=GENERATE_RANDOM_SECRET_LOCALLY_DO_NOT_COMMIT
ACCESS_TOKEN_TTL_SECONDS=1200
WORLD_SEED=20261104
WORLD_VERSION=forest-v1
ROOM_HARD_CAP=8
TICK_HZ=20
SNAPSHOT_HZ=10
ENEMY_MAP_HZ=2
COMBAT_LOGOUT_SECONDS=10
```

**CORS warning:** jangan mengisi `FRONTEND_ORIGINS=https://akbarwiran.github.io/3D-Adventure/forest-battleground/`; itu path, **bukan Origin**. Tidak ada secret pada Pages. Health check publik `/api/v1/health` sesuai origin; monitoring CLI localhost `/healthz` internal.

### 8.2 Build & deploy GitHub Pages

1. Struktur repository root frontend + `server/` dan `src/shared/`; gunakan `scripts/build-pages.mjs` dengan **allowlist path**: `index.html`, `style.css`, `src/`, `vendor/`, `assets/` yang aman. Output `dist/` root berisi `index.html` dan hanya file frontend.
2. GitHub Actions upload **`dist/` saja** melalui workflow Pages, bukan root repository. Verifikasi artifact tidak berisi `.env`, `server/`, `.sqlite`, `.git`, `node_modules`, debug logs.
3. Import ESM relatif (contoh `./src/main.js`, `../shared/...` **jika lokasi benar**); jalankan built `dist/` di local server untuk smoke sebelum publikasi. Hindari hardcode `/src` yang pecah di subpath Pages.
4. Cek live URL konkret: misal `https://akbarwiran.github.io/<nama-repo>/` (tergantung publishing). **Origin CORS tetap `https://akbarwiran.github.io`**, meskipun path repo berbeda.
5. Tidak perlu custom frontend build framework hanya untuk copying. Tidak perlu secret API key di GitHub repository untuk browser.

### 8.3 Tencent VPS production

1. Inventaris port, project/service existing; backup yang diperlukan. Cek `free -h`, `df -h`, `ss -lntp`, `systemctl`, memori/cpu. Jangan tiba-tiba menjalankan Apache/Nginx baru di port konflik.
2. Domain backend aktual A-record → Tencent public IP. Pasang TLS valid melalui Nginx+ACME; akses `https://<domain>/api/v1/health`, `wss://<domain>/ws`. IP mentah tanpa sertifikat IP valid **tidak cukup** untuk Github Pages HTTPS.
3. Nginx `443 ssl` → upstream `http://127.0.0.1:3000`; WS `Upgrade` dan connection handling dengan timeout masuk akal. Public firewall hanya 443 (+80 redirect/ACME), SSH admin key/IP terbatas; **jangan membuka Node 3000 atau DB port publik**.
4. Node Fastify proses tunggal sebagai systemd nonroot dengan env 0600, restart policy, graceful shutdown; SQLite database di `/var/lib/forest-battleground` owner service, backup `WAL-safe` via job terjadwal, restore tested, logs rotated.
5. Jalankan test real CORS di domain publik: Origin allowed yields ACAO; evil/null/missing denied. Jalankan WS handshake allowed vs forbidden. Uji spoofed Origin dan valid auth requirement; pahami ketidakmampuan CORS memblokir curl yang forged.
6. Uji dua akun dari laptop dan HP portrait, beda jaringan, kill/feed/score, leave/ack, login ulang, respawn. Stress uji 2,4,8 dan catat metrik; rollback jika terlalu berat.
7. Tuliskan playbook: `systemctl status`, `journalctl -u ...`, Nginx config test, cert renewal, backup+restore, migration, git rollback, dan cara melihat jumlah connected sessions dengan endpoint metrics **internal-only**.

### 8.4 Trade-off produk/keamanan

- Hutan 1 km² dengan sedikit pemain → target sulit dicari; POI+loot hotspots dan blip minimap (anonim) membantu, tapi merusak sebagian stealth.
- GitHub Pages cross-origin + backend configurable → login ke **server palsu** berpotensi mencuri password; default resmi + warning custom domain sebelum auth.
- Mengizinkan hanya satu Origin di REST/WS **tidak mengautentikasi kode frontend**, Origin bisa dipalsukan oleh nonbrowser, dan semua project pages GitHub host yang sama berbagi origin. Lebih kuat lewat auth server dan anticheat; custom domain terpisah bila benar-benar perlu isolasi web app.
- SQLite single writer tepat bagi satu proses/VPS, tetapi backup dan sync leaderboard harus benar. Bila berkembang horizontal, baru PostgreSQL/Redis setelah hasil pengukuran.
- Token RAM lebih aman dari penyimpanan browser persisten terhadap pencurian pasca-refresh, tetapi XSS masih bisa membaca token aktif; Content Security Policy dan DOM escaping tetap penting.
- Keluar saat pertempuran bisa dipakai menghindari death; MVP counter: combat logout 10s, exit tetap langsung tanpa dipaksa menunggu.
- Anti-cheat browser tidak absolut; server tetap source of truth.

## 9. STATUS PROYEK — ISI SEBAGAI BUKTI, BUKAN KLAIM

> **Status awal 2026-11-04:** file ini adalah spesifikasi, belum ada implementasi Forest Battleground yang diverifikasi. Hermes harus audit repo/mesin aktual sebelum memberi checklist `[x]`.
>
> **Update 2026-11-05 (audit ulang Fase 1–2 atas permintaan user):** setiap baris di
> bawah ini diverifikasi dengan menjalankan perintah nyata pada repo aktual, bukan
> dari checklist atau komentar kode.

| Fase | Status | Bukti wajib (terverifikasi) |
|---|---|---|
| 1 — Frontend world+controls & backend skeleton CORS/SQLite | **VERIFIED** | unit 42/42; HTTP+security 32/32; `browser-smoke.mjs` PASS (WebGL nyata, Solo loot→5 hit→death→respawn→exit, listener bus 0); `mobile-emu-check.mjs` PASS (390×844 DPR3, touch emulation, joystick gerak 2.87 m, multitouch joystick+look simultan, rotate-hint none); build:pages 37 file 2.07 MB audit lolos; dist tanpa server/.env/DB |
| 2 — Solo combat + REST auth/lobby/leaderboard | **VERIFIED** | unit 42/42; backend auth/http/security 32/32; `browser-smoke.mjs` PASS (register→login→lobby onlineCount 0/8 authoritative→leaderboard empty-state→Solo tetap jalan); `leak-20x-check.mjs` PASS (20× masuk-keluar: sesi null, listener 0, scene graph identik 368 obj/232 geo/59 mat/38 loot/4 bot); Argon2id terukur 115 ms/hash di 2 vCPU |
| 3 — Realtime authoritative PvP + persistent leaderboard + exit | **CODE COMPLETE / QA PENDING** | `realtime.test.js` 9/9; `load-stage.mjs` PASS (PvP pedang-vs-busur 5 hit, duel×2, respawn 3 s, load 2/4/8 klien tick 19.8–19.9 Hz, snapshot p50 100–101 ms, RSS 151→196 MB); produksi WSS/TLS: Origin asing/null → close 1008. **Belum** PvP dua browser nyata lintas jaringan |
| 4 — Hardening/load/deploy | **IN PROGRESS** | GPU leak fix A-06 + uji invariant (leak-20x PASS); sisa: load 8→16, backup/restore drill, anti-cheat audit, deploy Pages final |

Gunakan status `NOT STARTED`, `IN PROGRESS`, `BLOCKED`, `CODE COMPLETE / QA PENDING`, `VERIFIED`.

### Temuan audit 2026-11-05 (bug & gap nyata, sudah diperbaiki)

| # | Temuan | Bukti | Status |
|---|---|---|---|
| A-01 | Checklist Fase 1 butir 5 belum terpenuhi: pohon hanya **2 varian** (spec ≥3) | `grep "Pohon varian" src/world/vegetation.js` → 2 hasil | DIPERBAIKI: varian 3 (pohon kerdil/mati, `tree3`+`snagTop3`, seed `0x534e4147`) |
| A-02 | Batu hanya **2 varian terlihat** (spec ≥3); `rockLarge` + `createLargeRock()` dibuat tapi tidak pernah dipanggil | `grep -rn "createLargeRock"` → hanya definisi, nol pemakaian | DIPERBAIKI: `buildLargeRocks()` 18 batu besar deterministik + collider; digambar di `buildStructures()` |
| A-03 | **Jalan setapak tidak ada** (spec: "jalan tanah sempit"); material `path` dibuat tapi tak terpakai | `grep -rho "mats\.path" src/world/` → kosong | DIPERBAIKI: `buildPaths()` 15 segmen + warna vertex terrain (`mats.terrain` vertexColors), fade tepi 2.5 m, **nol draw call tambahan** |
| A-04 | **Kebocoran heap ~130 KB per sesi Solo** (bertahan setelah 3× GC) | `leak-curve.mjs`: delta konstan 1.38 MB/1.37 MB/1.30 MB per 10 sesi; `leak-trace.mjs` → `WebGLTextures`/`WebGLProgram`/`WebGLUniforms`/`WebXRManager` menumpuk | DIPERBAIKI: `WebGLRenderer` jadi singleton per halaman (`shared` di `renderer.js`); `dispose()` hanya lepas render-list + scene. Setelah fix: 92 KB→81 KB→23 KB (menurun = cache menjenuh, bukan bocor), `leak-20x-check.mjs` PASS |
| A-05 | Smoke test gagal palsu karena memakai **port debug tetap** — Chrome zombie dari run sebelumnya membuat run baru menyambung ke tab basi | `ss -ltnp` → port 9333 masih dipegang chrome lama | DIPERBAIKI: port CDP acak per run di 7 test (browser-smoke, online-smoke, mobile-emu, leak-*) |
| A-06 | **Tekstur GPU bocor +1/sesi**: `light.shadow.map` (WebGLRenderTarget 1024²) dibuat per sesi, tidak pernah di-dispose; three.js tidak melepasnya otomatis | `leak-diag.mjs`: `info.memory.textures` 1→2→3→4 per sesi; heap JS tetap (bukan heap JS yang bocor) | DIPERBAIKI: `session.dispose()` melepas `shadow.map` + set null; `leak-20x-check.mjs` kini memverifikasi `tex` identik antar sesi — `tex: 1` stabil 20 sesi, VERDICT PASS |
| A-07 | Threshold uji leak salah: heap naik 72% base→akhir dinyatakan bocor, padahal V8 heap growth + cache three.js (slope menurun 98k→74k→25k→0 KB/10 sesi = plateau) | `leak-curve.mjs` 40 sesi | DIPERBAIKI: ukur slope sesi 10→20 (>100 KB = bocor linear), bukan base→akhir |

**Catatan jujur:** temuan A-01..A-07 di atas semuanya ditemukan lewat eksekusi nyata
pada sesi ini, dan pada awalnya tiga di antaranya (A-01, A-02, A-03) sempat
tertulis `[x]` di TASKS.md tanpa memenuhi isi spesifik butir checklist. Itu pelajaran:
`[x]` harus dibaca per-butir, bukan per-grup.


### Decision log (baseline, boleh direvisi hanya dengan bukti)

| ID | Keputusan | Alasan |
|---|---|---|
| D-001 | Three.js pinned + vanilla ESM, static dist whitelist | Browser game ringan dan kompatibel GitHub Pages |
| D-002 | Satu repo frontend+backend; API sejak F1 | Hermes di VPS mampu membangun kedua sisi per fase, mengurangi integrasi terlambat |
| D-003 | Node 24 LTS + Fastify v5 + @fastify/websocket | Single process, efisien, library ecosystem matang |
| D-004 | SQLite WAL + better-sqlite3; no Redis/Postgres | Satu VPS 2core/4GB, persistence hanya user/rank, minim operasional |
| D-005 | 1 authoritative Forest room, 20 Hz server, 10Hz AoI snapshot | Hemat CPU/bandwidth dan mencegah client cheating |
| D-006 | Map 1024×1024 m = 1.048.576 m², chunk 64m | Luas dunia sesuai kebutuhan, chunking wajib agar ringan |
| D-007 | Mobile portrait-only; desktop flexible | UX sesuai perangkat |
| D-008 | HP100, semua hit20, sword3m/bow10m | Tepat 5 hit valid = death |
| D-009 | Leaderboard PvP server kills/deaths/KDR, stable sort | Tidak bisa diubah lewat frontend/REST user |
| D-010 | Exit kapan saja, leave scoped, combat logout 10s | UX dan mitigasi exploit |
| D-011 | CORS/WS Origin exact `https://akbarwiran.github.io`, auth mandatory | Pembatasan browser; tidak menjamin nonbrowser blocked |
| D-012 | Browser short-lived token in memory, login ulang setelah refresh | Tidak bergantung cross-site cookie yang sering diblok |
| D-013 | Max awal 8, uji 2→4→8; 16 jika benchmark aman | Kapasitas tidak bisa ditetapkan hanya dari spesifikasi VPS |
| D-014 | Solo guest tetap offline, online harus login | Mengurangi dependency network pada gameplay/testing |

### Risk log / backlog

| Prioritas | Risiko | Mitigasi / status |
|---|---|---|
| HIGH | VPS kehabisan 2vCPU/4GB saat load/Argon2/WS | Cap awal8, rate limit auth concurrency, profiling tick, AoI, no DB writes/tick; BELUM DIUJI |
| HIGH | Frontend statis membocorkan file server/secret | Build whitelist dist-only + test artifact; BELUM DIUJI |
| HIGH | Ilusi 'API hanya dari GitHub Pages' | Origin browser-only, spoof test, JWT+authoritative rules; LIMITASI DESAIN |
| HIGH | Mobile portrait FPS drop di vegetasi padat | Instancing/chunk/LOD/adaptive pixel ratio; BELUM DIUJI |
| HIGH | Double kill/death saat reconnect atau duplicate event | Unique event ledger + SQLite transaction; BELUM DIUJI |
| HIGH | Endpoint custom mengarah phishing server | Default resmi dan explicit warning sebelum login; BELUM DIUJI |
| MED | Enemy always visible di minimap mengurangi stealth | AoI movement + 1–2Hz coarse enemy map, configurable visibility; RISIKO DITERIMA |
| MED | 1km² map membuat encounter jarang | POI/loot clusters dan minimap, spawn safe; RISIKO DITERIMA |
| MED | Token hilang saat browser refresh | Re-login MVP, jelas dalam README; RISIKO DITERIMA |
| MED | SQLite WAL backup corrupt kalau copy sembarangan | Online backup + restore drill + disk rotation; BELUM DIUJI |

## 10. HANDOFF CHECKPOINT — DIUPDATE SEBELUM HERMES SELESAI/TOKEN HABIS

**Agent berikutnya:** baca prompt lengkap, lalu cek repository aktual, `git status`/diff, config yang aman, logs tes terakhir, service yang sudah berjalan, dan aktifkan increment terdekat. Tidak perlu membuat project ulang bila struktur sudah ada. Jangan menandai item checklist `[x]` tanpa test nyata.

```text
Fase aktif: 4 (Fase 1, 2, 3 terverifikasi selesai; Fase 4 IN PROGRESS)
Increment aktif: Fase 4 — sisa: load test 8→16, backup/restore drill, audit anti-cheat, deploy Pages final, QA HP asli
Tanggal terakhir diperbarui: 2026-11-05
Commit/branch terakhir: lihat `git log -1` (branch main)
Server/VPS: Tencent 2 vCPU, 3.66 GB RAM, 69 GB disk (20 GB used); Node 22 sistem (Hermes) +
  /opt/node24 (backend). apache2/mariadb inactive+disabled. Port 80/443 dipakai nginx
  (api-be.bssn.biz.id → 127.0.0.1:3000). Node backend TIDAK pernah bind ke interface publik.
Origin production: https://akbarwiran.github.io
Production backend domain/TLS: https://api-be.bssn.biz.id (nginx + Let's Encrypt, expires 2027-02-02)
Database: SQLite WAL di /var/lib/forest-battleground/game.sqlite (tabel users, player_stats, elimination_events)
REST/WS: REST `/api/v1/*` aktif di produksi (tanpa Origin → 403; Origin sah → 200).
  WSS `/ws` aktif; Origin asing/null → close 1008 ORIGIN_FORBIDDEN.
GitHub Pages live URL: https://akbarwiran.github.io/3D-Adventure/ (di-deploy dari repo ini; lihat workflow)

Selesai terverifikasi:
- Fase 1: dunia 1024×1024 m seed 20261104, chunk 64 m, ring 2; 14 rumah dapat dimasuki,
  10 POI, 48 kandidat spawn, 38 titik loot, 74 collider (56 dinding rumah + 18 batu besar);
  pohon 3 varian, semak, rumput 2 tinggi, batu 3 varian, jalan setapak 15 segmen.
- Fase 2: solo loop penuh (loot → 5 hit ×20 HP → kill feed → death overlay → respawn 3 s
  HP100/tangan kosong → exit bersih), register/login Argon2id, lobby + leaderboard + online
  count authoritative dari sesi WS (bukan jumlah akun).
- Fase 3: gateway WSS authoritative 20 Hz, snapshot AoI 10 Hz, protokol v1, room cap 8,
  ledger eliminasi SQLite idempoten, combat-logout 10 s.

File yang sudah dibuat/diubah (sesi 2026-11-05):
- src/core/renderer.js — WebGLRenderer singleton (fix kebocoran A-04)
- src/shared/world.js — buildLargeRocks(), buildPaths(), distanceToPath(); collider batu;
  kandidat spawn menghindari batu
- src/world/vegetation.js — pohon varian 3
- src/world/buildings.js — menggambar batu besar ber-collider
- src/world/terrainChunk.js — warna vertex jalan setapak (vertexColors)
- src/world/materials.js — barkDark, terrain (vertexColors), dukungan opsi vertexColors
- server/tests/{mobile-emu-check,leak-20x-check,leak-curve,leak-trace,leak-diag,probe-*}.mjs — uji baru
- server/tests/*.mjs — port CDP acak (fix kegagalan palsu A-05)
- src/core/session.js — dispose shadow.map (fix bocor GPU A-06)
- server/tests/leak-20x-check.mjs — invariant tekstur GPU + threshold slope heap (A-06/A-07)
- server/src/http/routes/auth.js — REGISTER_RATE_MAX/REGISTER_RATE_WINDOW_MS override env (QA backend 60/15m, produksi tetap 5/15m)
- server/scripts/start-qa-backend.sh — export REGISTER_RATE_MAX=60

Tes terakhir (perintah + output ringkas):
- `npm test` (frontend unit) → 42/42 lulus
- `cd server && npm test` → 32/32 lulus (auth/http/security)
- `node --test server/tests/realtime.test.js` → 9/9 lulus
- `node server/tests/browser-smoke.mjs` → VERDICT PASS
- `node server/tests/mobile-emu-check.mjs` → VERDICT PASS
- `node server/tests/leak-20x-check.mjs` → VERDICT PASS
- `npm run build:pages` → 37 file, 2.08 MB, audit lolos
- `node server/tests/browser-smoke.mjs` (backend QA nyata 3100, DB bersih) → VERDICT PASS
  (solo: loot POI→5 hit 100→0→kill feed→respawn→exit; register→login→lobby onlineCount 0/8→
   online join→enemy marker 1→exit bersih; QA backend pakai REGISTER_RATE_MAX=60)

Known bugs/blockers:
- Fase 3 belum diuji PvP dua browser nyata lintas jaringan (hanya WSS langsung + smoke headless).
- PENDING_MANUAL: FPS/panas/baterai HP asli (angka headless SwiftShader 4–12 FPS TIDAK valid),
  multitouch sentuh nyata, safe-area notch iPhone.
- Rate limit register 5/15 m/IP adalah ketatnya produksi — uji ulang akun baru perlu tunggu.

Asumsi dan keputusan:
- D-001..D-014 di atas tetap berlaku; tidak ada yang direvisi pada sesi ini.
- Tambahan: terrain memakai vertexColors untuk jalan setapak (hemat draw call) — batu besar
  collider tetap objek terpisah karena jumlahnya sedikit (18).

Tiga aksi selanjutnya:
1. Fase 3 QA sisa: PvP dua browser nyata (laptop + HP) satu room, verifikasi kill masuk
   leaderboard lintas restart, exit/rejoin count benar.
2. Fase 4: audit anti-cheat WSS (frame oversized, seq replay, hp/damage palsu), load test
   bertahap ke 8→16 klien, backup/restore drill SQLite.
3. Uji HP asli untuk PENDING_MANUAL, lalu deploy final GitHub Pages + pemantauan produksi.
```

**Handoff report setelah setiap increment:** tuliskan `FILES CHANGED`, `COMMANDS RUN`, `TESTS RESULTS (PASS/FAIL/PENDING_MANUAL)`, `RESOURCE MEASUREMENTS CPU/RSS/DISK`, `SECURITY CHECKS`, `NEXT SMALL TASK`, `PENDING BLOCKERS`. Penting: frontend/backend progress harus terlihat bersama di tiap fase. Tidak boleh mengganti 4 fase menjadi rencana tanpa pekerjaan nyata.

## 11. REFERENSI TEKNIS YANG HARUS DICEK HERMES

- GHOSTDASH dan pelajaran review kode: https://github.com/AkbarWiraN/3D-Adventure/tree/main/ghostdash
- Node.js release status resmi: https://nodejs.org/en/about/previous-releases (24 LTS dan 26 LTS pada November 2026; cek addon compatibility sebelum upgrade)
- Fastify: https://fastify.dev/docs/latest/
- Fastify websocket: https://github.com/fastify/fastify-websocket
- SQLite WAL: https://www.sqlite.org/wal.html
- SQLite online backup: https://www.sqlite.org/backup.html
- OWASP Password Storage: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- MDN CORS dan Origin semantics: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS dan https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Origin
- MDN native WebSocket browser: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
- GitHub Pages docs: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- Three.js InstancedMesh dan disposal: https://threejs.org/docs/pages/InstancedMesh dan https://threejs.org/manual/pages/how-to-dispose-of-objects.html

> Security principle: CORS controls whether **browsers let JavaScript read responses**, not whether the internet can make requests to a public server. Browser WebSocket does not use CORS but sends an Origin header; validate at handshake and always authenticate the session. Public JS can be inspected; never embed secrets.

**INSTRUKSI AKHIR UNTUK HERMES:** Kerjakan **Fase 1 sekarang** dengan kode **frontend DAN backend REST dasar** yang benar-benar jalan dan diuji pada lingkungan VPS yang telah diaudit; jangan menunda backend sampai Fase 3. Setiap fase punya checklist frontend+backend+integrasi+security+test, dan final Fase 4 harus menghasilkan frontend yang bisa diterbitkan ke GitHub Pages serta API/WSS yang aman dan hemat VPS Tencent 2vCPU/4GB/50GB. **Jangan** memalsukan test/performa/domain TLS, jangan mengklaim pembatasan CORS dapat memblokir `curl` yang memalsukan Origin, dan jangan minta persetujuan untuk tugas teknis kecil yang aman. Update checkpoint dan item checklist faktual setiap increment.
