# Fase 2 handoff

## Implementasi terverifikasi (perbaruan 2026-11-05)
- Browser QA nyata LULUS: `cd /home/ubuntu/3D-Adventure/forrest-battleground && /opt/node24/bin/node server/tests/browser-smoke.mjs`
  → butuh server statis `npm run serve` (port 8099) dan, untuk fase register/login,
    backend uji: `cd server && PORT=3100 FRONTEND_ORIGINS=https://akbarwiran.github.io,http://127.0.0.1:8099 AUTH_SECRET=... DATABASE_FILE=/tmp/fb-e2e.sqlite /opt/node24/bin/node src/server.js`
    lalu `BACKEND_URL=http://127.0.0.1:3100 /opt/node24/bin/node server/tests/browser-smoke.mjs`
- Script memakai Chrome headless (`/usr/bin/google-chrome`) + WebGL SwiftShader + CDP via `ws`.
  Exit code 1 bila VERDICT FAIL. FPS SwiftShader BUKAN metrik performa perangkat.
- Perbaikan nyata: respawn loop (`die()` guard), `aimDirection()` basi, tinggi bot vs terrain,
  loot di dalam rumah terhalang dinding (LOS) — uji pakai loot POI.

## Belum selesai/terbukti
- HP Android/iOS asli: FPS, panas, baterai, multitouch joystick+drag-look, safe-area notch.
- CPU/RSS server produksi, deploy, restart.
- UI/visual combat belum direview manusia.

## Cara cek
```sh
cd /home/ubuntu/3D-Adventure/forrest-battleground
npm test && npm run build:pages
cd server && /opt/node24/bin/node --test tests/*.test.js
```
