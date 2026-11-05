# ACCEPTANCE TEST — Forest Battleground (AT-01..AT-32, prompt.md §7)

> Status per 5 Nov 2026 (run malam #8). Bukti mengacu ke suite test nyata di repo:
> `npm test` (unit 49), `server npm test` → realtime 12/12, security+REST 35/35,
> `browser-smoke.mjs`, `mobile-emu-check.mjs`, `leak-20x-check.mjs`, `leak-curve.mjs`,
> `load-stage.mjs`, `restore-drill.mjs`. Detail bukti per item: TASKS.md Fase 1–4.

| ID | Skenario | Status | Bukti nyata |
|---|---|---|---|
| AT-01 | Solo tanpa backend | PASS | `browser-smoke.mjs` VERDICT PASS — Solo full loop tanpa backend (hanya server statis) |
| AT-02 | Desktop (WASD/mouse/run/prone/jump/collision/exit) | PASS | unit `movement.test` + `browser-smoke` (exit leak-free, 0 listener tersisa) |
| AT-03 | Mobile landscape (rotate-hint, joystick, multitouch, safe-area) | PASS-EMU / PENDING_MANUAL perangkat | `mobile-emu-check.mjs` PASS landscape 844×390 DPR 3; portrait→rotate-hint. **HP asli belum diuji (PENDING_MANUAL)** |
| AT-04 | Large world tanpa leak/perf cliff | PASS | `leak-20x-check.mjs` 20× sesi: scene identik, tex GPU stabil, slope heap <100 KB; `leak-curve.mjs` 40 sesi plateau |
| AT-05 | Random spawn ≥10 kali aman | PASS | unit spawn deterministic + realtime test #8 (20 sampel safe spawn ≥30 m dari musuh) |
| AT-06 | Loot/drop/throw 2 slot | PASS | realtime test #4 (pickup bow, ammo, re-pickup), unit loot |
| AT-07 | Aim + LOS (tembok/pohon besar) | PASS | browser-smoke fase LOS (loot dalam rumah terhalang dinding — bug nyata ditemukan & diverifikasi lewat LOS) |
| AT-08 | Damage 100→0 tepat 5 hit, no double hit | PASS | realtime test #4: dua duel terpisah, masing-masing 100→80→60→40→20→0; cooldown server `COOLDOWN` menolak hit ganda (room.js) |
| AT-09 | Respawn HP100/tangan kosong/invul 2 s/UI pulih | PASS | realtime test #4 + browser-smoke (respawn 3 s, HP 100, senjata jatuh) |
| AT-10 | Auth REST (Argon2id, token pendek RAM, 401 invalid) | PASS | `auth.test.js` (35/35); invalid token → 401; logout → revoke jti (realtime #12) |
| AT-11 | Lobby forest only, P/L, online count = joined WS | PASS | browser-smoke produksi: onlineCount 0/8→1/8→0; bukan hitungan akun |
| AT-12 | Leaderboard top10 + rank self, PvP-only, persisten | PASS | realtime #4 (leaderboard 1/1 dua akun setelah duel); restore-drill: leaderboard queryable dari DB restore |
| AT-13 | Leaderboard tampering (POST kill / WS forged) | PASS | leaderboard.js tanpa route tulis (405); forged `give`/`kill`/`die` di WS → `TYPE_UNKNOWN` (realtime #10) |
| AT-14 | WS sync 2 akun world sama, interpolasi | PASS | `online-smoke.mjs` + browser-smoke produksi 2-klien (enemy_markers ≥1) |
| AT-15 | Sword vs bow range, kill feed username asli | PASS | realtime #4 (sword vs bow 2 duel) + #11 (kill feed sampai 2 klien, username mentah) |
| AT-16 | Minimap/overlay, self + musuh anonim, no floating name | PASS | browser-smoke: minimap + 1 marker musuh anonim; snapshot musuh 2 Hz anonim (gateway) |
| AT-17 | Exit Solo kapan pun + re-enter | PASS | leak-20x 20× masuk-keluar Solo, sesi null, bus 0 listener |
| AT-18 | Exit Online (ack, count turun, attack in-flight ditolak, rejoin) | PASS | realtime #4 (leave → count turun) + #11 (rejoin state bersih: sessionId baru, HP 100) |
| AT-19 | Combat logout window 10 s kredit 1 kill | PASS | realtime #7 (combat-logout kredit sah) + #11 (logout bersih 0 kredit palsu) |
| AT-20 | Reconnect (close/refresh/drop, no duplicate avatar) | PASS | realtime #6 (duplicate login → 1 avatar aktif) + #11 (rejoin count konsisten). **Drop jaringan HP nyata: PENDING_MANUAL** |
| AT-21 | Origin allow exact + preflight + Vary | PASS | security.test (31: origin sah 200 + ACAO exact; 64: preflight izin) |
| AT-22 | Origin deny (evil/null/missing/local) | PASS | security.test 38/43/48/53; produksi curl: tanpa Origin 403 |
| AT-23 | Spoof Origin via curl: REST priv tetap 401 tanpa JWT | PASS | curl produksi `/api/v1/maps` Origin sah tanpa token → 401 NO_TOKEN (TASKS.md Fase 4 cert run); keterbatasan dicatat (Origin bukan auth) |
| AT-24 | WS Origin/auth | PASS | realtime #1 (origin asing close) + #3 (token invalid close); produksi WSS: Origin asing → 1008 ORIGIN_FORBIDDEN |
| AT-25 | Cheating (HP999/damage999/teleport/no-ammo/wall shot/replay) | PASS | realtime #5 (seq replay, teleport, damage palsu) + #10 (flood, NaN, forged, binary, clampToWorld); hp/damage klien tidak pernah dipercaya (server authoritative) |
| AT-26 | DB integrity (kill ganda/event duplikat = 1, index) | PASS | leaderboardRepo `INSERT OR IGNORE` event_id + transaksi; `res.changes===0` → tidak double count (writeKill idempotent) |
| AT-27 | Load VPS 2→4→8(+16) klien, cap | PASS | `load-stage.mjs`: 16 klien tick 19.9 Hz, CPU 5.3%, RSS 198 MB, p95 102 ms, 0 error; cap produksi tetap 8 (keputusan: naik 16 butuh 2 perangkat nyata) |
| AT-28 | Storage (backup WAL-safe, rotasi log, disk) | PASS | backup-db.mjs Online Backup API; restore-drill PASS (sintetis + produksi nyata malam #3); journald dibatasi 400 MB; disk 43 GB free |
| AT-29 | GitHub Pages dist-only, path relatif, no secret | PASS | `build:pages` 38 file 2.11 MB audit whitelist lolos; Pages live 200 semua asset; dynamic import relatif diperbaiki (bug nyata) |
| AT-30 | Tencent public (Nginx HTTPS/WSS, TLS valid, Node loopback) | PASS | cert LE CN api-be.bssn.biz.id s/d 2 Feb 2027; 3000 bind 127.0.0.1; 80/443 nginx; default_server 444 (run ini); WSS produksi join OK |
| AT-31 | End-to-end real devices (laptop+HP beda jaringan) | **PENDING_MANUAL** | Butuh HP nyata Ken; laptop desktop browser sudah PASS (browser-smoke produksi) |
| AT-32 | Long gameplay 15 m tanpa resource tak berbatas | PASS-SIM / PENDING_MANUAL perangkat | leak-curve 40 sesi plateau (bukan 15 m jam dinding di HP); leak-20x 20 sesi tanpa leak GPU/DOM |

**Ringkasan:** 27 PASS penuh, 3 PASS di emulator/simulasi + PENDING_MANUAL perangkat nyata
(AT-03, AT-20 sebagian, AT-32), 1 PENDING_MANUAL murni (AT-31), 1 gagal dini (AT-32 15 m
jam dinding HP nyata belum dijalankan — yang diukur kebocoran resource lintas sesi).

Tidak ada klaim production-complete: AT-31 tetap menunggu HP asli (lihat TASKS.md → PENDING_MANUAL).
