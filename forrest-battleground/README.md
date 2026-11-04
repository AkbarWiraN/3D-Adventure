# Forest Battleground — Ancient Survival

Frontend Three.js ESM + backend Fastify/SQLite. Status: Fase 2 work in progress; online combat waits for Fase 3.

## Local checks

```sh
npm test                                            # unit frontend (42)
npm run build:pages                                 # dist/ + audit whitelist
cd server && /opt/node24/bin/node --test tests/*.test.js   # REST/security (23)
```

Browser QA (Chrome headless + WebGL SwiftShader; butuh server statis dan, opsional,
backend uji untuk alur register/login):

```sh
npm run serve &                                     # http://127.0.0.1:8099
/opt/node24/bin/node server/tests/browser-smoke.mjs
# VERDICT: PASS  → solo loot→5 hit→kill feed→death→respawn→exit tanpa listener bocor
# BACKEND_URL=http://127.0.0.1:3100 ... → tambuh register→login→lobby
```

Catatan jujur: FPS di SwiftShader tidak mewakili HP/perangkat nyata.

## REST API v1

Base URL default: `https://api-be.bssn.biz.id`. Browser calls require the configured allowed Origin. For local API tests, run `cd server && npm ci && npm run db:migrate && npm start` with development-only environment from `.env.example`.

| Method | Route | Auth | Purpose |
|---|---|---:|---|
| POST | `/api/v1/auth/register` | No | Create account; returns short-lived Bearer token |
| POST | `/api/v1/auth/login` | No | Login; generic credential errors |
| GET/PATCH | `/api/v1/users/me` | Yes | Read profile / update cosmetic character only |
| GET | `/api/v1/maps` | Yes | Map directory and room status |
| GET | `/api/v1/maps/forest/status` | Yes | Forest status; online count reflects joined WS sessions only |
| GET | `/api/v1/leaderboard?mapId=forest&limit=10&offset=0` | Yes | Read-only PvP leaderboard, bounded pagination |
| GET | `/api/v1/leaderboard/me` | Yes | Current account rank, if any |

Example (use dummy values; never put real passwords or tokens in shell history):

```sh
curl -H 'Origin: https://akbarwiran.github.io' -H 'Content-Type: application/json' \
  -d '{"username":"Example_1","password":"replace-with-local-test-secret","character":"male"}' \
  https://api-be.bssn.biz.id/api/v1/auth/register
```

Passwords are Argon2id-hashed. Access tokens live in frontend memory only; reload requires login. REST leaderboard has no stat-write route; Solo bot kills are not PvP stats. Never commit `.env`, database files, passwords, or access tokens. Do not send credentials to an untrusted custom backend.
