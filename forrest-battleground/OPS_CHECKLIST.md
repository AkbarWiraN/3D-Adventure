# Checklist Operasional — Forest Battleground (VPS 43.173.6.81)

> Status 5 Nov 2026 (malam #4): **KONFLIK PORT** — backend + fb-backup.timer
> aktif+enabled (dipulihkan lagi). Nginx MASIH MATI karena port 80/443 dipegang
> Apache2 (di-start manual root 15:48 oleh sesi pentest lain, masih berjalan).
> SNI api-be.bssn.biz.id saat ini dilayani Apache dengan cert SELF-SIGNED
> Subang-CSIRT — API game publik TIDAK bisa dipakai sampai Apache berhenti.
> Frontend GitHub Pages (statis) tetap hidup.

## Status service (saat ini SEMUA nyala)
| Service | Fungsi | Status |
|---|---|---|
| `forest-battleground.service` | Backend Fastify (REST+WSS), bind 127.0.0.1:3000 | **active, enabled** |
| `fb-backup.timer` | Backup SQLite harian 03:17 | **active, enabled** (next 6 Nov 03:17) |
| `nginx.service` | Reverse proxy TLS api-be.bssn.biz.id (80/443) | **MATI** (port 80/443 dipegang Apache manual — lihat header) |

Tidak disentuh (milik lain/bawaan): `wan-monitor` (3100), `certbot.timer`, `apache-htcacheclean`.

## CARA MENYALAKAN LAGI (urutan WAJIB)
```bash
# 1. Backend game dulu (Nginx proxy butuh target hidup)
sudo systemctl enable --now forest-battleground.service
systemctl is-active forest-battleground.service            # harus: active
curl -s http://127.0.0.1:3000/api/v1/health                # lokal: {"status":"ok"}

# 2. Nginx (TLS + proxy ke 3000)
sudo systemctl enable --now nginx.service
curl -s https://api-be.bssn.biz.id/api/v1/health -H 'Origin: https://akbarwiran.github.io'
# harus balas JSON ok (BUKAN 502)

# 3. Backup harian
sudo systemctl enable --now fb-backup.timer
systemctl list-timers fb-backup.timer                       # NEXT terisi
```

## Verifikasi cepat setelah nyala
- [ ] `systemctl is-active forest-battleground nginx` → dua-duanya `active`
- [ ] `ss -tlnp | grep -E ':80|:443|:3000'` → 3000 (node), 80/443 (nginx)
- [ ] `curl https://api-be.bssn.biz.id/api/v1/health -H 'Origin: https://akbarwiran.github.io'` → ok
- [ ] Uji WSS: lobby online dari HP/desktop bisa join room forest
- [ ] `fb-backup.timer` aktif

## Mematikan lagi (untuk pentest/maintenance)
```bash
sudo systemctl disable --now forest-battleground.service fb-backup.timer nginx.service
```
PERINGATAN (5 Nov): mematikan nginx saja TIDAK membebaskan 80/443 untuk game;
Apache yang di-start manual (`apache2 -k start`, bukan systemd) juga harus
di-stop sebelum nginx bisa bind. Koordinasikan dengan sesi pentest.

## Prosedur ROLLBACK (backend / DB / nginx)
Ditulis 5 Nov 2026 (malam #8) — memenuhi checklist QA Fase 4 (rollback procedure).

### A. Rollback KODE backend (deploy baru bermasalah)
```bash
cd ~/3D-Adventure/forrest-battleground
git log --oneline -5                       # temukan commit terakhir yang sehat
git checkout <commit-sehat> -- server/     # atau: git revert <commit-rusak>
sudo systemctl restart forest-battleground.service
curl -s http://127.0.0.1:3000/api/v1/health   # harus {"status":"ok"} lokal
curl -s https://api-be.bssn.biz.id/api/v1/health -H 'Origin: https://akbarwiran.github.io'
```
Migrasi SQLite bersifat additive & idempotent (`fresh:[]` saat restart) — rollback kode
TIDAK perlu rollback schema; kolom/tabel baru dibiarkan (tidak dipakai kode lama).

### B. Rollback DATABASE (restore dari backup)
```bash
sudo systemctl stop forest-battleground.service
ls -t ~/3D-Adventure/forrest-battleground/backups/ | head    # pilih backup terbaru
sudo -u ubuntu cp /var/lib/forest-battleground/game.sqlite /tmp/game-pre-restore.sqlite   # safety copy
sudo -u ubuntu /opt/node24/bin/node ~/3D-Adventure/forrest-battleground/server/scripts/backup-db.mjs \
  --verify ~/3D-Adventure/forrest-battleground/backups/<file>   # integrity dulu!
sudo -u ubuntu bash -c 'rm -f /var/lib/forest-battleground/game.sqlite{-wal,-shm}'
sudo -u ubuntu cp ~/3D-Adventure/forrest-battleground/backups/<file> /var/lib/forest-battleground/game.sqlite
sudo systemctl start forest-battleground.service
```
Sudah didrill nyata di PRODUKSI 5 Nov (malam #3): downtime <60 s, integrity ok,
users+leaderboard queryable. Verifikasi restore: `server/tests/restore-drill.mjs`.

### C. Rollback FRONTEND Pages
```bash
# GitHub → repo 3D-Adventure → Actions → pages.yml → pilih run sehat → Re-run,
# atau revert commit frontend lalu push (deploy ~1 menit).
```
### D. Rollback config nginx
```bash
sudo nginx -t && sudo systemctl reload nginx   # setelah edit; backup harian config ada di /etc/nginx
# default_server cadangan pra-hardening (5 Nov): ~/.hermes/cache/scratch/nginx-default.bak-*
```
## Lokasi penting

- Kode: `~/3D-Adventure/forrest-battleground/server` (env: `server/.env`)
- DB SQLite: `/var/lib/forest-battleground/game.sqlite` (+ -wal/-shm)
- Unit: `/etc/systemd/system/forest-battleground.service`, `fb-backup.{service,timer}`
- Nginx vhost: `/etc/nginx/sites-available/api-be.bssn.biz.id` → sites-enabled
- Sertifikat: `/etc/letsencrypt/live/api-be.bssn.biz.id/`
- Backup DB: `~/3D-Adventure/forrest-battleground/backups/` (ReadWritePaths fb-backup.service)
- Deploy frontend: push ke `main` → workflow `.github/workflows/pages.yml`
