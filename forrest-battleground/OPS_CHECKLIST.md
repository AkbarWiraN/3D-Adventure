# Checklist Operasional — Forest Battleground (VPS 43.173.6.81)

> Status 5 Nov 2026 (malam): **SUDAH DINYALAKAN LAGI SEMUA** — backend, nginx, dan
> fb-backup.timer aktif+enabled (restore drill produksi sukses). Frontend GitHub
> Pages (statis) tidak pernah terpengaruh.

## Status service (saat ini SEMUA nyala)
| Service | Fungsi | Status |
|---|---|---|
| `forest-battleground.service` | Backend Fastify (REST+WSS), bind 127.0.0.1:3000 | **active, enabled** |
| `fb-backup.timer` | Backup SQLite harian 03:17 | **active, enabled** (next 6 Nov 03:17) |
| `nginx.service` | Reverse proxy TLS api-be.bssn.biz.id (80/443) | **active, enabled** |

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

## Lokasi penting
- Kode: `~/3D-Adventure/forrest-battleground/server` (env: `server/.env`)
- DB SQLite: `/var/lib/forest-battleground/game.sqlite` (+ -wal/-shm)
- Unit: `/etc/systemd/system/forest-battleground.service`, `fb-backup.{service,timer}`
- Nginx vhost: `/etc/nginx/sites-available/api-be.bssn.biz.id` → sites-enabled
- Sertifikat: `/etc/letsencrypt/live/api-be.bssn.biz.id/`
- Deploy frontend: push ke `main` → workflow `.github/workflows/pages.yml`
