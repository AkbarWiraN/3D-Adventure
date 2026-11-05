#!/bin/bash
# start-qa-backend.sh — backend QA lokal (bukan produksi) untuk smoke test Fase 1-2.
# Origin: frontend dev 8099 + origin produksi, supaya browser-smoke bisa register/login.
cd "$(dirname "$0")/.." || exit 1
export PORT=3100
export HOST=127.0.0.1
export NODE_ENV=production
export FRONTEND_ORIGINS='http://127.0.0.1:8099,https://akbarwiran.github.io'
export DATABASE_FILE=/tmp/fb-qa.sqlite
export AUTH_SECRET='qa-local-secret-key-at-least-32-bytes-long'
export LOG_LEVEL=warn
export WORLD_SEED=20261104
export WORLD_VERSION=forest-v1
export ROOM_HARD_CAP=8
export REGISTER_RATE_MAX=60
exec /opt/node24/bin/node src/server.js
