#!/bin/bash
# fb-disk-check.sh — alarm disk free <10 GB untuk root + journal + backup dir.
# Dipanggil oleh fb-disk-check.timer (harian 04:03). Output ke journald.
set -euo pipefail

THRESHOLD_GB=10
ALERT=0

check_fs() {
  local path="$1"
  local label="$2"
  local avail_gb
  avail_gb=$(df -BG "$path" 2>/dev/null | awk 'NR==2 {gsub("G","",$4); print $4}')
  if [ -z "$avail_gb" ]; then
    echo "WARN $label: path tidak ada atau tidak bisa di-df ($path)"
    ALERT=1
    return
  fi
  if [ "$avail_gb" -lt "$THRESHOLD_GB" ]; then
    echo "ALERT $label: free space ${avail_gb} GB < ${THRESHOLD_GB} GB ($path)"
    ALERT=1
  else
    echo "OK $label: free space ${avail_gb} GB ($path)"
  fi
}

check_fs / "rootfs"
check_fs /var/log/journal "journald"
check_fs /home/ubuntu/3D-Adventure/forrest-battleground/backups "backup-dir"

# Cek ukuran journald sendiri (bisa tumbuh tak terkendali)
JOURNAL_MB=$(du -sm /var/log/journal 2>/dev/null | cut -f1 || echo 0)
if [ "$JOURNAL_MB" -gt 500 ]; then
  echo "WARN journald: ukuran ${JOURNAL_MB} MB > 500 MB — pertimbangkan vacuum"
  ALERT=1
fi

if [ "$ALERT" -eq 1 ]; then
  exit 1
fi
echo "Semua disk check OK"
exit 0
